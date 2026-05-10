import type { BenchmarkProtocol } from '@/types'

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

/**
 * Build a 5-day benchmark protocol — Day 1 run TT, Day 3 bike TT, Day 5 swim TT.
 * Designed to be HC1-safe in isolation: each session is short, the days between
 * provide recovery, and the resulting plan begins after these are logged.
 */
export function buildBenchmarkProtocol(startDate: string): BenchmarkProtocol {
  return {
    sessions: [
      {
        day_number: 1,
        date: startDate,
        type: 'run',
        title: '20-min run time trial',
        protocol:
          'Warm up easy for 10 minutes. Then run hard but sustainable for 20 minutes — pace you could hold for ~30 minutes flat. Cool down 5 minutes. Capture your average pace per km over the 20-minute hard segment.',
        target_metric: 'avg_pace',
      },
      {
        day_number: 3,
        date: addDays(startDate, 2),
        type: 'bike',
        title: '20-min bike time trial',
        protocol:
          'Warm up easy for 10 minutes. Then ride hard but sustainable for 20 minutes — effort you could hold for ~30 minutes. Cool down 10 minutes. Capture average power (watts) if you have a power meter, otherwise average speed (km/h).',
        target_metric: 'avg_power',
      },
      {
        day_number: 5,
        date: addDays(startDate, 4),
        type: 'swim',
        title: '400m swim time trial',
        protocol:
          'Warm up 200m easy with drills. Then swim 400m at your hardest sustainable effort — race pace. Cool down 100m easy. Capture your average pace per 100m for the 400m TT.',
        target_metric: 'avg_pace',
      },
    ],
  }
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}
