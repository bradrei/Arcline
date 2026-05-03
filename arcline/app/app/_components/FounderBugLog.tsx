'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { submitFounderBug } from '@/lib/founder/actions'

export function FounderBugLog() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function closeModal() {
    setOpen(false)
    setError(null)
    setSubmitted(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      const result = await submitFounderBug(message, pageUrl, ua)
      if (result.error) {
        setError(result.error)
      } else {
        setSubmitted(true)
        setMessage('')
      }
    } catch {
      setError("Couldn't send. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        className="fixed bottom-20 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/30 bg-background/95 text-amber-300 shadow-lg backdrop-blur transition hover:border-amber-400/50 hover:bg-amber-400/10"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect x="4" y="6" width="16" height="14" rx="3" />
          <path d="M9 13h6" />
          <path d="M9 17h6" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="bug-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeModal}
            className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center sm:p-6"
          >
            <motion.div
              key="bug-sheet"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-md rounded-t-3xl border border-white/10 bg-surface p-6 shadow-2xl sm:rounded-3xl"
            >
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted transition hover:bg-white/5 hover:text-foreground"
              >
                ✕
              </button>

              {submitted ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
                    ✓
                  </div>
                  <p className="text-sm text-foreground">Logged. Thanks for tagging it.</p>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-xs font-medium text-foreground-muted underline"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">What&apos;s broken or feels off?</h2>
                    <p className="mt-1 text-xs text-foreground-muted">
                      Page URL + user agent are captured automatically.
                    </p>
                  </div>
                  <textarea
                    autoFocus
                    rows={5}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="What you saw, what you expected, what felt wrong…"
                    className="w-full resize-none rounded-xl border border-white/10 bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-foreground-muted focus:border-amber-400/50"
                  />
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-xl px-4 py-2 text-sm text-foreground-muted transition hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !message.trim()}
                      className="rounded-xl bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
