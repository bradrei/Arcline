import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Adaptation } from '@/types'
import { computeAdaptationDiff } from './diff'

const RECENT_DAYS = 7

function isoDaysAgo(days: number): string {
  return new Date(+new Date() - days * 24 * 60 * 60 * 1000).toISOString()
}

export async function getRecentAdaptations(
  supabase: SupabaseClient,
  userId: string,
  days = RECENT_DAYS,
): Promise<Adaptation[]> {
  const { data } = await supabase
    .from('adaptations')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', isoDaysAgo(days))
    .order('created_at', { ascending: false })
  return (data ?? []) as Adaptation[]
}

export async function getAllAdaptations(
  supabase: SupabaseClient,
  userId: string,
): Promise<Adaptation[]> {
  const { data } = await supabase
    .from('adaptations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []) as Adaptation[]
}

export function getRecentlyAdaptedSessionDates(
  adaptations: Adaptation[],
): Set<string> {
  const dates = new Set<string>()
  for (const a of adaptations) {
    const changes = computeAdaptationDiff(a.plan_before, a.plan_after)
    for (const c of changes) dates.add(c.date)
  }
  return dates
}

export function findAdaptationsForSessionDate(
  adaptations: Adaptation[],
  sessionDate: string,
): Adaptation[] {
  return adaptations.filter(a => {
    const changes = computeAdaptationDiff(a.plan_before, a.plan_after)
    return changes.some(c => c.date === sessionDate)
  })
}
