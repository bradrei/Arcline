'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Adaptation, PlanSession } from '@/types'
import { SessionDetailSheet } from './SessionDetailSheet'

interface AnimatedSessionCardsProps {
  sessions: PlanSession[]
  adaptedDates?: Set<string>
  adaptations?: Adaptation[]
}

const TYPE_LABEL: Record<string, string> = {
  swim: 'SWIM', bike: 'BIKE', run: 'RUN', brick: 'BRICK',
  strength: 'STR', rest: 'REST', open_water: 'OW', race: 'RACE', other: 'OTHER',
}
const TYPE_COLOR: Record<string, string> = {
  swim: 'text-blue-400 bg-blue-400/10',
  bike: 'text-yellow-400 bg-yellow-400/10',
  run: 'text-green-400 bg-green-400/10',
  brick: 'text-purple-400 bg-purple-400/10',
  strength: 'text-orange-400 bg-orange-400/10',
  race: 'text-red-400 bg-red-400/10',
  rest: 'text-foreground-muted bg-white/5',
  other: 'text-foreground-muted bg-white/5',
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

function PulseDot() {
  return (
    <motion.span
      aria-label="Recently adapted"
      className="absolute right-3 top-3 h-2 w-2 rounded-full bg-brand-teal shadow-[0_0_0_2px_rgba(0,212,168,0.25)]"
      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

function SessionCard({
  session,
  isAdapted,
  onOpen,
}: {
  session: PlanSession
  isAdapted: boolean
  onOpen: () => void
}) {
  const isRest = session.type === 'rest'
  const typeColor = TYPE_COLOR[session.type] ?? TYPE_COLOR.other
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative flex w-52 flex-shrink-0 flex-col gap-3 rounded-2xl border border-white/10 bg-surface p-4 text-left transition hover:border-white/20 ${
        isRest ? 'opacity-50' : ''
      }`}
    >
      {isAdapted && <PulseDot />}
      <div className="flex items-center justify-between">
        <span className={`rounded-lg px-2 py-1 text-xs font-bold tracking-wide ${typeColor}`}>
          {TYPE_LABEL[session.type] ?? session.type.toUpperCase()}
        </span>
        <span className="text-xs text-foreground-muted">{session.day.slice(0, 3)}</span>
      </div>
      {isRest ? (
        <p className="text-sm font-medium text-foreground-muted">Rest & recover</p>
      ) : (
        <>
          <div>
            <p className="text-lg font-bold text-foreground">{formatDuration(session.duration_min)}</p>
            <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${INTENSITY_STYLE[session.intensity] ?? ''}`}>
              {session.intensity.replace('_', ' ')}
            </span>
          </div>
          <p className="line-clamp-3 text-xs leading-relaxed text-foreground-muted">{session.description}</p>
          <p className="mt-auto text-[11px] font-medium text-brand-teal">View details →</p>
        </>
      )}
    </button>
  )
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
}

export function AnimatedSessionCards({
  sessions,
  adaptedDates,
  adaptations = [],
}: AnimatedSessionCardsProps) {
  const [openSession, setOpenSession] = useState<PlanSession | null>(null)
  const sheetAdaptations = openSession?.date
    ? adaptations.filter(a =>
        (a.plan_after?.weeks ?? []).some(w =>
          (w.sessions ?? []).some(s => s.date === openSession.date),
        ),
      )
    : []

  return (
    <>
      <motion.div
        className="flex gap-3"
        style={{ width: 'max-content' }}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {sessions.map((session, i) => {
          const isAdapted = Boolean(session.date && adaptedDates?.has(session.date))
          return (
            <motion.div
              key={`${session.day}-${i}`}
              variants={cardVariants}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            >
              <SessionCard
                session={session}
                isAdapted={isAdapted}
                onOpen={() => setOpenSession(session)}
              />
            </motion.div>
          )
        })}
      </motion.div>
      <SessionDetailSheet
        open={openSession !== null}
        session={openSession}
        adaptations={sheetAdaptations}
        onClose={() => setOpenSession(null)}
      />
    </>
  )
}
