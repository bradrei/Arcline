'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signUp } from '@/lib/auth/actions'

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUp, null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-foreground-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isPending}
          className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40 disabled:opacity-50"
          placeholder="you@example.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-foreground-muted">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={isPending}
          className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40 disabled:opacity-50"
          placeholder="Minimum 8 characters"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-xl bg-brand-teal px-6 py-3 font-semibold text-background transition hover:bg-brand-teal-dim active:scale-95 disabled:opacity-50 cursor-pointer"
      >
        {isPending ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-center text-sm text-foreground-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-teal hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
