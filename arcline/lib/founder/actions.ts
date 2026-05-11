'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generatePlan } from '@/lib/ai/generatePlan'
import type { Plan, Profile } from '@/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function planNeedsMigration(plan: Plan): boolean {
  for (const week of plan.weeks ?? []) {
    for (const session of week.sessions ?? []) {
      if (!session.date || !ISO_DATE.test(session.date)) return true
    }
  }
  const goal = (plan.goal_anchor ?? {}) as { goal_type?: string; goal_date?: string | null }
  if (goal.goal_type === 'event_date' && goal.goal_date) {
    const lastWeek = plan.weeks[plan.weeks.length - 1]
    const lastSession = lastWeek?.sessions[lastWeek.sessions.length - 1]
    if (!lastSession || lastSession.date !== goal.goal_date) return true
  }
  return false
}

export interface MigrationResult {
  dry_run: boolean
  audited: number
  results: {
    plan_id: string
    user_id: string
    action: 'migrated' | 'skipped' | 'failed'
    reason?: string
  }[]
}

export async function migrateAllPlans(dryRun: boolean): Promise<{
  data?: MigrationResult
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const founderEmail = process.env.FOUNDER_EMAIL
  if (!founderEmail || user.email !== founderEmail) {
    return { error: 'Not authorized.' }
  }

  const admin = createServiceClient()
  const { data: activePlans, error: queryErr } = await admin
    .from('plans')
    .select('*')
    .eq('status', 'active')

  if (queryErr) return { error: queryErr.message }

  const results: MigrationResult['results'] = []

  for (const plan of (activePlans ?? []) as Plan[]) {
    if (!planNeedsMigration(plan)) {
      results.push({
        plan_id: plan.id,
        user_id: plan.user_id,
        action: 'skipped',
        reason: 'already valid',
      })
      continue
    }

    if (dryRun) {
      results.push({
        plan_id: plan.id,
        user_id: plan.user_id,
        action: 'migrated',
        reason: 'dry-run',
      })
      continue
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', plan.user_id)
      .single()
    if (!profile) {
      results.push({
        plan_id: plan.id,
        user_id: plan.user_id,
        action: 'failed',
        reason: 'no profile',
      })
      continue
    }

    try {
      const newPlan = await generatePlan(profile as Profile)
      await admin.from('plans').update({ status: 'archived' }).eq('id', plan.id)
      const { error: insertErr } = await admin.from('plans').insert(newPlan)
      if (insertErr) {
        results.push({
          plan_id: plan.id,
          user_id: plan.user_id,
          action: 'failed',
          reason: insertErr.message,
        })
      } else {
        results.push({
          plan_id: plan.id,
          user_id: plan.user_id,
          action: 'migrated',
          reason: newPlan.is_fallback
            ? 'replaced with fallback (AI failed)'
            : 'replaced with AI plan',
        })
      }
    } catch (err) {
      results.push({
        plan_id: plan.id,
        user_id: plan.user_id,
        action: 'failed',
        reason: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  return {
    data: {
      dry_run: dryRun,
      audited: activePlans?.length ?? 0,
      results,
    },
  }
}

export async function submitFounderBug(
  message: string,
  pageUrl: string,
  userAgent: string,
): Promise<{ ok?: true; error?: string }> {
  const trimmed = message.trim()
  if (!trimmed) return { error: 'Message required.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const founderEmail = process.env.FOUNDER_EMAIL
  if (!founderEmail || user.email !== founderEmail) {
    return { error: 'Not authorized.' }
  }

  // Service role client — RLS denies everyone else by design.
  const adminClient = createServiceClient()
  const { error } = await adminClient.from('founder_bug_log').insert({
    page_url: pageUrl.slice(0, 500),
    message: trimmed.slice(0, 4000),
    user_agent: userAgent.slice(0, 500),
    status: 'open',
  })

  if (error) return { error: error.message }
  return { ok: true }
}
