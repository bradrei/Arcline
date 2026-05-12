import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAthleteActivities, type StravaToken } from '@/lib/strava/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Founder-gated diagnostic. Calls Strava's /athlete/activities directly,
 * returns the granted scope + raw counts so we can see exactly what Strava
 * is returning vs what the user thinks should be there.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const founderEmail = process.env.FOUNDER_EMAIL
  if (!founderEmail || user.email !== founderEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('strava_connected, strava_token, strava_needs_reauth')
    .eq('id', user.id)
    .single()

  if (!profile?.strava_connected || !profile.strava_token) {
    return NextResponse.json({ error: 'Strava not connected' }, { status: 400 })
  }

  const token = profile.strava_token as unknown as StravaToken & { scope?: string }
  const after = Math.floor((+new Date() - 90 * 24 * 60 * 60 * 1000) / 1000)

  const pages: Array<{
    page: number
    count: number
    sampleNames: string[]
    sampleDates: string[]
  }> = []

  try {
    for (let page = 1; page <= 5; page++) {
      const { activities } = await getAthleteActivities(token, {
        perPage: 100,
        after,
        page,
      })
      pages.push({
        page,
        count: activities.length,
        sampleNames: activities.slice(0, 3).map(a => a.name),
        sampleDates: activities.slice(0, 3).map(a => a.start_date_local),
      })
      if (activities.length < 100) break
    }
  } catch (err) {
    return NextResponse.json({
      error: 'Strava API call failed',
      detail: err instanceof Error ? err.message : String(err),
      token_info: {
        has_access_token: Boolean(token.access_token),
        has_refresh_token: Boolean(token.refresh_token),
        athlete_id: token.athlete_id,
        expires_at: token.expires_at,
        expires_at_iso: token.expires_at
          ? new Date(token.expires_at * 1000).toISOString()
          : null,
        scope_field: token.scope ?? '(scope field not present on token)',
        needs_reauth: profile.strava_needs_reauth,
      },
    })
  }

  return NextResponse.json({
    after_unix: after,
    after_iso: new Date(after * 1000).toISOString(),
    total_returned: pages.reduce((sum, p) => sum + p.count, 0),
    pages,
    token_info: {
      athlete_id: token.athlete_id,
      expires_at: token.expires_at,
      expires_at_iso: token.expires_at
        ? new Date(token.expires_at * 1000).toISOString()
        : null,
      scope_field: token.scope ?? '(scope field not stored — likely missing from token capture)',
      needs_reauth: profile.strava_needs_reauth,
    },
  })
}
