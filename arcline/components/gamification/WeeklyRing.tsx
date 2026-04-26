'use client'

import { motion } from 'framer-motion'

interface Props {
  percent: number
}

const SIZE = 56
const STROKE = 5
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function WeeklyRing({ percent }: Props) {
  const clamped = Math.min(100, Math.max(0, percent))
  const isComplete = clamped >= 100
  const offset = CIRCUMFERENCE * (1 - clamped / 100)
  const color = isComplete ? '#FFD700' : '#00D4A8'

  if (clamped === 0) {
    return (
      <div className="flex flex-col items-center gap-1">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE}
          />
        </svg>
        <p className="text-center text-xs text-foreground-muted" style={{ fontSize: 10 }}>Start</p>
      </div>
    )
  }

  return (
    <div className="relative flex items-center justify-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE}
        />
        <motion.circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none" stroke={color} strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{
            strokeDashoffset: offset,
            ...(isComplete ? { scale: [1, 1.08, 1] } : {}),
          }}
          transition={{ duration: 0.8, type: 'spring', stiffness: 120, damping: 18 }}
        />
      </svg>
      <span
        className="absolute text-xs font-bold"
        style={{ color, fontSize: 11 }}
      >
        {clamped}%
      </span>
    </div>
  )
}
