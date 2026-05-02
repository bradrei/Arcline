import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, Plan, PlanWeek, PlanSession, TrainingSession, Intensity } from '@/types'
import { generateCoachAdaptationMessage } from './generateCoachAdaptationMessage'

// ── Constants ─────────────────────────────────────────────────────────────────

const INTENSITY_MULTIPLIERS: Record<Intensity, number> = {
  easy: 1.0,
  moderate: 1.3,
  hard: 1.6,
  race_pace: 1.8,
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data as Profile | null
}

async function fetchActivePlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<Plan | null> {
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()
  return data as Plan | null
}

async function fetchRecentSessions(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
): Promise<TrainingSession[]> {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('session_date', { ascending: false })
    .limit(limit)
  return (data ?? []) as TrainingSession[]
}

async function fetchSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<TrainingSession | null> {
  const { data } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
  return data as TrainingSession | null
}

async function fetchSessionsInRange(
  supabase: SupabaseClient,
  userId: string,
  from: Date,
  to: Date,
): Promise<TrainingSession[]> {
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('session_date', from.toISOString().split('T')[0])
    .lte('session_date', to.toISOString().split('T')[0])
  return (data ?? []) as TrainingSession[]
}

// ── Load calculation ──────────────────────────────────────────────────────────

export function calculateActualLoad(sessions: TrainingSession[]): number {
  return sessions.reduce((sum, s) => {
    if (!s.duration_min) return sum
    // Map RPE → intensity multiplier for logged sessions (no intensity field on TrainingSession)
    const rpe = s.rpe ?? 5
    const multiplier = rpe <= 3 ? 1.0 : rpe <= 6 ? 1.3 : rpe <= 8 ? 1.6 : 1.8
    return sum + s.duration_min * multiplier
  }, 0)
}

function calculatePlanLoad(sessions: PlanSession[]): number {
  return sessions.reduce((sum, s) => {
    const mult = INTENSITY_MULTIPLIERS[s.intensity] ?? 1.0
    return sum + s.duration_min * mult
  }, 0)
}

// ── HC1: enforce 15% load ceiling on adapted weeks ────────────────────────────

function enforceLoadCeiling(weeks: PlanWeek[], baselineLoad: number): PlanWeek[] {
  if (weeks.length === 0) return weeks
  let prevLoad = baselineLoad

  return weeks.map(week => {
    const ceiling = prevLoad * 1.15
    const weekLoad = calculatePlanLoad(week.sessions)

    if (weekLoad > ceiling && ceiling > 0) {
      const scaleFactor = ceiling / weekLoad
      const scaledSessions = week.sessions.map(s => ({
        ...s,
        duration_min:
          s.duration_min === 0
            ? 0
            : Math.max(15, Math.round((s.duration_min * scaleFactor) / 5) * 5),
      }))
      const scaledLoad = calculatePlanLoad(scaledSessions)
      prevLoad = scaledLoad
      return { ...week, sessions: scaledSessions, total_load_minutes: Math.round(scaledLoad) }
    }

    prevLoad = weekLoad
    return week
  })
}

// ── Trigger context builder ───────────────────────────────────────────────────

type TriggerType = 'session_performance' | 'missed' | 'reduced' | 'extended' | 'added'

function buildTriggerContext(type: TriggerType, session: TrainingSession | null) {
  const contexts: Record<TriggerType, string> = {
    missed: `The user missed their planned ${session?.session_type ?? ''} session on ${session?.session_date ?? ''}. The session cannot be rescheduled — it is gone. Rebalance what remains this week to maintain goal trajectory without adding the missed load back in.`,
    reduced: `The user completed a significantly shorter or easier session than planned. Duration was ${session?.duration_min} minutes. RPE was ${session?.rpe ?? 'not recorded'}. Adjust the remainder of the week accordingly.`,
    extended: `The user went longer or harder than planned. Duration was ${session?.duration_min} minutes, RPE ${session?.rpe ?? 'not recorded'}. Account for the additional load in the coming days.`,
    added: `The user logged a session that was not in their plan. This is additional training volume. Factor the recovery implications into upcoming sessions.`,
    session_performance: `The user just completed a session. Evaluate their performance and adapt the upcoming week accordingly.`,
  }
  return { type, context: contexts[type], session }
}

// ── Claude API call ───────────────────────────────────────────────────────────

interface AdaptationResponse {
  weeks?: PlanWeek[]
  ai_reasoning?: string
  action?: 'injury_detected'
  triggerText?: string
}

async function callClaudeAdaptation(prompt: string): Promise<AdaptationResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY!
  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system:
      'You are the Arcline coaching engine. Output ONLY raw JSON — no markdown, no explanation, no code fences.',
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(jsonText) as AdaptationResponse
}

// ── Save plan version + record adaptation ─────────────────────────────────────

async function savePlanVersion(
  supabase: SupabaseClient,
  userId: string,
  plan: Plan,
  adaptedWeeks: PlanWeek[],
  meta: {
    trigger_type: string
    trigger_session_id: string | null
    ai_reasoning: string
    load_before: number
    load_after: number
  },
): Promise<Plan> {
  const { data: updatedPlan, error } = await supabase
    .from('plans')
    .update({
      weeks: adaptedWeeks,
      version: plan.version + 1,
      adaptation_count: plan.adaptation_count + 1,
      is_fallback: false,
    })
    .eq('id', plan.id)
    .select()
    .single()

  if (error) throw new Error(`Failed to save adapted plan: ${error.message}`)

  await supabase.from('adaptations').insert({
    user_id: userId,
    plan_id: plan.id,
    trigger_type: meta.trigger_type,
    trigger_session_id: meta.trigger_session_id,
    ai_reasoning: meta.ai_reasoning,
    load_before: Math.round(meta.load_before),
    load_after: Math.round(meta.load_after),
    plan_before: plan.weeks,
    plan_after: adaptedWeeks,
  })

  return updatedPlan as Plan
}

