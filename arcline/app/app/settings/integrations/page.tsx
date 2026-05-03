import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { disconnectStrava } from '@/lib/sessions/actions'

export const metadata = { title: 'Integrations — Arcline' }

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; strava?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('strava_connected, strava_needs_reauth')
    .eq('id', user.id)
    .single()

  const stravaConnected = profile?.strava_connected ?? false
  const stravaNeedsReauth = Boolean(profile?.strava_needs_reauth)

  const stravaConfigured =
    process.env.STRAVA_CLIENT_ID && !process.env.STRAVA_CLIENT_ID.startsWith('your-')

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-8">
      <h1 className="mb-8 text-2xl font-bold text-foreground">Integrations</h1>

      {params.error === 'strava_denied' && (
        <div className="mb-6 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3">
          <p className="text-sm text-red-400">Strava connection was cancelled.</p>
        </div>
      )}
      {params.error === 'strava_failed' && (
        <div className="mb-6 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3">
          <p className="text-sm text-red-400">
            Something went wrong connecting to Strava. Please try again.
          </p>
        </div>
      )}
      {params.strava === 'connected' && (
        <div className="mb-6 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3">
          <p className="text-sm text-brand-teal">
            Strava connected — last 10 activities imported.
          </p>
        </div>
      )}
      {stravaNeedsReauth && (
        <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
          <p className="text-sm font-semibold text-amber-300">
            Your Strava connection needs to be reauthorized.
          </p>
          <p className="mt-1 text-xs text-amber-200/80">
            Reconnect to keep syncing — webhook activity is paused until you do.
          </p>
        </div>
      )}

      {/* Strava card */}
      <div className="rounded-2xl border border-white/10 bg-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-foreground">Strava</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Auto-import activities via webhook. New sessions trigger plan adaptation.
            </p>
          </div>
          <div
            className={`mt-0.5 flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
              stravaConnected
                ? 'bg-brand-teal/10 text-brand-teal'
                : 'bg-white/5 text-foreground-muted'
            }`}
          >
            {stravaConnected ? 'Connected' : 'Not connected'}
          </div>
        </div>

        <div className="mt-6">
          {!stravaConfigured ? (
            <p className="text-sm text-foreground-muted">
              Strava integration requires{' '}
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">STRAVA_CLIENT_ID</code>{' '}
              and{' '}
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">STRAVA_CLIENT_SECRET</code>{' '}
              to be configured.
            </p>
          ) : stravaConnected ? (
            <form action={disconnectStrava}>
              <button
                type="submit"
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-foreground-muted transition hover:border-white/20 hover:text-foreground cursor-pointer"
              >
                Disconnect Strava
              </button>
            </form>
          ) : (
            <Link
              href="/api/strava/auth"
              className="inline-block rounded-xl bg-[#FC4C02] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Connect Strava
            </Link>
          )}
        </div>

        {stravaConnected && (
          <p className="mt-4 text-xs text-foreground-muted">
            New Strava activities are imported automatically via webhook.
          </p>
        )}
      </div>

      <div className="mt-4 text-xs text-foreground-muted">
        Before going live, register these redirect URIs in the{' '}
        <a
          href="https://www.strava.com/settings/api"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-teal hover:underline"
        >
          Strava Developer Portal
        </a>
        :{' '}
        <code className="rounded bg-white/5 px-1 py-0.5">http://localhost:3000/api/strava/callback</code>{' '}
        and{' '}
        <code className="rounded bg-white/5 px-1 py-0.5">[NEXT_PUBLIC_APP_URL]/api/strava/callback</code>.
      </div>
    </main>
  )
}
