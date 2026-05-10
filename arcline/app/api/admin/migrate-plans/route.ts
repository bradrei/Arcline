import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generatePlan } from '@/lib/ai/generatePlan'
import type { Plan, Profile } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function planNeedsMigration(plan: Plan): boolean {
  // Any session missing a valid ISO date triggers migration
  for (const week of plan.weeks ?? []) {
    for (const session of week.sessions ?? []) {
      if (!session.date || !ISO_DATE.test(session.date)) return true
    }
  }
  // If goal_anchor specifies an event date, the plan must end on or before it
  const goal = (plan.goal_anchor ?? {}) as { goal_type?: string; goal_date?: string | null }
  if (goal.goal_type === 'event_date' && goal.goal_date) {
    const lastWeek = plan.weeks[plan.weeks.length - 1]
    const lastSession = lastWeek?.sessions[lastWeek.sessions.length - 1]
    if (!lastSession || lastSession.date !== goal.goal_date) return true
  }
  return false
}

export async function POST(req: Request) {
  // Founder gate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const founderEmail = process.env.FOUNDER_EMAIL
  if (!founderEmail || user.email !== founderEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dryRun = new URL(req.url).searchParams.get('dry') === '1'

  // Service-role for cross-user reads/writes
  const admin = createServiceClient()

  const { data: activePlans, error } = await admin
    .from('plans')
    .select('*')
    .eq('status', 'active')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: {
    plan_id: string
    user_id: string
    action: 'migrated' | 'skipped' | 'failed'
    reason?: string
  }[] = []

  for (const plan of (activePlans ?? []) as Plan[]) {
    if (!planNeedsMigration(plan)) {
      results.push({ plan_id: plan.id, user_id: plan.user_id, action: 'skipped', reason: 'already valid' })
      continue
    }

    if (dryRun) {
      results.push({ plan_id: plan.id, user_id: plan.user_id, action: 'migrated', reason: 'dry-run' })
      continue
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', plan.user_id)
      .single()

    if (!profile) {
      results.push({ plan_id: plan.id, user_id: plan.user_id, action: 'failed', reason: 'no profile' })
      continue
    }

    try {
      const newPlan = await generatePlan(profile as Profile)
      // Archive the old plan first so the new one is the only active row
      await admin.from('plans').update({ status: 'archived' }).eq('id', plan.id)
      const { error: insertErr } = await admin.from('plans').insert(newPlan)
      if (insertErr) {
        results.push({ plan_id: plan.id, user_id: plan.user_id, action: 'failed', reason: insertErr.message })
      } else {
        results.push({
          plan_id: plan.id,
          user_id: plan.user_id,
          action: 'migrated',
          reason: newPlan.is_fallback ? 'replaced with fallback (AI failed)' : 'replaced with AI plan',
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

  return NextResponse.json({
    dry_run: dryRun,
    audited: activePlans?.length ?? 0,
    results,
  })
}
