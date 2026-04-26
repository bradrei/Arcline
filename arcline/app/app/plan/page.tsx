import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Plan } from '@/types'
import { PlanWeekView } from '@/components/PlanWeekView'

export const metadata = { title: 'Your plan — Arcline' }

export default async function PlanPage() {
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
  const goalDescription = typedPlan?.goal_anchor
    ? (typedPlan.goal_anchor as { goal_description?: string }).goal_description
    : null

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Your plan</h1>
        {goalDescription && (
          <p className="mt-1 text-sm text-foreground-muted">{goalDescription}</p>
        )}
      </div>

      {!typedPlan && (
        <div className="rounded-xl border border-white/10 bg-surface px-6 py-10 text-center">
          <p className="text-foreground-muted">No active plan found.</p>
        </div>
      )}

      {typedPlan && (
        <div className="flex flex-col gap-10">
          {typedPlan.weeks.map(week => {
            const totalMin = week.sessions.reduce((sum, s) => sum + s.duration_min, 0)
            const hours = Math.floor(totalMin / 60)
            const mins = totalMin % 60
            const durationLabel = hours > 0
              ? mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
              : `${mins}m`

            return (
              <div key={week.week_number}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold text-foreground">
                    Week {week.week_number}
                  </h2>
                  <span className="text-xs text-foreground-muted">{durationLabel} training</span>
                </div>
                <PlanWeekView week={week} />
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
