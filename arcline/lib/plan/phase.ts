// Phase label is a UX cue, not a training directive — actual periodisation
// lives in the AI-generated plan. This helper exists so the user has a mental
// model for where they are in the plan, nothing more.

export type Phase = 'Base' | 'Build' | 'Peak' | 'Taper'

export function computePhase(weekNumber: number, totalWeeks: number): Phase {
  if (totalWeeks <= 6) return 'Build'
  const progress = weekNumber / totalWeeks
  if (progress <= 0.30) return 'Base'
  if (progress <= 0.70) return 'Build'
  if (progress <= 0.90) return 'Peak'
  return 'Taper'
}

export function weeksUntilDate(iso: string | null | undefined): number {
  if (!iso) return 0
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return 0
  const now = new Date()
  const diffMs = target.getTime() - now.getTime()
  if (diffMs < 0) return 0
  return Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000))
}

export function formatGoalSuffix(
  goalType: string | null | undefined,
  goalDate: string | null | undefined,
  goalDescription: string | null | undefined,
): string {
  if (goalType === 'event_date' && goalDate) {
    const weeks = weeksUntilDate(goalDate)
    if (weeks === 0) return 'Race week'
    const label = goalDescription?.trim() || 'race day'
    return `${weeks} week${weeks === 1 ? '' : 's'} until ${label}`
  }
  if (goalType === 'pace_ability' && goalDescription) {
    return `Building toward ${goalDescription.trim()}`
  }
  return 'Building base fitness'
}
