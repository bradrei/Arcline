import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingFlow } from './_components/OnboardingFlow'
import type { Profile } from '@/types'

export const metadata = { title: 'Get started — Arcline' }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Already completed — send them to the app
  if (profile?.onboarding_complete) redirect('/app/dashboard')

  return <OnboardingFlow initialProfile={(profile as Profile | null)} />
}
