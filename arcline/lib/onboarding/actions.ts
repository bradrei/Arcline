'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { detectInjury, type InjurySource } from '@/lib/ai/detectInjury'
import { generatePlan } from '@/lib/ai/generatePlan'
import type { Profile, PlanWeek } from '@/types'

type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>

export async function saveStep(data: ProfileUpdate): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('profiles')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return {}
}

export async function checkInjuryText(
  text: string,
  source: InjurySource
): Promise<{ injured: boolean; triggerText: string }> {
  if (!text.trim()) return { injured: false, triggerText: '' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { injured: false, triggerText: '' }

  const result = await detectInjury(text, source)

  if (result.injured) {
    // Record the flag — no plan to pause yet during onboarding
    await supabase.from('injury_flags').insert({
      user_id: user.id,
      trigger_text: text,
      trigger_source: source,
      referral_confirmed: false,
    })
  }

  return result
}

export async function confirmInjuryReferral(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Confirm the most recent unresolved flag
  const { data: flag } = await supabase
    .from('injury_flags')
    .select('id')
    .eq('user_id', user.id)
    .eq('referral_confirmed', false)
    .order('detected_at', { ascending: false })
    .limit(1)
    .single()

  if (flag) {
    await supabase
      .from('injury_flags')
      .update({ referral_confirmed: true, confirmed_at: new Date().toISOString() })
      .eq('id', flag.id)
  }

  // Conservative return adaptation: −20% duration, all intensity set to easy
  const { data: pausedPlan } = await supabase
    .from('plans')
    .select('id, weeks')
    .eq('user_id', user.id)
    .eq('status', 'paused_injury')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pausedPlan) {
    const conservativeWeeks = (pausedPlan.weeks as PlanWeek[]).map(week => ({
      ...week,
      sessions: week.sessions.map(session => ({
        ...session,
        duration_min:
          session.duration_min === 0
            ? 0
            : Math.max(15, Math.round((session.duration_min * 0.8) / 5) * 5),
        intensity: 'easy' as const,
      })),
    }))
    await supabase
      .from('plans')
      .update({ weeks: conservativeWeeks, status: 'active' })
      .eq('id', pausedPlan.id)
  } else {
    await supabase
      .from('plans')
      .update({ status: 'active' })
      .eq('user_id', user.id)
      .eq('status', 'paused_injury')
  }

  return {}
}

export async function dismissInjuryAsFalsePositive(
  triggerText: string,
  source: InjurySource
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  await supabase.from('hc2_false_positives').insert({
    user_id: user.id,
    trigger_text: triggerText,
    source,
  })

  // Resolve the outstanding flag and unpause plan
  await Promise.all([
    supabase
      .from('injury_flags')
      .update({ resolved: true })
      .eq('user_id', user.id)
      .eq('referral_confirmed', false),
    supabase
      .from('plans')
      .update({ status: 'active' })
      .eq('user_id', user.id)
      .eq('status', 'paused_injury'),
  ])

  return {}
}

export async function completeOnboarding(
  finalData: ProfileUpdate
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Save final step + mark onboarding complete
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      ...finalData,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (profileError) return { error: profileError.message }

  // Fetch full profile to build the fallback plan
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (fetchError || !profile) return { error: 'Could not load profile for plan generation.' }

  // Generate plan (AI → fallback on failure)
  const planData = await generatePlan(profile as Profile)

  const { data: insertedPlan, error: planError } = await supabase
    .from('plans')
    .insert(planData)
    .select('id')
    .single()

  if (planError) return { error: planError.message }

  // If AI generation failed and we used the fallback, queue for background regen
  if (planData.is_fallback && insertedPlan) {
    await supabase.from('plan_generation_queue').insert({
      user_id: user.id,
      plan_id: insertedPlan.id,
      status: 'pending',
    })
    // Silently ignore if table doesn't exist yet
  }

  redirect('/app/dashboard')
}

// ── Regenerate active plan with full profile + history ───────────────────────

export async function regenerateActivePlan(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (profileErr || !profile) redirect('/app/settings?error=profile_missing')

  // Archive any active plan first so the new one is the only active row
  await supabase
    .from('plans')
    .update({ status: 'archived' })
    .eq('user_id', user.id)
    .eq('status', 'active')

  const newPlan = await generatePlan(profile as Profile)
  const { data: inserted, error: planErr } = await supabase
    .from('plans')
    .insert(newPlan)
    .select('id')
    .single()
  if (planErr) redirect('/app/settings?error=plan_insert_failed')

  // If the regenerated plan is still a fallback (Anthropic still down/quota out),
  // queue another attempt for the cron.
  if (newPlan.is_fallback && inserted) {
    await supabase
      .from('plan_generation_queue')
      .insert({ user_id: user.id, plan_id: inserted.id, status: 'pending' })
  }

  redirect(newPlan.is_fallback ? '/app/dashboard?plan=fallback' : '/app/dashboard?plan=regenerated')
}
