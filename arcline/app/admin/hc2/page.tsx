import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const metadata = { title: 'HC2 admin — Arcline' }
export const dynamic = 'force-dynamic'

interface FalsePositiveRow {
  id: string
  user_id: string
  trigger_text: string | null
  source: string | null
  created_at: string
}

interface InjuryFlagRow {
  id: string
  user_id: string
  trigger_text: string | null
  trigger_source: string | null
  detected_at: string
  referral_confirmed: boolean
  resolved: boolean
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function HC2AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const founderEmail = process.env.FOUNDER_EMAIL
  if (!founderEmail || user.email !== founderEmail) {
    redirect('/')
  }

  // Service role client bypasses RLS — admin needs to see all users' false positives.
  // Gated above by FOUNDER_EMAIL check.
  const adminClient = createServiceClient()

  const [fpResult, flagResult] = await Promise.all([
    adminClient
      .from('hc2_false_positives')
      .select('id, user_id, trigger_text, source, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    adminClient
      .from('injury_flags')
      .select('id, user_id, trigger_text, trigger_source, detected_at, referral_confirmed, resolved')
      .order('detected_at', { ascending: false })
      .limit(200),
  ])

  const falsePositives = (fpResult.data ?? []) as FalsePositiveRow[]
  const flags = (flagResult.data ?? []) as InjuryFlagRow[]

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">HC2 admin — classifier tuning</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          False positives feed the classifier improvement loop. Flags below show every detection
          (resolved + unresolved). Visible to {founderEmail} only.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-teal">
          False positives ({falsePositives.length})
        </h2>
        {falsePositives.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-surface px-5 py-6 text-sm text-foreground-muted">
            No dismissals recorded yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-foreground-muted">
                <tr>
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5">Trigger text</th>
                  <th className="px-4 py-2.5">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {falsePositives.map(row => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-xs text-foreground-muted">{fmt(row.created_at)}</td>
                    <td className="px-4 py-3 text-xs uppercase tracking-wide text-foreground-muted">
                      {row.source ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.trigger_text ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-foreground-muted">
                      {row.user_id.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground-muted">
          Recent flags ({flags.length})
        </h2>
        {flags.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-surface px-5 py-6 text-sm text-foreground-muted">
            No injury flags yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-foreground-muted">
                <tr>
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5">Trigger text</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {flags.map(row => {
                  let status = 'Pending'
                  if (row.referral_confirmed) status = 'Referred'
                  else if (row.resolved) status = 'Dismissed'
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-xs text-foreground-muted">{fmt(row.detected_at)}</td>
                      <td className="px-4 py-3 text-xs uppercase tracking-wide text-foreground-muted">
                        {row.trigger_source ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-foreground">{row.trigger_text ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-foreground-muted">{status}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-foreground-muted">
                        {row.user_id.slice(0, 8)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
