import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Plan } from '@/types'
import { PlanWeekView } from '@/components/PlanWeekView'
import { StreakCounter } from '@/components/gamification/StreakCounter'
import { WeeklyRing } from '@/components/gamification/WeeklyRing'
import { AdaptationToast } from '@/components/gamification/AdaptationToast'
import { SessionCompleteAnimation } from '@/components/gamification/SessionCompleteAnimation'
import { LoadTrendGraph } from '@/components/gamification/LoadTrendGraph'

export const metadata = { title: 'Dashboard — Arcline' }

function getCurrentWeekIndex(plan: Plan): number {
  const today = new Date().toISOString().split('T')[0]

  for (let i = 0; i < plan.weeks.length; i++) {
    const week = plan.weeks[i]
    if (week.week_start) {
      const end = new Date(week.week_start)
      end.setDate(end.getDate() + 7)
      if (today >= week.week_start && today < end.toISOString().split('T')[0]) return i
    }
  }

  // Fallback: derive from generated_at
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const elapsed = Date.now() - new Date(plan.generated_at).getTime()
  return Math.min(Math.max(Math.floor(elapsed / msPerWeek), 0), plan.weeks.length - 1)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: plan } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  const typedPlan = plan as Plan | null
  const weekIndex = typedPlan ? getCurrentWeekIndex(typedPlan) : 0
  const currentWeek = typedPlan?.weeks[weekIndex]

  return (
    <>
      <AdaptationToast />
      <SessionCompleteAnimation />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">This week</h1>
            <p className="mt-0.5 text-sm text-foreground-muted">
              Week {weekIndex + 1} of {typedPlan?.weeks.length ?? '—'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <StreakCounter />
            <WeeklyRing />
          </div>
        </div>

        {/* Fallback banner */}
        {typedPlan?.is_fallback && (
          <div className="mb-6 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3">
            <p className="text-sm text-brand-teal">
              We&apos;re still tailoring your plan — check back in a few minutes.
            </p>
          </div>
        )}

        {/* No plan state */}
        {!typedPlan && (
          <div className="rounded-xl border border-white/10 bg-surface px-6 py-10 text-center">
            <p className="text-foreground-muted">No active plan found. Complete onboarding to get started.</p>
          </div>
        )}

        {/* Current week sessions */}
        {currentWeek && <PlanWeekView week={currentWeek} />}

        {/* Load trend (stub — Session 8) */}
        <div className="mt-8">
          <LoadTrendGraph />
        </div>
      </main>
    </>
  )
}
