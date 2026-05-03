import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { regenerateActivePlan } from '@/lib/onboarding/actions'
import type { Plan, Profile } from '@/types'

export const metadata = { title: 'Settings — Arcline' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SearchParams = Promise<{
  plan?: string
  error?: string
}>

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, planResult, sessionsCountResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('plans')
      .select('id, version, is_fallback, weeks, generated_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  const profile = profileResult.data as Profile | null
  const plan = planResult.data as Pick<Plan, 'id' | 'version' | 'is_fallback' | 'weeks' | 'generated_at'> | null
  const sessionsCount = sessionsCountResult.count ?? 0

  const planWeekCount = Array.isArray(plan?.weeks) ? plan?.weeks.length : 0

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Settings</h1>
      <p className="mb-8 text-sm text-foreground-muted">
        {profile?.goal_description
          ? `Goal: ${profile.goal_description}`
          : 'No goal description on profile.'}
      </p>

      {params.error === 'plan_insert_failed' && (
        <div className="mb-6 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3">
          <p className="text-sm text-red-300">
            Couldn&apos;t save the regenerated plan. Try again, or check the build logs.
          </p>
        </div>
      )}
      {params.error === 'profile_missing' && (
        <div className="mb-6 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3">
          <p className="text-sm text-red-300">Profile not found.</p>
        </div>
      )}

      {/* Plan card */}
      <section className="mb-6 rounded-2xl border border-white/10 bg-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-foreground">Training plan</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {plan
                ? `Version ${plan.version} · ${planWeekCount} weeks · ${
                    plan.is_fallback ? 'Fallback' : 'AI-generated'
                  }`
                : 'No active plan.'}
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              {sessionsCount} session{sessionsCount === 1 ? '' : 's'} logged so far.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <form action={regenerateActivePlan}>
            <button
              type="submit"
              disabled={!profile}
              className="w-full rounded-xl bg-brand-teal px-5 py-3 text-sm font-semibold text-background transition hover:bg-brand-teal-dim disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer sm:w-auto"
            >
              Regenerate my plan with full history
            </button>
          </form>
          <p className="mt-2 text-xs text-foreground-muted">
            Archives the current plan and builds a new one using your profile and every logged session.
            Use this after importing Strava history or making big profile changes.
          </p>
        </div>
      </section>

      {/* Integrations link */}
      <Link
        href="/app/settings/integrations"
        className="block rounded-2xl border border-white/10 bg-surface p-6 transition hover:border-white/20"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Integrations</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Connect Strava, import history, manage data sources.
            </p>
          </div>
          <span className="text-foreground-muted">→</span>
        </div>
      </Link>
    </main>
  )
}
