import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogTabs } from './_components/LogTabs'

export const metadata = { title: 'Log session — Arcline' }

export default async function LogPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-8">
      <h1 className="mb-8 text-2xl font-bold text-foreground">Log session</h1>
      <LogTabs />
    </main>
  )
}
