'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Benchmark, BenchmarkProtocolSession, BenchmarkResults } from '@/types'
import { logBenchmarkResult, finalizeBenchmark, skipBenchmark } from '@/lib/benchmark/actions'

interface Props {
  benchmark: Benchmark
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function resultForSession(
  session: BenchmarkProtocolSession,
  results: BenchmarkResults | null,
): string | null {
  if (!results) return null
  if (session.type === 'run' && results.run_pace) return `${results.run_pace} per km`
  if (session.type === 'bike') {
    if (results.bike_power) return `${results.bike_power} W`
    if (results.bike_kmh) return `${results.bike_kmh} km/h`
  }
  if (session.type === 'swim' && results.swim_pace) return `${results.swim_pace} per 100m`
  return null
}

function SessionRow({
  session,
  benchmarkId,
  initialValue,
  onLogged,
}: {
  session: BenchmarkProtocolSession
  benchmarkId: string
  initialValue: string | null
  onLogged: () => void
}) {
  const [value, setValue] = useState(initialValue ?? '')
  const [bikeMode, setBikeMode] = useState<'power' | 'kmh'>('power')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(initialValue === null)

  async function handleSave() {
    if (!value.trim()) {
      setError('Enter a value before saving.')
      return
    }
    setSaving(true)
    setError(null)
    let patch: Parameters<typeof logBenchmarkResult>[1] = {}
    if (session.type === 'run') patch = { run_pace: value.trim() }
    else if (session.type === 'swim') patch = { swim_pace: value.trim() }
    else if (session.type === 'bike') {
      if (bikeMode === 'power') {
        const n = Number(value)
        if (Number.isNaN(n) || n <= 0) {
          setError('Power must be a positive number.')
          setSaving(false)
          return
        }
        patch = { bike_power: n, bike_kmh: null }
      } else {
        const n = Number(value)
        if (Number.isNaN(n) || n <= 0) {
          setError('Speed must be a positive number.')
          setSaving(false)
          return
        }
        patch = { bike_kmh: n, bike_power: null }
      }
    }

    const result = await logBenchmarkResult(benchmarkId, patch)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setOpen(false)
    onLogged()
  }

  const placeholder =
    session.type === 'run'
      ? '4:35'
      : session.type === 'swim'
        ? '1:50'
        : bikeMode === 'power'
          ? '210'
          : '32.5'

  const unit =
    session.type === 'run'
      ? 'per km'
      : session.type === 'swim'
        ? 'per 100m'
        : bikeMode === 'power'
          ? 'W'
          : 'km/h'

  return (
    <div className="rounded-2xl border border-white/10 bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-foreground-muted">
            Day {session.day_number} · {fmtDate(session.date)}
          </p>
          <h3 className="mt-1 font-semibold text-foreground">{session.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{session.protocol}</p>
        </div>
        {initialValue && !open && (
          <span className="rounded-md bg-brand-teal/15 px-2 py-1 text-xs font-bold text-brand-teal">
            Logged
          </span>
        )}
      </div>

      {!open ? (
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-sm text-foreground">{initialValue ?? '—'}</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-medium text-foreground-muted underline hover:text-foreground"
          >
            {initialValue ? 'Edit' : 'Log result'}
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {session.type === 'bike' && (
            <div className="flex gap-2 text-xs">
              {(['power', 'kmh'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setBikeMode(m)}
                  className={`rounded-md px-2 py-1 font-medium transition ${
                    bikeMode === m
                      ? 'bg-brand-teal/20 text-brand-teal'
                      : 'text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {m === 'power' ? 'Watts' : 'km/h'}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-xl border border-white/10 bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-brand-teal/60"
            />
            <span className="flex items-center px-2 text-xs text-foreground-muted">{unit}</span>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-brand-teal px-4 py-2 text-sm font-semibold text-background transition hover:bg-brand-teal-dim disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save result'}
            </button>
            {initialValue && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-2 text-sm text-foreground-muted hover:text-foreground"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function BenchmarkBoard({ benchmark }: Props) {
  const [results, setResults] = useState<BenchmarkResults>(benchmark.results ?? {})

  const sessions = benchmark.protocol.sessions
  const allLogged = sessions.every(s => resultForSession(s, results) !== null)
  const anyLogged = sessions.some(s => resultForSession(s, results) !== null)

  function refreshResults() {
    // Light client-side optimistic update via server action's result on next page render
    // Form submission triggers server-side patch; we re-render via the form's redirect/refresh.
    // For UX continuity here we just mirror the in-memory state.
    setResults(prev => ({ ...prev }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {sessions.map(session => (
          <SessionRow
            key={session.day_number}
            session={session}
            benchmarkId={benchmark.id}
            initialValue={resultForSession(session, results)}
            onLogged={() => {
              // Optimistically capture the value into local state; server is now source of truth
              refreshResults()
              // Trigger a router refresh by reloading the page so server-side results persist
              if (typeof window !== 'undefined') window.location.reload()
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-3 rounded-2xl border border-brand-teal/20 bg-brand-teal/5 p-5"
      >
        <p className="text-sm text-foreground">
          {allLogged
            ? 'All three benchmarks logged. Generate your plan now.'
            : anyLogged
              ? 'Generate your plan with what you have, or come back when more results are in.'
              : 'Log at least one result before generating, or skip benchmarks for a fresh start.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={finalizeBenchmark}>
            <button
              type="submit"
              disabled={!anyLogged}
              className="rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-semibold text-background transition hover:bg-brand-teal-dim disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate plan with results
            </button>
          </form>
          <form action={skipBenchmark}>
            <button
              type="submit"
              className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-foreground-muted transition hover:border-white/20 hover:text-foreground"
            >
              Skip benchmark
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
