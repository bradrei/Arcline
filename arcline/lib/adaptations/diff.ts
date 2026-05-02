import type { Plan, PlanSession, SessionChange } from '@/types'

function sessionKey(session: PlanSession, weekNumber: number): string {
  return session.date ?? `w${weekNumber}-${session.day}`
}

function sessionsDiffer(a: PlanSession, b: PlanSession): boolean {
  return (
    a.duration_min !== b.duration_min ||
    a.intensity !== b.intensity ||
    a.type !== b.type ||
    (a.description ?? '') !== (b.description ?? '')
  )
}

export function computeAdaptationDiff(
  planBefore: Plan | null,
  planAfter: Plan | null,
): SessionChange[] {
  if (!planBefore || !planAfter) return []

  const beforeMap = new Map<string, PlanSession>()
  const afterMap = new Map<string, PlanSession>()

  for (const week of planBefore.weeks ?? []) {
    for (const session of week.sessions ?? []) {
      beforeMap.set(sessionKey(session, week.week_number), session)
    }
  }
  for (const week of planAfter.weeks ?? []) {
    for (const session of week.sessions ?? []) {
      afterMap.set(sessionKey(session, week.week_number), session)
    }
  }

  const changes: SessionChange[] = []

  for (const [key, after] of afterMap) {
    const before = beforeMap.get(key)
    if (!before) {
      changes.push({ type: 'added', date: after.date ?? key, after })
    } else if (sessionsDiffer(before, after)) {
      changes.push({ type: 'modified', date: after.date ?? key, before, after })
    }
  }

  for (const [key, before] of beforeMap) {
    if (!afterMap.has(key)) {
      changes.push({ type: 'removed', date: before.date ?? key, before })
    }
  }

  return changes.sort((a, b) => a.date.localeCompare(b.date))
}

export function adaptedDatesIn(plan: Plan | null): Set<string> {
  const dates = new Set<string>()
  if (!plan) return dates
  for (const week of plan.weeks ?? []) {
    for (const session of week.sessions ?? []) {
      if (session.date) dates.add(session.date)
    }
  }
  return dates
}

export function summarizeSession(s: PlanSession | undefined): string {
  if (!s) return '—'
  if (s.type === 'rest') return 'rest'
  return `${s.duration_min}min ${s.intensity} ${s.type}`
}
