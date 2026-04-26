'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useArclineStore } from '@/store/arclineStore'

export function AdaptationToast() {
  const showAdaptationToast = useArclineStore(s => s.showAdaptationToast)
  const adaptationReasoning = useArclineStore(s => s.adaptationReasoning)
  const dismissAdaptationToast = useArclineStore(s => s.dismissAdaptationToast)

  useEffect(() => {
    if (!showAdaptationToast) return
    const timer = setTimeout(dismissAdaptationToast, 6000)
    return () => clearTimeout(timer)
  }, [showAdaptationToast, dismissAdaptationToast])

  return (
    <AnimatePresence>
      {showAdaptationToast && (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-24 left-1/2 z-40 w-full max-w-sm -translate-x-1/2 px-4"
          onClick={dismissAdaptationToast}
        >
          <div className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-surface px-4 py-4 shadow-xl shadow-black/50">
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-brand-teal"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Your plan just adapted.</p>
              {adaptationReasoning && (
                <p className="mt-0.5 text-sm leading-relaxed text-foreground-muted">{adaptationReasoning}</p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
