'use client'

import { useState } from 'react'

export default function EmailCapture() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error('Failed')
      setStatus('success')
      setEmail('')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-teal/30 bg-brand-teal/10 px-6 py-4">
        <span className="text-brand-teal text-xl">✓</span>
        <p className="text-brand-teal font-medium">You&apos;re on the list. We&apos;ll be in touch.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        disabled={status === 'loading'}
        className="flex-1 rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="rounded-xl bg-brand-teal px-6 py-3 font-semibold text-background transition hover:bg-brand-teal-dim active:scale-95 disabled:opacity-50 cursor-pointer"
      >
        {status === 'loading' ? 'Joining…' : 'Get early access'}
      </button>
      {status === 'error' && (
        <p className="w-full text-sm text-red-400 sm:col-span-2">
          Something went wrong. Try again.
        </p>
      )}
    </form>
  )
}
