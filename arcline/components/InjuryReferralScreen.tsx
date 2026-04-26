'use client'

import { useState } from 'react'
import { confirmInjuryReferral, dismissInjuryAsFalsePositive } from '@/lib/onboarding/actions'
import type { InjurySource } from '@/types'

interface InjuryReferralScreenProps {
  triggerText: string
  source: InjurySource
  onDismiss: () => void
}

export function InjuryReferralScreen({ triggerText, source, onDismiss }: InjuryReferralScreenProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)

  async function handleConfirm() {
    setIsConfirming(true)
    await confirmInjuryReferral()
    setIsConfirming(false)
    onDismiss()
  }

  async function handleFalsePositive() {
    setIsDismissing(true)
    await dismissInjuryAsFalsePositive(triggerText, source)
    setIsDismissing(false)
    onDismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-8">
        {/* Icon */}
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
          <span className="text-2xl">🛡️</span>
        </div>

        {/* Copy */}
        <h2 className="mb-3 text-2xl font-bold text-foreground">
          Let&apos;s make sure you&apos;re okay.
        </h2>
        <p className="mb-8 text-base leading-relaxed text-foreground-muted">
          It sounds like your body might be telling you something. Before we update
          your plan, it&apos;s worth getting a professional opinion.
        </p>

        {/* External link */}
        <a
          href="https://www.google.com/maps/search/sports+therapist+near+me"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 flex items-center gap-2 text-sm text-brand-teal hover:underline"
        >
          Find a sports therapist near me
          <span aria-hidden>↗</span>
        </a>

        {/* Primary CTA */}
        <button
          onClick={handleConfirm}
          disabled={isConfirming || isDismissing}
          className="w-full rounded-xl bg-brand-teal px-6 py-3.5 font-semibold text-background transition hover:bg-brand-teal-dim active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {isConfirming ? 'Confirming…' : "I've spoken to a professional"}
        </button>

        {/* False positive escape hatch */}
        <button
          onClick={handleFalsePositive}
          disabled={isConfirming || isDismissing}
          className="mt-4 w-full text-center text-sm text-foreground-muted transition hover:text-foreground disabled:opacity-50 cursor-pointer"
        >
          {isDismissing ? 'Dismissing…' : 'This was flagged by mistake'}
        </button>
      </div>
    </div>
  )
}
