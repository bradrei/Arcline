'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Adaptation } from '@/types'
import { computeAdaptationDiff, summarizeSession } from '@/lib/adaptations/diff'

const TRIGGER_LABEL: Record<string, string> = {
  session_performance: 'After your last session',
  missed: 'After a missed session',
  reduced: 'After a shortened session',
  extended: 'After an extended session',
  added: 'After an added session',
  injury_return: 'After your return from injury',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function formatChangeDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function AdaptationCard({ adaptation }: { adaptation: Adaptation }) {
  const [open, setOpen] = useState(false)
  const changes = computeAdaptationDiff(adaptation.plan_before, adaptation.plan_after)
  const triggerLabel =
    TRIGGER_LABEL[adaptation.trigger_type ?? ''] ?? 'Plan adjusted'

  return (
    <motion.div
      layout
      className="overflow-hidden rounded-2xl border border-white/10 bg-surface"
    >
      <div className="p-5">
        <p className="text-xs uppercase tracking-wider text-brand-teal">{triggerLabel}</p>
        <h3 className="mt-1 text-base font-semibold text-foreground">
          {formatDate(adaptation.created_at)}
        </h3>
        {adaptation.ai_reasoning && (
          <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
            {adaptation.ai_reasoning}
          </p>
        )}

        {(adaptation.load_before != null || adaptation.load_after != null) && (
          <p className="mt-3 text-xs text-foreground-muted">
            Weekly load:{' '}
            <span className="text-foreground">
              {Math.round(adaptation.load_before ?? 0)} → {Math.round(adaptation.load_after ?? 0)} weighted minutes
            </span>
          </p>
        )}

        {changes.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="mt-4 text-xs font-semibold text-brand-teal transition hover:text-brand-teal-dim"
          >
            {open ? 'Hide changes' : `View changes (${changes.length})`}
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && changes.length > 0 && (
          <motion.div
            key="diff"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/5 bg-background/40"
          >
            <ul className="divide-y divide-white/5 px-5">
              {changes.map((c, i) => (
                <li key={`${c.type}-${c.date}-${i}`} className="py-3 text-xs">
                  <p className="text-foreground-muted">{formatChangeDate(c.date)}</p>
                  {c.type === 'modified' && (
                    <p className="mt-0.5">
                      <span className="text-foreground-muted line-through opacity-60">
                        {summarizeSession(c.before)}
                      </span>{' '}
                      <span className="text-foreground-muted">→</span>{' '}
                      <span className="text-foreground">{summarizeSession(c.after)}</span>
                    </p>
                  )}
                  {c.type === 'added' && (
                    <p className="mt-0.5">
                      <span className="text-brand-teal">Added: </span>
                      <span className="text-foreground">{summarizeSession(c.after)}</span>
                    </p>
                  )}
                  {c.type === 'removed' && (
                    <p className="mt-0.5">
                      <span className="text-foreground-muted">Removed: </span>
                      <span className="text-foreground line-through opacity-60">
                        {summarizeSession(c.before)}
                      </span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function AdaptationHistoryList({ adaptations }: { adaptations: Adaptation[] }) {
  return (
    <div className="flex flex-col gap-3">
      {adaptations.map(a => (
        <AdaptationCard key={a.id} adaptation={a} />
      ))}
    </div>
  )
}
