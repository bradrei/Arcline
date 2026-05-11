'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { detectInjury, type InjurySource } from '@/lib/ai/detectInjury'
import { generatePlan } from '@/lib/ai/generatePlan'
import { buildBenchmarkProtocol, todayISO } from '@/lib/benchmark/protocol'
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

  const calibration =
    (profile as Profile).calibration_choice ?? finalData.calibration_choice ?? 'fresh'

  // Branch on calibration choice
  if (calibration === 'benchmark') {
    // Create a benchmark row, do not generate the plan yet — the user goes through
    // the 5-day benchmark flow first.
    const protocol = buildBenchmarkProtocol(todayISO())
    await supabase.from('benchmarks').insert({
      user_id: user.id,
      status: 'pending',
      protocol,
    })
    redirect('/app/onboarding/benchmark')
  }

  // 'import' and 'fresh' both generate a plan immediately. 'import' users are
  // nudged to /app/settings/integrations afterwards via a query param banner.
  const planData = await generatePlan(profile as Profile)

  const { data: insertedPlan, error: planError } = await supabase
    .from('plans')
    .insert(planData)
    .select('id')
    .single()

  if (planError) return { error: planError.message }

  if (planData.is_fallback && insertedPlan) {
    await supabase.from('plan_generation_queue').insert({
      user_id: user.id,
      plan_id: insertedPlan.id,
      status: 'pending',
    })
  }

  if (calibration === 'import') {
    redirect('/app/dashboard?calibrate=import')
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

// ── Restart plan: 30-day rate-limited, routes back through goal + calibration ─

export async function restartPlan(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const founderEmail = process.env.FOUNDER_EMAIL
  const isFounder = Boolean(founderEmail && user.email === founderEmail)

  const { data: profile } = await supabase
    .from('profiles')
    .select('last_plan_restart_at')
    .eq('id', user.id)
    .single()

  // Founder accounts bypass the 30-day rate limit so dogfood iteration isn't
  // gated by it. Everyone else is rate-limited.
  if (!isFounder && profile?.last_plan_restart_at) {
    const last = new Date(profile.last_plan_restart_at).getTime()
    const daysSince = (+new Date() - last) / (24 * 60 * 60 * 1000)
    if (daysSince < 30) {
      redirect(`/app/settings?error=restart_rate_limited&days=${Math.ceil(30 - daysSince)}`)
    }
  }

  // Stamp the restart timestamp (still useful telemetry for the founder).
  // Plan archival happens after the goal + calibration flow at
  // /app/onboarding/restart.
  await supabase
    .from('profiles')
    .update({ last_plan_restart_at: new Date().toISOString() })
    .eq('id', user.id)

  redirect('/app/onboarding/restart')
}

export async function completeRestart(
  data: ProfileUpdate & { calibration_choice: 'import' | 'benchmark' | 'fresh' },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Update goal + calibration on profile
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      goal_type: data.goal_type,
      goal_date: data.goal_date,
      goal_description: data.goal_description,
      race_distance: data.race_distance ?? null,
      goal_time_seconds: data.goal_time_seconds ?? null,
      goal_paces: data.goal_paces ?? null,
      calibration_choice: data.calibration_choice,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (profileErr) return { error: profileErr.message }

  // Archive existing active plan(s)
  await supabase
    .from('plans')
    .update({ status: 'archived' })
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (data.calibration_choice === 'benchmark') {
    const protocol = buildBenchmarkProtocol(todayISO())
    await supabase.from('benchmarks').insert({
      user_id: user.id,
      status: 'pending',
      protocol,
    })
    redirect('/app/onboarding/benchmark')
  }

  // 'import' or 'fresh' — generate a fresh plan now
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!profileData) return { error: 'Could not load profile.' }

  const newPlan = await generatePlan(profileData as Profile)
  const { error: planError } = await supabase.from('plans').insert(newPlan)
  if (planError) return { error: planError.message }

  // For 'import' calibration, route to integrations so the user can trigger the
  // 90-day bulk import. The plan was generated with whatever sessions already
  // existed (initial 10 from Strava connect, or none); after import the user
  // can click "Regenerate my plan" from settings to fold the new history in.
  if (data.calibration_choice === 'import') {
    redirect('/app/settings/integrations?calibrate=import')
  }
  redirect('/app/dashboard?plan=regenerated')
}
