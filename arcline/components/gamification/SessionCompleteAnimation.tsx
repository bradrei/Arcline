'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useArclineStore } from '@/store/arclineStore'
import { useCountUp } from '@/hooks/useCountUp'

const RING_RADIUS = 54
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function StatBlock({ label, value, unit }: { label: string; value: number; unit: string }) {
  const displayed = useCountUp(value, 1200)
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-3xl font-bold text-foreground">{displayed}<span className="ml-0.5 text-lg font-normal text-foreground-muted">{unit}</span></span>
      <span className="text-sm text-foreground-muted">{label}</span>
    </div>
  )
}

function CompletionRing() {
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="64" cy="64" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
      <motion.circle
        cx="64" cy="64" r={RING_RADIUS}
        fill="none" stroke="#00D4A8" strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 1.0, ease: 'easeOut', delay: 0.2 }}
      />
    </svg>
  )
}

export function SessionCompleteAnimation() {
  const showSessionComplete = useArclineStore(s => s.showSessionComplete)
  const sessionCompleteData = useArclineStore(s => s.sessionCompleteData)
  const dismissSessionComplete = useArclineStore(s => s.dismissSessionComplete)
  useEffect(() => {
    if (!showSessionComplete) return
    const t = setTimeout(dismissSessionComplete, 2500)
    return () => clearTimeout(t)
  }, [showSessionComplete, dismissSessionComplete])

  const data = sessionCompleteData ?? { duration_min: 0, distance_km: null, rpe: null }

  return (
    <AnimatePresence>
      {showSessionComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/97 backdrop-blur-sm"
        >
          {/* Particle burst */}
          <div className="relative mb-6 flex items-center justify-center">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="particle" />
            ))}
            <CompletionRing />
            <div className="absolute flex flex-col items-center justify-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 280, damping: 22 }}
                className="text-3xl"
              >
                ✓
              </motion.span>
            </div>
          </div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 24 }}
            className="mb-6 text-2xl font-bold text-foreground"
          >
            Session complete
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 240, damping: 24 }}
            className="flex gap-8"
          >
            <StatBlock label="Duration" value={data.duration_min} unit="min" />
            {data.distance_km != null && data.distance_km > 0 && (
              <StatBlock label="Distance" value={Math.round(data.distance_km * 10) / 10} unit="km" />
            )}
            {data.rpe != null && (
              <StatBlock label="RPE" value={data.rpe} unit="/10" />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
