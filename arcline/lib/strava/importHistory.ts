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
 * - Uses bulk SELECT + bulk INSERT to stay within Vercel's 60s function budget
 *   even when there are 200+ activities.
 */
export async function importStravaHistory(
  supabase: SupabaseClient,
  userId: string,
  initialToken: StravaToken,
  days: number,
): Promise<ImportResult> {
  const after = Math.floor((+new Date() - days * 24 * 60 * 60 * 1000) / 1000)

  let token = initialToken
  const allActivities: Awaited<ReturnType<typeof getAthleteActivities>>['activities'] = []
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
    allActivities.push(...activities)
    if (activities.length < PER_PAGE) break
  }

  if (allActivities.length === 0) {
    if (token !== initialToken) {
      await supabase
        .from('profiles')
        .update({ strava_token: token as unknown as Record<string, unknown> })
        .eq('id', userId)
    }
    return { imported: 0, skipped: 0, pages }
  }

  // Bulk dedup check — single query instead of one per activity
  const activityIds = allActivities.map(a => a.id)
  const { data: existing } = await supabase
    .from('sessions')
    .select('strava_activity_id')
    .eq('user_id', userId)
    .in('strava_activity_id', activityIds)

  const existingIds = new Set<number>(
    (existing ?? []).map(r => (r as { strava_activity_id: number }).strava_activity_id),
  )

  // Build session rows for new activities only
  const newSessionRows = allActivities
    .filter(a => !existingIds.has(a.id))
    .map(a => mapStravaToSession(a, userId))

  let imported = 0
  if (newSessionRows.length > 0) {
    // UPSERT with ignoreDuplicates handles the case where another row already
    // has the same strava_activity_id (the column is globally UNIQUE in our
    // schema). With a plain INSERT, one conflicting row rolls back the whole
    // batch; upsert silently skips the conflicts so the rest still land.
    const { data: insertedRows, error } = await supabase
      .from('sessions')
      .upsert(newSessionRows, {
        onConflict: 'strava_activity_id',
        ignoreDuplicates: true,
      })
      .select('id')
    if (error) {
      console.error('Strava bulk import error:', error)
      throw new Error(`Bulk insert failed: ${error.message}`)
    }
    imported = insertedRows?.length ?? 0
  }

  // Persist any refreshed token back to the profile
  if (token !== initialToken) {
    await supabase
      .from('profiles')
      .update({ strava_token: token as unknown as Record<string, unknown> })
      .eq('id', userId)
  }

  return {
    imported,
    // Total skipped = previously-known by this user + duplicates handled by upsert
    skipped: allActivities.length - imported,
    pages,
  }
}
