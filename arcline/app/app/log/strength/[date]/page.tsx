import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Plan, PlanSession, StrengthExercise } from '@/types'
import { LiveWorkoutTracker } from './_components/LiveWorkoutTracker'

export const metadata = { title: 'Strength workout — Arcline' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface PageProps {
  params: Promise<{ date: string }>
}

function findStrengthSessionByDate(
  plan: Plan | null,
  isoDate: string,
): PlanSession | null {
  if (!plan) return null
  for (const week of plan.weeks ?? []) {
    for (const session of week.sessions ?? []) {
      if (session.date === isoDate && session.type === 'strength') return session
    }
  }
  return null
}

export default async function StrengthSessionPage({ params }: PageProps) {
  const { date } = await params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect('/app/dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: plan } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('is_fallback', { ascending: true })
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const session = findStrengthSessionByDate(plan as Plan | null, date)
  if (!session || !session.exercises || session.exercises.length === 0) {
    redirect('/app/dashboard')
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-8">
      <LiveWorkoutTracker
        sessionDate={date}
        focus={session.focus ?? null}
        summary={session.session_summary ?? null}
        durationMin={session.duration_min}
        exercises={session.exercises as StrengthExercise[]}
      />
    </main>
  )
}
