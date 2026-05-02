'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import type { Adaptation, PlanSession } from '@/types'
import { computeAdaptationDiff, summarizeSession } from '@/lib/adaptations/diff'

interface Props {
  open: boolean
  session: PlanSession | null
  adaptations: Adaptation[]
  onClose: () => void
}

const INTENSITY_STYLE: Record<string, string> = {
  easy: 'text-green-400 bg-green-400/10',
  moderate: 'text-yellow-400 bg-yellow-400/10',
  hard: 'text-orange-400 bg-orange-400/10',
  race_pace: 'text-red-400 bg-red-400/10',
}

function formatDuration(min: number): string {
  if (min === 0) return 'Rest day'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function formatDate(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function buildAskCoachPrefill(s: PlanSession): string {
  const monthDay = s.date
    ? new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null
  if (s.type === 'rest') {
    return `Tell me about my ${s.day} rest day${monthDay ? ` (${monthDay})` : ''}`
  }
  const typeLabel = s.type.replace('_', ' ')
  return monthDay
    ? `Tell me about my ${s.day} ${typeLabel} on ${monthDay}`
    : `Tell me about my ${s.day} ${typeLabel} session`
}

function formatTriggerType(type: string | null): string {
  switch (type) {
    case 'session_performance':
      return 'After your last session'
    case 'missed':
      return 'After a missed session'
    case 'reduced':
      return 'After a shortened session'
    case 'extended':
      return 'After an extended session'
    case 'added':
      return 'After an added session'
    case 'injury_return':
      return 'After your return from injury'
    default:
      return 'Plan adjusted'
  }
}

export function SessionDetailSheet({ open, session, adaptations, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && session && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-40 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            key="sheet"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            onClick={e => e.stopPropagation()}
            className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-surface p-6 shadow-2xl sm:rounded-3xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted transition hover:bg-white/5 hover:text-foreground"
            >
              ✕
            </button>

            <div className="mb-4">
              <p className="text-xs uppercase tracking-wider text-foreground-muted">
                {formatDate(session.date) ?? session.day}
              </p>
              <h3 className="mt-1 text-xl font-bold text-foreground">
                {session.type === 'rest'
                  ? 'Rest day'
                  : `${formatDuration(session.duration_min)} ${session.type}`}
              </h3>
              {session.type !== 'rest' && (
                <span
                  className={`mt-2 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
                    INTENSITY_STYLE[session.intensity] ?? ''
                  }`}
                >
                  {session.intensity.replace('_', ' ')}
                </span>
              )}
            </div>

            {session.type !== 'rest' && session.description && (
              <p className="mb-5 text-sm leading-relaxed text-foreground-muted">
                {session.description}
              </p>
            )}

            {(session.target_pace || session.target_hr_zone != null) && (
              <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl border border-white/5 bg-background/40 p-3 text-xs">
                {session.target_pace && (
                  <div>
                    <p className="text-foreground-muted">Target pace</p>
                    <p className="mt-1 font-semibold text-foreground">{session.target_pace}</p>
                  </div>
                )}
                {session.target_hr_zone != null && (
                  <div>
                    <p className="text-foreground-muted">HR zone</p>
                    <p className="mt-1 font-semibold text-foreground">Z{session.target_hr_zone}</p>
                  </div>
                )}
              </div>
            )}

            {adaptations.length > 0 && (
              <div className="mb-5 rounded-2xl border border-brand-teal/20 bg-brand-teal/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand-teal" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-teal">
                    Adapted
                  </h4>
                </div>
                {adaptations.map(a => {
                  const change = computeAdaptationDiff(a.plan_before, a.plan_after).find(
                    c => c.date === session.date,
                  )
                  return (
                    <div key={a.id} className="mt-3 first:mt-0">
                      <p className="text-xs text-foreground-muted">
                        {formatTriggerType(a.trigger_type)} ·{' '}
                        {new Date(a.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      {a.ai_reasoning && (
                        <p className="mt-1 text-sm leading-relaxed text-foreground">
                          {a.ai_reasoning}
                        </p>
                      )}
                      {change && change.type === 'modified' && (
                        <p className="mt-2 text-xs text-foreground-muted">
                          <span className="line-through opacity-60">
                            {summarizeSession(change.before)}
                          </span>{' '}
                          → <span className="text-foreground">{summarizeSession(change.after)}</span>
                        </p>
                      )}
                      {change && change.type === 'added' && (
                        <p className="mt-2 text-xs text-foreground-muted">
                          Added: <span className="text-foreground">{summarizeSession(change.after)}</span>
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {session.type !== 'rest' && (
                <Link
                  href="/app/log"
                  onClick={onClose}
                  className="block rounded-xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-3 text-center text-sm font-semibold text-brand-teal transition hover:bg-brand-teal/20"
                >
                  Log this session
                </Link>
              )}
              <Link
                href={`/app/coach?prefill=${encodeURIComponent(buildAskCoachPrefill(session))}`}
                onClick={onClose}
                className="block rounded-xl border border-white/10 bg-surface px-4 py-3 text-center text-sm font-semibold text-foreground-muted transition hover:border-white/20 hover:text-foreground"
              >
                Ask coach about this session
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
