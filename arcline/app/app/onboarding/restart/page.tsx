import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'
import { RestartFlow } from './_components/RestartFlow'

export const metadata = { title: 'Start a new plan — Arcline' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function RestartPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/app/dashboard')

  return <RestartFlow profile={profile as Profile} />
}
