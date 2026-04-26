'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

export interface WeekLoad {
  weekStart: string
  loadMinutes: number
}

interface Props {
  data: WeekLoad[]
}

const W = 320
const H = 72
const PAD = 8

function buildPoints(data: WeekLoad[]): string {
  if (data.length < 2) return ''
  const maxLoad = Math.max(...data.map(d => d.loadMinutes), 1)
  return data
    .map((d, i) => {
      const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
      const y = H - PAD - (d.loadMinutes / maxLoad) * (H - PAD * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function formatWeek(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

export function LoadTrendGraph({ data }: Props) {
  const polyRef = useRef<SVGPolylineElement>(null)
  const [length, setLength] = useState(0)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null)
  const points = buildPoints(data)

  useEffect(() => {
    if (polyRef.current) setLength(polyRef.current.getTotalLength())
  }, [points])

  if (data.length < 2) {
    return (
      <div className="flex h-[88px] items-center justify-center">
        <p className="text-sm text-foreground-muted">Keep logging to see your load trend.</p>
      </div>
    )
  }

  const maxLoad = Math.max(...data.map(d => d.loadMinutes), 1)

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%" height={H}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Invisible hit areas for tooltip */}
        {data.map((d, i) => {
          const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
          const y = H - PAD - (d.loadMinutes / maxLoad) * (H - PAD * 2)
          return (
            <rect
              key={i}
              x={x - 12} y={0} width={24} height={H}
              fill="transparent"
              onMouseEnter={() => setTooltip({ x, y, label: `Week of ${formatWeek(d.weekStart)}: ${d.loadMinutes} min` })}
            />
          )
        })}

        {/* Sparkline — animated draw */}
        {length > 0 && (
          <motion.polyline
            ref={polyRef}
            points={points}
            fill="none"
            stroke="#00D4A8"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={length}
            initial={{ strokeDashoffset: length }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        )}
        {/* Render polyline first to get length, invisible until animated */}
        {length === 0 && (
          <polyline
            ref={polyRef}
            points={points}
            fill="none"
            stroke="transparent"
            strokeWidth={2}
          />
        )}

        {/* Dot at each data point */}
        {data.map((d, i) => {
          const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
          const y = H - PAD - (d.loadMinutes / maxLoad) * (H - PAD * 2)
          return (
            <motion.circle
              key={i}
              cx={x} cy={y} r={3}
              fill="#00D4A8"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.0 + i * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
            />
          )
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute rounded-lg border border-white/10 bg-surface px-2.5 py-1.5 text-xs text-foreground-muted shadow-lg"
          style={{
            left: `${(tooltip.x / W) * 100}%`,
            top: tooltip.y - 40,
            transform: 'translateX(-50%)',
          }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  )
}
