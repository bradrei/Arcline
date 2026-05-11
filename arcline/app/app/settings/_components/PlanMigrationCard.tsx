'use client'

import { useState } from 'react'
import { migrateAllPlans, type MigrationResult } from '@/lib/founder/actions'

export function PlanMigrationCard() {
  const [loading, setLoading] = useState<'dry' | 'real' | null>(null)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(dryRun: boolean) {
    setLoading(dryRun ? 'dry' : 'real')
    setError(null)
    setResult(null)
    try {
      const res = await migrateAllPlans(dryRun)
      if (res.error) setError(res.error)
      else if (res.data) setResult(res.data)
    } catch {
      setError("Couldn't run migration. Try again.")
    } finally {
      setLoading(null)
    }
  }

  const migrated = result?.results.filter(r => r.action === 'migrated').length ?? 0
  const skipped = result?.results.filter(r => r.action === 'skipped').length ?? 0
  const failed = result?.results.filter(r => r.action === 'failed').length ?? 0

  return (
    <section className="mt-6 rounded-2xl border border-purple-400/20 bg-purple-400/5 p-6">
      <h2 className="font-semibold text-foreground">Plan migration (founder only)</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        Audit active plans across all users. Regenerate any plan that lacks ISO dates on its
        sessions or whose final session doesn&apos;t land on the user&apos;s race date.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run(true)}
          disabled={loading !== null}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-foreground-muted transition hover:border-white/20 hover:text-foreground disabled:opacity-50"
        >
          {loading === 'dry' ? 'Auditing…' : 'Dry run'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirm('Regenerate every plan that needs migration? Old plans will be archived.')) return
            run(false)
          }}
          disabled={loading !== null}
          className="rounded-xl border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-sm font-semibold text-purple-300 transition hover:bg-purple-400/20 disabled:opacity-50"
        >
          {loading === 'real' ? 'Migrating…' : 'Run migration'}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-white/5 bg-background/40 px-4 py-3 text-xs">
          <p className="text-foreground">
            {result.dry_run ? 'Dry run complete.' : 'Migration complete.'} Audited{' '}
            <span className="font-semibold">{result.audited}</span> active plan
            {result.audited === 1 ? '' : 's'}.
          </p>
          <ul className="mt-2 grid grid-cols-3 gap-2 text-foreground-muted">
            <li>
              <span className="text-foreground">{migrated}</span> migrated
            </li>
            <li>
              <span className="text-foreground">{skipped}</span> skipped
            </li>
            <li>
              <span className="text-foreground">{failed}</span> failed
            </li>
          </ul>
          {result.results.length > 0 && (
            <details className="mt-3 cursor-pointer">
              <summary className="text-foreground-muted hover:text-foreground">View per-plan detail</summary>
              <ul className="mt-2 space-y-1 font-mono text-[11px]">
                {result.results.map(r => (
                  <li key={r.plan_id} className="text-foreground-muted">
                    <span
                      className={
                        r.action === 'migrated'
                          ? 'text-brand-teal'
                          : r.action === 'failed'
                            ? 'text-red-300'
                            : 'text-foreground-muted'
                      }
                    >
                      {r.action}
                    </span>{' '}
                    · {r.user_id.slice(0, 8)} · {r.reason ?? ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
