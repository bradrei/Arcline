import EmailCapture from '@/app/_components/EmailCapture'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-6 sm:px-12">
        <span className="text-xl font-bold tracking-tight text-foreground">
          arc<span className="text-brand-teal">line</span>
        </span>
      </nav>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center sm:px-12">
        <div className="max-w-4xl">
          {/* Eyebrow */}
          <p className="mb-6 inline-block rounded-full border border-brand-teal/30 bg-brand-teal/10 px-4 py-1.5 text-sm font-medium text-brand-teal">
            Adaptive AI coaching for hybrid athletes
          </p>

          {/* Headline */}
          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Built for your goal.
            <br />
            <span className="text-brand-teal">Rebuilt for your week.</span>
          </h1>

          {/* Explainer */}
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-foreground-muted sm:text-xl">
            Most training plans are PDFs. They don&apos;t know you missed Tuesday. They don&apos;t
            know your Thursday run felt like survival. Arcline does — and it rewrites your week
            accordingly, every single time.
          </p>

          {/* Email capture */}
          <div className="flex justify-center">
            <EmailCapture />
          </div>

          {/* Micro-copy */}
          <p className="mt-6 text-sm text-foreground-muted">
            Free early access &middot; No credit card required
          </p>
        </div>
      </main>

      {/* Feature strip */}
      <section className="border-t border-white/5 px-6 py-16 sm:px-12">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          <FeaturePill
            icon="⚡"
            title="Adapts after every session"
            body="Log a session and your upcoming week rebuilds around what actually happened — pace, heart rate, effort, all of it."
          />
          <FeaturePill
            icon="🎯"
            title="Goal-anchored, always"
            body="Whether you're chasing a race date or a target pace, every adaptation keeps you on the line to that goal."
          />
          <FeaturePill
            icon="🛡️"
            title="Safety built in"
            body="Hard load limits and injury detection are enforced at the AI level — not recommendations, non-negotiable rules."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-sm text-foreground-muted sm:px-12">
        <p>© {new Date().getFullYear()} Arcline. All rights reserved.</p>
      </footer>
    </div>
  )
}

function FeaturePill({
  icon,
  title,
  body,
}: {
  icon: string
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-surface p-6">
      <div className="mb-3 text-2xl">{icon}</div>
      <h3 className="mb-2 font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-foreground-muted">{body}</p>
    </div>
  )
}
