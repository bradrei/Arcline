import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getActivity, mapStravaToSession, StravaReauthRequiredError, type StravaToken } from '@/lib/strava/client'
import { detectInjury } from '@/lib/ai/detectInjury'
import { saveSessionAndTriggerAdaptation } from '@/lib/sessions/save'

// GET — Strava webhook verification handshake
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (
    mode === 'subscribe' &&
    token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN &&
    challenge
  ) {
    return NextResponse.json({ 'hub.challenge': challenge })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST — new activity event from Strava
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    object_type: string
    aspect_type: string
    object_id: number
    owner_id: number
  }

  if (body.object_type !== 'activity' || body.aspect_type !== 'create') {
    return NextResponse.json({ ok: true })
  }

  // Use service role client — webhook has no user auth cookies
  const supabase = createServiceClient()

  // Find user by Strava athlete_id stored in strava_token jsonb
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, strava_token')
    .eq('strava_connected', true)
    .filter('strava_token->>athlete_id', 'eq', String(body.owner_id))
    .single()

  if (!profile) return NextResponse.json({ ok: true })

  const userId = profile.id as string
  const stravaToken = profile.strava_token as unknown as StravaToken

  try {
    // Deduplicate
    const { data: existing } = await supabase
      .from('sessions')
      .select('id')
      .eq('strava_activity_id', body.object_id)
      .single()

    if (existing) return NextResponse.json({ ok: true })

    const activity = await getActivity(stravaToken, body.object_id)
    const sessionData = mapStravaToSession(activity, userId)

    // HC2 check on name + description
    const injuryText = `${activity.name} ${activity.description ?? ''}`.trim()
    if (injuryText) {
      const { injured } = await detectInjury(injuryText, 'session_log')
      if (injured) {
        await supabase.from('injury_flags').insert({
          user_id: userId,
          trigger_text: injuryText,
          trigger_source: 'strava',
          referral_confirmed: false,
        })
        await supabase
          .from('plans')
          .update({ status: 'paused_injury' })
          .eq('user_id', userId)
          .eq('status', 'active')
      }
    }

    await saveSessionAndTriggerAdaptation(supabase, userId, sessionData)
  } catch (err) {
    console.error('Webhook activity processing failed:', err)
    // Reauth-required → flag the profile so the user sees a reconnect banner
    if (err instanceof StravaReauthRequiredError) {
      await supabase
        .from('profiles')
        .update({ strava_needs_reauth: true })
        .eq('id', userId)
    }
    // Return 200 so Strava does not retry — log failure for manual review
  }

  return NextResponse.json({ ok: true })
}
