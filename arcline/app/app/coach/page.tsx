import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CoachMessage, Plan, PlanSession, Profile } from '@/types'
import { CoachChat } from './_components/CoachChat'

export const metadata = { title: 'Coach — Arcline' }
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function findSessionByDate(plan: Plan | null, isoDate: string): PlanSession | null {
  if (!plan) return null
  for (const week of plan.weeks ?? []) {
    for (const session of week.sessions ?? []) {
      if (session.date === isoDate && session.type !== 'rest') return session
    }
  }
  return null
}

function getQuickActions(plan: Plan | null): string[] {
  const tomorrow = new Date(+new Date() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
  const tomorrowSession = findSessionByDate(plan, tomorrow)
  const typeLabel = tomorrowSession?.type.replace('_', ' ')

  const candidates: (string | null)[] = [
    tomorrowSession ? `What should I focus on for tomorrow's ${typeLabel}?` : null,
    'How am I tracking toward my goal?',
    "I'm feeling a bit flat this week — should I be worried?",
  ]
  return candidates.filter((c): c is string => Boolean(c))
}

export default async function CoachPage({ searchParams }: PageProps) {
  const params = await searchParams
  const prefillRaw = params.prefill
  const prefill =
    typeof prefillRaw === 'string' ? prefillRaw.slice(0, 500) : ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, planResult, messagesResult] = await Promise.all([
    supabase.from('profiles').select('id, goal_description, goal_date').eq('id', user.id).single(),
    supabase
      .from('plans')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'paused_injury'])
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('coach_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const profile = profileResult.data as Pick<Profile, 'id' | 'goal_description' | 'goal_date'> | null
  const plan = planResult.data as Plan | null
  const messages = ((messagesResult.data ?? []) as CoachMessage[]).reverse()

  const planReady = Boolean(plan)
  const quickActions = planReady ? getQuickActions(plan) : []

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden">
      <CoachChat
        initialMessages={messages}
        planReady={planReady}
        athleteFirstName={firstNameFrom(profile)}
        initialPrefill={prefill}
        quickActions={quickActions}
      />
    </main>
  )
}

function firstNameFrom(_profile: Pick<Profile, 'id' | 'goal_description' | 'goal_date'> | null): string {
  // Profile doesn't store a name yet — keep this thin so the empty-state copy can include one later.
  return ''
}
