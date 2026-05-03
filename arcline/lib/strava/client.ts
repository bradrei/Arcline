import type { NewSession, SessionType } from '@/types'

const STRAVA_API = 'https://www.strava.com/api/v3'

export interface StravaToken {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete_id: number
}

interface StravaActivity {
  id: number
  name: string
  sport_type: string
  moving_time: number
  distance: number
  start_date_local: string
  average_heartrate?: number
  max_heartrate?: number
  average_speed?: number
  description?: string
  average_watts?: number
}

export class StravaReauthRequiredError extends Error {
  constructor(message = 'Strava token refresh failed — user must reauthorize') {
    super(message)
    this.name = 'StravaReauthRequiredError'
  }
}

async function refreshIfNeeded(token: StravaToken): Promise<StravaToken> {
  if (Date.now() / 1000 < token.expires_at - 60) return token

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
    }),
  })

  if (!res.ok) throw new StravaReauthRequiredError()

  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_at: number
  }
  return { ...data, athlete_id: token.athlete_id }
}

async function fetchWithRetry(url: string, accessToken: string): Promise<Response> {
  let delay = 1000
  let lastError: Error = new Error('Rate limit exceeded')

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.status !== 429) return res
    lastError = new Error(`Rate limited on attempt ${attempt + 1}`)
    if (attempt < 3) await new Promise(r => setTimeout(r, delay))
    delay *= 2
  }

  throw lastError
}

export async function exchangeToken(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_at: number
  athlete: { id: number }
}> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) throw new Error('Strava token exchange failed')
  return res.json()
}

export async function getActivity(
  token: StravaToken,
  activityId: number,
): Promise<StravaActivity> {
  const refreshed = await refreshIfNeeded(token)
  const res = await fetchWithRetry(
    `${STRAVA_API}/activities/${activityId}`,
    refreshed.access_token,
  )
  if (!res.ok) throw new Error(`Failed to fetch activity ${activityId}`)
  return res.json()
}

export async function getAthleteActivities(
  token: StravaToken,
  perPage = 10,
): Promise<{ activities: StravaActivity[]; refreshedToken: StravaToken }> {
  const refreshed = await refreshIfNeeded(token)
  const res = await fetchWithRetry(
    `${STRAVA_API}/athlete/activities?per_page=${perPage}`,
    refreshed.access_token,
  )
  if (!res.ok) throw new Error('Failed to fetch Strava activities')
  const activities = await res.json() as StravaActivity[]
  return { activities, refreshedToken: refreshed }
}

function formatPace(metersPerSecond: number): string {
  const minPerKm = 1000 / (metersPerSecond * 60)
  const mins = Math.floor(minPerKm)
  const secs = Math.round((minPerKm - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function mapStravaToSession(
  activity: StravaActivity,
  userId: string,
): NewSession {
  const sessionDate = activity.start_date_local.split('T')[0]
  const rawType = activity.sport_type.toLowerCase().replace(/\s+/g, '_')
  const knownTypes: SessionType[] = ['swim', 'bike', 'run', 'brick', 'strength', 'rest', 'open_water', 'race']
  const sessionType: SessionType = knownTypes.includes(rawType as SessionType)
    ? (rawType as SessionType)
    : 'other'

  return {
    user_id: userId,
    plan_session_ref: null,
    session_date: sessionDate,
    input_method: 'strava',
    session_type: sessionType,
    duration_min: Math.round(activity.moving_time / 60),
    distance_km: activity.distance
      ? parseFloat((activity.distance / 1000).toFixed(2))
      : null,
    avg_hr: activity.average_heartrate ?? null,
    max_hr: activity.max_heartrate ?? null,
    avg_pace: activity.average_speed ? formatPace(activity.average_speed) : null,
    power_watts: activity.average_watts ?? null,
    notes: activity.description ?? null,
    raw_data: activity as unknown as Record<string, unknown>,
    strava_activity_id: activity.id,
    rpe: null,
  }
}
