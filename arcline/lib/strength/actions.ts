'use server'

import { createClient } from '@/lib/supabase/server'
import { triggerAdaptationAsync } from '@/lib/ai/triggerAdaptation'
import { detectInjury } from '@/lib/ai/detectInjury'
import type { NewSession, StrengthExercise } from '@/types'

export interface SetEntry {
  exercise_index: number
  exercise_name: string
  set_number: number
  weight_kg: number | null
  reps_completed: number | null
}

interface FinishStrengthInput {
  session_date: string
  duration_min: number
  notes: string | null
  exercises: StrengthExercise[]
  sets: SetEntry[]
}

export async function finishStrengthSession(
  input: FinishStrengthInput,
): Promise<{ error?: string; sessionId?: string; injured?: boolean; triggerText?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // HC2 — strength session notes are free-text, must pass through detectInjury
  if (input.notes && input.notes.trim()) {
    const result = await detectInjury(input.notes, 'session_log')
    if (result.injured) {
      // Write the flag and pause active plan; session itself is NOT saved here.
      // The user is sent through the InjuryReferralScreen on next /app/* render.
      await supabase.from('injury_flags').insert({
        user_id: user.id,
        trigger_text: input.notes,
        trigger_source: 'session_log',
        referral_confirmed: false,
      })
      await supabase
        .from('plans')
        .update({ status: 'paused_injury' })
        .eq('user_id', user.id)
        .eq('status', 'active')
      return { error: 'injury_detected', injured: true, triggerText: result.triggerText }
    }
  }

  // Insert the session row first so we have a session_id to link sets to.
  // We bypass saveSessionAndTriggerAdaptation here because we need the inserted
  // id immediately to attach set rows, and the adaptation trigger should fire
  // AFTER sets are persisted (the prompt reads them).
  const sessionData: NewSession = {
    user_id: user.id,
    plan_session_ref: { type: 'strength', exercises: input.exercises },
    session_date: input.session_date,
    input_method: 'manual',
    session_type: 'strength',
    duration_min: input.duration_min,
    distance_km: null,
    avg_hr: null,
    max_hr: null,
    rpe: null,
    avg_pace: null,
    power_watts: null,
    notes: input.notes,
    raw_data: null,
    strava_activity_id: null,
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('sessions')
    .insert(sessionData)
    .select('id')
    .single()
  if (insertErr || !inserted) return { error: insertErr?.message ?? 'Failed to save session.' }

  const sessionId = inserted.id as string

  // Persist all sets
  if (input.sets.length > 0) {
    const setRows = input.sets.map(s => ({
      session_id: sessionId,
      user_id: user.id,
      exercise_name: s.exercise_name,
      exercise_index: s.exercise_index,
      set_number: s.set_number,
      weight_kg: s.weight_kg,
      reps_completed: s.reps_completed,
    }))
    await supabase.from('strength_session_sets').insert(setRows)
  }

  // Fire adaptation engine in the background — sets are now persisted, so the
  // adaptation prompt will see them via the strength history fetch.
  void triggerAdaptationAsync(supabase, user.id, sessionId).catch(err => {
    console.error('Adaptation trigger after strength session failed:', err)
  })

  return { sessionId }
}
