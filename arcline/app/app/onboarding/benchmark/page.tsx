import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Benchmark } from '@/types'
import { BenchmarkBoard } from './_components/BenchmarkBoard'

export const metadata = { title: 'Benchmark — Arcline' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function BenchmarkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bench } = await supabase
    .from('benchmarks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const benchmark = bench as Benchmark | null
  if (!benchmark) redirect('/app/dashboard')
  if (benchmark.status === 'completed' || benchmark.status === 'skipped') {
    redirect('/app/dashboard')
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Benchmark week</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Three time trials over 5 days. Log each result here. Your AI plan generates as soon as
          you finish (or tap &quot;Generate plan now&quot; with what you have).
        </p>
      </div>

      <BenchmarkBoard benchmark={benchmark} />
    </main>
  )
}
