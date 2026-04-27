'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/app/dashboard', label: 'Dashboard' },
  { href: '/app/plan', label: 'Plan' },
  { href: '/app/log', label: 'Log' },
  { href: '/app/coach', label: 'Coach' },
]

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav className="sticky bottom-0 border-t border-white/10 bg-background/95 px-6 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-2xl justify-around">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium transition ${
                active ? 'text-brand-teal' : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
