'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TrainingSession } from '@/types'

interface Props {
  sessions: TrainingSession[]
  /** ISO date — the first day of the user's current training plan. */
  planStartDate: string | null
}

const DISCIPLINE_META: Record<
  string,
  { label: string; chip: string; ring: string }
> = {
  swim: { label: 'S', chip: 'text-blue-400 bg-blue-400/10 border-blue-400/30', ring: 'bg-blue-400' },
  bike: { label: 'B', chip: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', ring: 'bg-yellow-400' },
  run: { label: 'R', chip: 'text-green-400 bg-green-400/10 border-green-400/30', ring: 'bg-green-400' },
  brick: { label: 'Br', chip: 'text-purple-400 bg-purple-400/10 border-purple-400/30', ring: 'bg-purple-400' },
  strength: { label: 'St', chip: 'text-orange-400 bg-orange-400/10 border-orange-400/30', ring: 'bg-orange-400' },
  open_water: { label: 'OW', chip: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30', ring: 'bg-cyan-400' },
  race: { label: 'Race', chip: 'text-red-400 bg-red-400/10 border-red-400/30', ring: 'bg-red-400' },
  rest: { label: 'Rest', chip: 'text-foreground-muted bg-white/5 border-white/10', ring: 'bg-white/20' },
  other: { label: '?', chip: 'text-foreground-muted bg-white/5 border-white/10', ring: 'bg-white/20' },
}

function startOfMonday(d: Date): Date {
  const out = new Date(d)
  const day = out.getDay()
  const offset = day === 0 ? -6 : 1 - day
  out.setDate(out.getDate() + offset)
  out.setHours(0, 0, 0, 0)
  return out
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

function formatRange(start: string, endExclusive: string): string {
  const a = new Date(start)
  const b = new Date(endExclusive)
  b.setDate(b.getDate() - 1)
  const sameMonth = a.getMonth() === b.getMonth()
  const aLabel = a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const bLabel = b.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
  })
  return `${aLabel} – ${bLabel}`
}

function formatHours(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = minutes / 60
  const rounded = Math.round(h * 10) / 10
  return `${rounded}h`
}

interface WeekBucket {
  start: string
  end: string
  sessions: TrainingSession[]
  totalMin: number
  byDiscipline: Map<string, number>
}

function bucketByWeek(sessions: TrainingSession[], earliestIso: string): WeekBucket[] {
  if (sessions.length === 0) return []

  const earliest = new Date(earliestIso)
  const today = new Date()
  const firstMondayBack = startOfMonday(earliest)
  const lastMondayBack = startOfMonday(today)

  const buckets: WeekBucket[] = []
  for (let cursor = new Date(lastMondayBack); cursor >= firstMondayBack; cursor = addDays(cursor, -7)) {
    const start = isoDate(cursor)
    const end = isoDate(addDays(cursor, 7))
    buckets.push({
      start,
      end,
      sessions: [],
      totalMin: 0,
      byDiscipline: new Map(),
    })
  }

  for (const s of sessions) {
    const bucket = buckets.find(b => s.session_date >= b.start && s.session_date < b.end)
    if (!bucket) continue
    bucket.sessions.push(s)
    bucket.totalMin += s.duration_min ?? 0
    const type = (s.session_type ?? 'other') as string
    bucket.byDiscipline.set(type, (bucket.byDiscipline.get(type) ?? 0) + 1)
  }

  return buckets
}

function WeekRow({ bucket, isExpanded, onToggle }: {
  bucket: WeekBucket
  isExpanded: boolean
  onToggle: () => void
}) {
  const sessionCount = bucket.sessions.length
  const dominantDiscipline = Array.from(bucket.byDiscipline.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0]
  const dominant = dominantDiscipline ? DISCIPLINE_META[dominantDiscipline] ?? DISCIPLINE_META.other : null

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-white/[0.02]"
      >
        <div
          aria-hidden
          className={`h-10 w-1 shrink-0 rounded-full ${dominant?.ring ?? 'bg-white/10'} ${sessionCount === 0 ? 'opacity-30' : ''}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              {formatRange(bucket.start, bucket.end)}
            </p>
            <p className="text-xs text-foreground-muted">
              {sessionCount === 0 ? 'no sessions' : `${sessionCount} session${sessionCount === 1 ? '' : 's'} · ${formatHours(bucket.totalMin)}`}
            </p>
          </div>
          {sessionCount > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from(bucket.byDiscipline.entries()).map(([type, count]) => {
                const meta = DISCIPLINE_META[type] ?? DISCIPLINE_META.other
                return (
                  <span
                    key={type}
                    className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${meta.chip}`}
                  >
                    {meta.label}
                    {count > 1 && <span className="ml-0.5 opacity-60">×{count}</span>}
                  </span>
                )
              })}
            </div>
          )}
        </div>
        <span aria-hidden className={`text-foreground-muted transition ${isExpanded ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && sessionCount > 0 && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="border-t border-white/5 bg-background/40"
          >
            <ul className="divide-y divide-white/5 px-4">
              {bucket.sessions
                .slice()
                .sort((a, b) => a.session_date.localeCompare(b.session_date))
                .map(s => {
                  const meta = DISCIPLINE_META[(s.session_type ?? 'other')] ?? DISCIPLINE_META.other
                  const date = new Date(s.session_date)
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-3 text-sm">
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${meta.chip}`}
                      >
                        {meta.label}
                      </span>
                      <span className="w-16 shrink-0 text-xs text-foreground-muted">
                        {date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                      </span>
                      <span className="flex-1 truncate text-foreground">
                        {s.duration_min ? `${Math.round(s.duration_min)} min` : '—'}
                        {s.distance_km ? ` · ${s.distance_km.toFixed(2)} km` : ''}
                        {s.avg_hr ? ` · ${s.avg_hr} bpm` : ''}
                        {s.rpe ? ` · RPE ${s.rpe}` : ''}
                      </span>
                    </li>
                  )
                })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SessionRecap({ sessions, planStartDate }: Props) {
  const earliestIso = useMemo(() => {
    const ninetyDaysAgo = isoDate(addDays(new Date(), -90))
    if (planStartDate && planStartDate < ninetyDaysAgo) return planStartDate
    return ninetyDaysAgo
  }, [planStartDate])

  const buckets = useMemo(
    () => bucketByWeek(sessions, earliestIso),
    [sessions, earliestIso],
  )

  const [expanded, setExpanded] = useState<string | null>(null)

  const totalSessions = sessions.length
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_min ?? 0), 0)
  const weeksWithSessions = buckets.filter(b => b.sessions.length > 0).length

  if (totalSessions === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface px-6 py-8 text-center">
        <p className="text-sm text-foreground-muted">
          No sessions logged yet. Connect Strava or log a session to see your history here.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground-muted">
          Recap · {totalSessions} session{totalSessions === 1 ? '' : 's'}
        </h2>
        <p className="text-xs text-foreground-muted">
          {formatHours(totalMinutes)} across {weeksWithSessions} week{weeksWithSessions === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {buckets.map(bucket => (
          <WeekRow
            key={bucket.start}
            bucket={bucket}
            isExpanded={expanded === bucket.start}
            onToggle={() => setExpanded(prev => (prev === bucket.start ? null : bucket.start))}
          />
        ))}
      </div>
    </div>
  )
}
