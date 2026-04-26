import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Plan, TrainingSession } from '@/types'
import { PlanWeekView } from '@/components/PlanWeekView'
import { StreakCounter } from '@/components/gamification/StreakCounter'
import { WeeklyRing } from '@/components/gamification/WeeklyRing'
import { LoadTrendGraph, type WeekLoad } from '@/components/gamification/LoadTrendGraph'

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
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const elapsed = Date.now() - new Date(plan.generated_at).getTime()
  return Math.min(Math.max(Math.floor(elapsed / msPerWeek), 0), plan.weeks.length - 1)
}

function getWeekBounds(plan: Plan, weekIndex: number): { start: string; end: string } {
  const week = plan.weeks[weekIndex]
  const startDate = week.week_start
    ? new Date(week.week_start)
    : (() => { const d = new Date(plan.generated_at); d.setDate(d.getDate() + weekIndex * 7); return d })()
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 7)
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  }
}

function computeStreak(sessionDates: string[]): number {
  if (sessionDates.length === 0) return 0
  const unique = [...new Set(sessionDates)].sort().reverse()
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (unique[0] !== today && unique[0] !== yesterday) return 0
  let streak = 1
  for (let i = 1; i < unique.length; i++) {
    const a = new Date(unique[i - 1]).getTime()
    const b = new Date(unique[i]).getTime()
    if ((a - b) / 86400000 === 1) streak++
    else break
  }
  return streak
}

function computeWeeklyLoad(sessions: TrainingSession[]): WeekLoad[] {
  const weeks: WeekLoad[] = []
  const now = new Date()
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now)
    // Find Monday of the week i weeks ago
    const dayOfWeek = weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1
    weekStart.setDate(weekStart.getDate() - dayOfWeek - i * 7)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const ws = weekStart.toISOString().split('T')[0]
    const we = weekEnd.toISOString().split('T')[0]
    const weekSessions = sessions.filter(s => s.session_date >= ws && s.session_date < we)
    const loadMinutes = weekSessions.reduce((sum, s) => {
      if (!s.duration_min) return sum
      const rpe = s.rpe ?? 5
      const mult = rpe <= 3 ? 1.0 : rpe <= 6 ? 1.3 : rpe <= 8 ? 1.6 : 1.8
      return sum + s.duration_min * mult
    }, 0)
    weeks.push({ weekStart: ws, loadMinutes: Math.round(loadMinutes) })
  }
  return weeks
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch plan and sessions in parallel
  const now = new Date()
  const eightWeeksAgo = new Date(+now - 56 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [planResult, sessionsResult] = await Promise.all([
    supabase
      .from('plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sessions')
      .select('session_date, duration_min, rpe')
      .eq('user_id', user.id)
      .gte('session_date', eightWeeksAgo)
      .order('session_date', { ascending: false }),
  ])

  const typedPlan = planResult.data as Plan | null
  const sessions = (sessionsResult.data ?? []) as TrainingSession[]

  const weekIndex = typedPlan ? getCurrentWeekIndex(typedPlan) : 0
  const currentWeek = typedPlan?.weeks[weekIndex]

  // Compute gamification stats
  const streak = computeStreak(sessions.map(s => s.session_date))
  const loadTrendData = computeWeeklyLoad(sessions)

  let weeklyPercent = 0
  if (typedPlan && currentWeek) {
    const { start, end } = getWeekBounds(typedPlan, weekIndex)
    const loggedThisWeek = sessions.filter(s => s.session_date >= start && s.session_date < end).length
    const planned = currentWeek.sessions.filter(s => s.type !== 'rest').length
    weeklyPercent = planned > 0 ? Math.min(100, Math.round((loggedThisWeek / planned) * 100)) : 0
  }

  return (
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
          <StreakCounter streak={streak} />
          <WeeklyRing percent={weeklyPercent} />
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

      {/* Load trend */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground-muted">Training load (8 weeks)</h2>
        <LoadTrendGraph data={loadTrendData} />
      </div>
    </main>
  )
}
