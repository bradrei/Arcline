'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Adaptation, Plan } from '@/types'
import { PlanWeekView } from './PlanWeekView'
import { PlanTimelineView } from './PlanTimelineView'

type Mode = 'week' | 'four_weeks' | 'full'

interface Props {
  plan: Plan
  currentWeekIndex: number
  adaptedDates?: Set<string>
  adaptations?: Adaptation[]
}

const TABS: { value: Mode; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'four_weeks', label: 'Next 4 weeks' },
  { value: 'full', label: 'Full plan' },
]

export function PlanViewModes({ plan, currentWeekIndex, adaptedDates, adaptations }: Props) {
  const [mode, setMode] = useState<Mode>('week')
  const [timelineOpen, setTimelineOpen] = useState(false)

  function handleTabClick(next: Mode) {
    if (next === 'full') {
      setTimelineOpen(true)
      return
    }
    setMode(next)
  }

  const weeksToRender =
    mode === 'four_weeks'
      ? plan.weeks.slice(currentWeekIndex, currentWeekIndex + 4)
      : [plan.weeks[currentWeekIndex]].filter(Boolean)

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-xl border border-white/5 bg-surface p-1">
        {TABS.map(tab => {
          const isActive = (tab.value === 'full' && timelineOpen) || (tab.value !== 'full' && mode === tab.value)
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabClick(tab.value)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                isActive
                  ? 'bg-brand-teal/15 text-brand-teal'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-6"
      >
        {weeksToRender.map((week, i) => (
          <div key={`${mode}-${i}`}>
            {mode === 'four_weeks' && (
              <p className="mb-2 text-xs uppercase tracking-wider text-foreground-muted">
                Week {week.week_number ?? currentWeekIndex + i + 1}
              </p>
            )}
            <PlanWeekView
              week={week}
              adaptedDates={adaptedDates}
              adaptations={adaptations}
            />
          </div>
        ))}
      </motion.div>

      <PlanTimelineView
        plan={plan}
        currentWeekIndex={currentWeekIndex}
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
      />
    </div>
  )
}
