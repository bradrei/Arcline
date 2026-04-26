'use client'

import { motion } from 'framer-motion'
import { useCountUp } from '@/hooks/useCountUp'

interface Props {
  streak: number
}

function FlameSvg({ active }: { active: boolean }) {
  return (
    <motion.svg
      width="18" height="22" viewBox="0 0 18 22" fill="none"
      animate={active ? { scaleY: [1, 1.08, 1] } : {}}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut' }}
      style={{ transformOrigin: 'bottom center' }}
    >
      {/* Outer flame */}
      <path
        d="M9 1C9 1 2 7 2 13C2 17.4 5.1 21 9 21C12.9 21 16 17.4 16 13C16 7 9 1 9 1Z"
        fill={active ? '#FF6B35' : '#4B5563'}
      />
      {/* Inner hot core */}
      <path
        d="M9 8C9 8 5.5 12 5.5 14.5C5.5 16.4 7.1 18 9 18C10.9 18 12.5 16.4 12.5 14.5C12.5 12 9 8 9 8Z"
        fill={active ? '#FFD700' : '#6B7280'}
      />
    </motion.svg>
  )
}

export function StreakCounter({ streak }: Props) {
  const displayed = useCountUp(streak, 700)
  const active = streak > 0

  if (!active) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <FlameSvg active={false} />
        <p className="text-xs text-foreground-muted">0 days</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        <FlameSvg active={true} />
        <span className="text-lg font-bold text-foreground">{displayed}</span>
      </div>
      <p className="text-xs text-foreground-muted">{streak === 1 ? '1 day' : `${streak} days`}</p>
    </div>
  )
}
