import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAllAdaptations } from '@/lib/adaptations/queries'
import { AdaptationHistoryList } from './_components/AdaptationHistoryList'

export const metadata = { title: 'Adaptation history — Arcline' }
export const dynamic = 'force-dynamic'

export default async function AdaptationHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adaptations = await getAllAdaptations(supabase, user.id)

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Adaptation history</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Every change to your plan, with the reasoning behind it.
          </p>
        </div>
        <Link
          href="/app/coach"
          className="text-sm font-medium text-foreground-muted transition hover:text-foreground"
        >
          ← Back to chat
        </Link>
      </div>

      {adaptations.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-surface px-6 py-10 text-center">
          <p className="text-foreground-muted">
            Your adaptation history will appear here as you train. Each plan change comes with the
            reasoning behind it.
          </p>
        </div>
      ) : (
        <AdaptationHistoryList adaptations={adaptations} />
      )}
    </main>
  )
}