// ── Main trigger ──────────────────────────────────────────────────────────────

export async function triggerAdaptationAsync(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string | null,
  triggerType: TriggerType = 'session_performance',
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('your-')) return

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const [profile, activePlan, recentSessions, currentSession, previousWeekSessions] =
    await Promise.all([
      fetchProfile(supabase, userId),
      fetchActivePlan(supabase, userId),
      fetchRecentSessions(supabase, userId, 4),
      sessionId ? fetchSession(supabase, sessionId) : Promise.resolve(null),
      fetchSessionsInRange(supabase, userId, sevenDaysAgo, now),
    ])

  if (!profile || !activePlan) return

  const previousWeekActualLoad = calculateActualLoad(previousWeekSessions)

  // Fallback baseline: if no sessions logged yet, use the first planned week's load
  // so HC1 doesn't zero out all sessions on a new plan.
  const baselineLoad =
    previousWeekActualLoad > 0
      ? previousWeekActualLoad
      : activePlan.weeks.length > 0
        ? calculatePlanLoad(activePlan.weeks[0].sessions)
        : 120 // absolute floor: 120 weighted minutes

  const triggerContext = buildTriggerContext(triggerType, currentSession)
  const today = now.toISOString().split('T')[0]

  const prompt = `
You are the Arcline coaching engine. A training event has just occurred.
Your job: rewrite ONLY the upcoming incomplete sessions in the current week.
If fewer than 2 sessions remain this week, also rewrite next week's sessions.
Do NOT modify completed sessions. Return valid JSON matching the full plan schema.

RULES — INVIOLABLE:
1. Never propose a weekly load more than 15% above the previous week's actual load. (Enforced in code after your response — do not propose it regardless.)
2. If you detect injury language anywhere in the session data, return ONLY: { "action": "injury_detected", "triggerText": "<exact text>" }
3. Always preserve trajectory toward the goal. Every adaptation must keep the athlete on track for their target distance and event date.
4. Maintain discipline balance — if swim volume drops, flag it. If a brick was missed, consider how to work it back in. Never let one discipline dominate at the expense of race-day readiness.
5. Write ai_reasoning in second person. Plain English. As a triathlon coach speaking directly to the athlete. 2–3 sentences maximum. Make it feel human — reference the specific discipline and what you're adjusting and why.

Profile: ${JSON.stringify(profile)}
Goal: ${JSON.stringify({ type: profile.goal_type, date: profile.goal_date, description: profile.goal_description })}
Current plan: ${JSON.stringify(activePlan.weeks)}
Recent sessions (newest first): ${JSON.stringify(recentSessions)}
Trigger: ${JSON.stringify(triggerContext)}
Today: ${today}
Previous 7-day actual load (weighted minutes): ${Math.round(baselineLoad)}

Return JSON in exactly one of these two shapes:

Shape 1 — normal adaptation:
{ "weeks": [ /* full plan weeks array with modifications applied */ ], "ai_reasoning": "2-3 sentence coach note in second person" }

Shape 2 — injury detected:
{ "action": "injury_detected", "triggerText": "<exact phrase from session data>" }
`

  let response: AdaptationResponse
  try {
    response = await callClaudeAdaptation(prompt)
  } catch (err) {
    console.error('Adaptation Claude call failed:', err)
    throw err // let the caller insert to adaptation_queue
  }

  // Injury detected — pause plan and flag
  if (response.action === 'injury_detected' && response.triggerText) {
    await supabase.from('injury_flags').insert({
      user_id: userId,
      trigger_text: response.triggerText,
      trigger_source: 'session_log',
      referral_confirmed: false,
    })
    await supabase
      .from('plans')
      .update({ status: 'paused_injury' })
      .eq('id', activePlan.id)
    return
  }

  if (!response.weeks || !Array.isArray(response.weeks) || response.weeks.length === 0) {
    throw new Error('Adaptation response missing weeks array')
  }

  // Enforce HC1 — user never sees uncapped version
  const cappedWeeks = enforceLoadCeiling(response.weeks, baselineLoad)

  const loadAfter =
    cappedWeeks.length > 0 ? calculatePlanLoad(cappedWeeks[0].sessions) : 0

  await savePlanVersion(supabase, userId, activePlan, cappedWeeks, {
    trigger_type: triggerType,
    trigger_session_id: sessionId,
    ai_reasoning: response.ai_reasoning ?? '',
    load_before: baselineLoad,
    load_after: loadAfter,
  })

  // Persist a coach chat message so the athlete sees a note from their coach
  // next time they open /app/coach. Failure here must not break the adaptation.
  try {
    const coachMessage = await generateCoachAdaptationMessage(
      response.ai_reasoning ?? '',
      triggerType,
    )
    if (coachMessage) {
      await supabase.from('coach_messages').insert({
        user_id: userId,
        role: 'assistant',
        content: coachMessage,
      })
    }
  } catch (err) {
    console.error('Failed to persist coach adaptation message:', err)
  }

  // Note: Zustand store (setActivePlan, triggerAdaptationToast) cannot be called
  // server-side. Plan update is visible on next dashboard render.
  // AdaptationToast wired in Session 8.
}
