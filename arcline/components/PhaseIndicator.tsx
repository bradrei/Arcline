'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Plan } from '@/types'
import { computePhase, formatGoalSuffix } from '@/lib/plan/phase'
import { PlanTimelineView } from './PlanTimelineView'

interface Props {
  plan: Plan
  currentWeekIndex: number
}

export function PhaseIndicator({ plan, currentWeekIndex }: Props) {
  const [open, setOpen] = useState(false)

  const totalWeeks = plan.weeks.length
  const weekNumber = currentWeekIndex + 1
  const phase = computePhase(weekNumber, totalWeeks)
  const goal = (plan.goal_anchor ?? {}) as {
    goal_type?: string | null
    goal_date?: string | null
    goal_description?: string | null
  }
  const suffix = formatGoalSuffix(goal.goal_type, goal.goal_date, goal.goal_description)

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.98 }}
        className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-surface px-4 py-3 text-left transition hover:border-white/20"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-semibold text-foreground">
            Week {weekNumber} of {totalWeeks}
          </span>
          <span className="text-foreground-muted">·</span>
          <span className="rounded-md bg-brand-teal/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-brand-teal">
            {phase} Phase
          </span>
          <span className="text-foreground-muted">·</span>
          <span className="text-foreground-muted">{suffix}</span>
        </div>
        <span
          aria-hidden
          className="text-foreground-muted transition group-hover:text-foreground"
        >
          ▾
        </span>
      </motion.button>

      <PlanTimelineView
        plan={plan}
        currentWeekIndex={currentWeekIndex}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
