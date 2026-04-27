import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CoachMessage, Plan, Profile } from '@/types'
import { CoachChat } from './_components/CoachChat'

export const metadata = { title: 'Coach — Arcline' }
export const dynamic = 'force-dynamic'

export default async function CoachPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, planResult, messagesResult] = await Promise.all([
    supabase.from('profiles').select('id, goal_description, goal_date').eq('id', user.id).single(),
    supabase
      .from('plans')
      .select('id, status, is_fallback')
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
  const plan = planResult.data as Pick<Plan, 'id' | 'status' | 'is_fallback'> | null
  const messages = ((messagesResult.data ?? []) as CoachMessage[]).reverse()

  const planReady = Boolean(plan)

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden">
      <CoachChat
        initialMessages={messages}
        planReady={planReady}
        athleteFirstName={firstNameFrom(profile)}
      />
    </main>
  )
}

function firstNameFrom(_profile: Pick<Profile, 'id' | 'goal_description' | 'goal_date'> | null): string {
  // Profile doesn't store a name yet — keep this thin so the empty-state copy can include one later.
  return ''
}
