import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeToken, getAthleteActivities, mapStravaToSession, type StravaToken } from '@/lib/strava/client'
import { detectInjury } from '@/lib/ai/detectInjury'

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl()}/app/settings/integrations?error=strava_denied`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${baseUrl()}/login`)
  }

  try {
    const tokenData = await exchangeToken(code)
    const stravaToken: StravaToken = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      athlete_id: tokenData.athlete.id,
    }

    // Store token + mark connected, clear reauth flag if it was set
    await supabase
      .from('profiles')
      .update({
        strava_connected: true,
        strava_token: stravaToken as unknown as Record<string, unknown>,
        strava_needs_reauth: false,
      })
      .eq('id', user.id)

    // Import last 10 activities — deduplicate by strava_activity_id
    const { activities } = await getAthleteActivities(stravaToken, 10)

    for (const activity of activities) {
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('strava_activity_id', activity.id)
        .single()

      if (existing) continue

      const sessionData = mapStravaToSession(activity, user.id)

      // HC2 check on activity name + description
      const injuryText = `${activity.name} ${activity.description ?? ''}`.trim()
      if (injuryText) {
        const { injured } = await detectInjury(injuryText, 'session_log')
        if (injured) {
          await supabase.from('injury_flags').insert({
            user_id: user.id,
            trigger_text: injuryText,
            trigger_source: 'strava',
            referral_confirmed: false,
          })
        }
      }

      await supabase.from('sessions').insert(sessionData)
    }
  } catch (err) {
    console.error('Strava callback error:', err)
    return NextResponse.redirect(
      `${baseUrl()}/app/settings/integrations?error=strava_failed`,
    )
  }

  return NextResponse.redirect(`${baseUrl()}/app/dashboard?strava=connected`)
}
