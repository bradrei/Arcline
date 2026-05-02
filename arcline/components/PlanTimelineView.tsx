'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Plan, PlanWeek, PlanSession } from '@/types'

interface Props {
  plan: Plan
  currentWeekIndex: number
  open: boolean
  onClose: () => void
}

const DISCIPLINE_LABEL: Record<string, string> = {
  swim: 'S', bike: 'B', run: 'R', brick: 'Br',
  strength: 'St', open_water: 'OW', race: 'Race',
}
const DISCIPLINE_COLOR: Record<string, string> = {
  swim: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  bike: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  run: 'text-green-400 bg-green-400/10 border-green-400/30',
  brick: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  strength: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  open_water: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  race: 'text-red-400 bg-red-400/10 border-red-400/30',
}
const INTENSITY_STYLE: Record<string, string> = {
  easy: 'text-green-400 bg-green-400/10',
  moderate: 'text-yellow-400 bg-yellow-400/10',
  hard: 'text-orange-400 bg-orange-400/10',
  race_pace: 'text-red-400 bg-red-400/10',
}

function fmtMonthDay(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function dateRangeLabel(week: PlanWeek): string | null {
  if (!week.week_start) return null
  const start = new Date(week.week_start)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

function formatHours(min: number): string {
  const h = min / 60
  if (h < 1) return `${Math.round(min)}m`
  const rounded = Math.round(h * 2) / 2
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded}h`
}

function disciplineChips(sessions: PlanSession[]): { type: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const s of sessions) {
    if (s.type === 'rest' || s.type === 'other') continue
    counts.set(s.type, (counts.get(s.type) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([type, count]) => ({ type, count }))
}

function WeekCard({
  week,
  index,
  isCurrent,
  isPast,
  isRaceWeek,
  expanded,
  onToggle,
}: {
  week: PlanWeek
  index: number
  isCurrent: boolean
  isPast: boolean
  isRaceWeek: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const totalMin = week.sessions.reduce((sum, s) => sum + s.duration_min, 0)
  const activeSessions = week.sessions.filter(s => s.type !== 'rest').length
  const range = dateRangeLabel(week)
  const chips = disciplineChips(week.sessions)

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition ${
        isCurrent
          ? 'border-brand-teal/40 border-l-4 border-l-brand-teal bg-brand-teal/5'
          : 'border-white/10 bg-surface'
      } ${isPast ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-2 p-4 text-left transition hover:bg-white/[0.02]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-foreground">Week {week.week_number ?? index + 1}</span>
            {range && (
              <>
                <span className="text-foreground-muted">·</span>
                <span className="text-foreground-muted">{range}</span>
              </>
            )}
            <span className="text-foreground-muted">·</span>
            <span className="text-foreground-muted">{formatHours(totalMin)}</span>
            <span className="text-foreground-muted">·</span>
            <span className="text-foreground-muted">
              {activeSessions} session{activeSessions === 1 ? '' : 's'}
            </span>
          </div>
          {isRaceWeek && (
            <span className="shrink-0 rounded-md bg-red-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
              ⚑ Race day
            </span>
          )}
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map(({ type, count }) => (
              <span
                key={type}
                className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
                  DISCIPLINE_COLOR[type] ?? 'border-white/10 text-foreground-muted'
                }`}
              >
                {DISCIPLINE_LABEL[type] ?? type[0].toUpperCase()}
                {count > 1 && <span className="ml-0.5 opacity-60">×{count}</span>}
              </span>
            ))}
          </div>
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="border-t border-white/5 bg-background/40"
          >
            <ul className="divide-y divide-white/5 px-4">
              {week.sessions.map((s, i) => (
                <li key={`${s.day}-${i}`} className="flex items-start gap-3 py-3 text-sm">
                  <div className="w-12 shrink-0 text-xs font-medium text-foreground-muted">
                    {s.day.slice(0, 3)}
                  </div>
                  {s.type === 'rest' ? (
                    <span className="text-foreground-muted">Rest day</span>
                  ) : (
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {s.duration_min}min {s.type}
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                            INTENSITY_STYLE[s.intensity] ?? ''
                          }`}
                        >
                          {s.intensity.replace('_', ' ')}
                        </span>
                        {s.date && (
                          <span className="text-[10px] text-foreground-muted">
                            {fmtMonthDay(s.date)}
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <p className="text-xs leading-relaxed text-foreground-muted">
                          {s.description}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function PlanTimelineView({ plan, currentWeekIndex, open, onClose }: Props) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(currentWeekIndex)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const totalWeeks = plan.weeks.length
  const isEventGoal = useMemo(() => {
    const g = (plan.goal_anchor ?? {}) as { goal_type?: string | null }
    return g.goal_type === 'event_date'
  }, [plan])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-40 flex items-stretch justify-center bg-background/80 backdrop-blur-sm sm:items-center sm:p-6"
        >
          <motion.div
            key="sheet"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            onClick={e => e.stopPropagation()}
            className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-background sm:rounded-3xl sm:border sm:border-white/10 sm:shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">Plan timeline</h2>
                <p className="text-xs text-foreground-muted">
                  {totalWeeks} week{totalWeeks === 1 ? '' : 's'} · tap a week to expand
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-muted transition hover:bg-white/5 hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-3">
                {plan.weeks.map((week, i) => {
                  const isCurrent = i === currentWeekIndex
                  const isPast = i < currentWeekIndex
                  const isRaceWeek = isEventGoal && i === plan.weeks.length - 1
                  return (
                    <WeekCard
                      key={i}
                      week={week}
                      index={i}
                      isCurrent={isCurrent}
                      isPast={isPast}
                      isRaceWeek={isRaceWeek}
                      expanded={expandedWeek === i}
                      onToggle={() =>
                        setExpandedWeek(prev => (prev === i ? null : i))
                      }
                    />
                  )
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
