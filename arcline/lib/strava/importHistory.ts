import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getAthleteActivities,
  mapStravaToSession,
  type StravaToken,
} from './client'

const PER_PAGE = 100
const MAX_PAGES = 5 // hard cap of 500 activities — plenty for 90 days

interface ImportResult {
  imported: number
  skipped: number
  pages: number
}

/**
 * Bulk import the last `days` days of Strava activities for a user.
 *
 * Notes:
 * - HC2 is intentionally NOT run on bulk import. The webhook handles HC2 for
 *   ongoing activity going forward; 90-day-old descriptions aren't actionable
 *   now. See Session 14 decisions in CLAUDE.md.
 * - Adaptation engine is NOT triggered per activity — this is just baseline
 *   load context for future plan generation/adaptations.
 */
export async function importStravaHistory(
  supabase: SupabaseClient,
  userId: string,
  initialToken: StravaToken,
  days: number,
): Promise<ImportResult> {
  const after = Math.floor((+new Date() - days * 24 * 60 * 60 * 1000) / 1000)

  let token = initialToken
  let imported = 0
  let skipped = 0
  let pages = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { activities, refreshedToken } = await getAthleteActivities(token, {
      perPage: PER_PAGE,
      after,
      page,
    })
    token = refreshedToken
    pages = page

    if (activities.length === 0) break

    for (const activity of activities) {
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('strava_activity_id', activity.id)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      const sessionData = mapStravaToSession(activity, userId)
      const { error } = await supabase.from('sessions').insert(sessionData)
      if (!error) imported++
    }

    if (activities.length < PER_PAGE) break // last page
  }

  // Persist any refreshed token back to the profile
  if (token !== initialToken) {
    await supabase
      .from('profiles')
      .update({ strava_token: token as unknown as Record<string, unknown> })
      .eq('id', userId)
  }

  return { imported, skipped, pages }
}
