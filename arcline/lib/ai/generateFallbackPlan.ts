import type { Profile, Plan, PlanWeek, PlanSession, SessionType, Intensity } from '@/types'

// TODO [v2/Session 4]: Replace with AI-generated plan from Claude API.
// This stub generates a structured baseline plan from the user's availability.
// is_fallback=true flags it for regeneration once AI generation is live.

interface SessionTemplate {
  type: SessionType
  intensity: Intensity
  description: string
  durationRatio: number // fraction of daily allocation
}

const SESSION_TEMPLATES: Record<number, SessionTemplate[]> = {
  3: [
    { type: 'bike', intensity: 'moderate', description: 'Aerobic bike build. Steady effort, controlled breathing.', durationRatio: 1.4 },
    { type: 'run', intensity: 'easy', description: 'Easy aerobic run. Conversational pace throughout.', durationRatio: 0.8 },
    { type: 'swim', intensity: 'moderate', description: 'Technique swim. Drill sets with aerobic intervals.', durationRatio: 0.8 },
  ],
  4: [
    { type: 'swim', intensity: 'easy', description: 'Easy aerobic swim. Focus on stroke efficiency.', durationRatio: 0.8 },
    { type: 'bike', intensity: 'moderate', description: 'Aerobic bike build. Steady effort, controlled breathing.', durationRatio: 1.4 },
    { type: 'run', intensity: 'easy', description: 'Easy aerobic run. Conversational pace throughout.', durationRatio: 0.8 },
    { type: 'bike', intensity: 'easy', description: 'Long easy ride. Build base endurance.', durationRatio: 1.4 },
  ],
  5: [
    { type: 'swim', intensity: 'easy', description: 'Easy aerobic swim. Focus on stroke efficiency.', durationRatio: 0.7 },
    { type: 'run', intensity: 'moderate', description: 'Tempo run. Comfortably hard effort.', durationRatio: 0.9 },
    { type: 'bike', intensity: 'moderate', description: 'Aerobic bike build. Steady effort.', durationRatio: 1.2 },
    { type: 'swim', intensity: 'moderate', description: 'Interval swim. Aerobic speed work.', durationRatio: 0.7 },
    { type: 'bike', intensity: 'easy', description: 'Long easy ride. Build base endurance.', durationRatio: 1.5 },
  ],
  6: [
    { type: 'swim', intensity: 'easy', description: 'Easy aerobic swim. Focus on stroke efficiency.', durationRatio: 0.7 },
    { type: 'run', intensity: 'easy', description: 'Easy recovery run. Effort should feel very light.', durationRatio: 0.8 },
    { type: 'bike', intensity: 'moderate', description: 'Aerobic bike build. Steady effort.', durationRatio: 1.2 },
    { type: 'strength', intensity: 'moderate', description: 'Functional strength. Core, glutes, hip stability.', durationRatio: 0.7 },
    { type: 'run', intensity: 'moderate', description: 'Long aerobic run. Build run durability.', durationRatio: 1.0 },
    { type: 'bike', intensity: 'easy', description: 'Long easy ride. Build base endurance.', durationRatio: 1.6 },
  ],
  7: [
    { type: 'swim', intensity: 'easy', description: 'Easy aerobic swim. Focus on stroke efficiency.', durationRatio: 0.7 },
    { type: 'run', intensity: 'easy', description: 'Easy recovery run. Effort should feel very light.', durationRatio: 0.8 },
    { type: 'bike', intensity: 'moderate', description: 'Aerobic bike build. Steady effort.', durationRatio: 1.1 },
    { type: 'swim', intensity: 'moderate', description: 'Interval swim. Aerobic speed work.', durationRatio: 0.7 },
    { type: 'strength', intensity: 'moderate', description: 'Functional strength. Core, glutes, hip stability.', durationRatio: 0.6 },
    { type: 'brick', intensity: 'moderate', description: 'Brick session: bike then run. Practice the transition.', durationRatio: 1.4 },
    { type: 'bike', intensity: 'easy', description: 'Long easy ride. Build base endurance.', durationRatio: 1.7 },
  ],
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Weekly load multipliers across 4 weeks: build, build, peak, recovery
const WEEK_MULTIPLIERS = [0.8, 0.9, 1.0, 0.7]

export function generateFallbackPlan(profile: Profile, _planId: string): Omit<Plan, 'id'> {
  const daysAvail = Math.min(Math.max(profile.weekly_days_available ?? 4, 3), 7)
  const totalMinutesPerWeek = (profile.weekly_hours_available ?? 6) * 60
  const templates = SESSION_TEMPLATES[daysAvail] ?? SESSION_TEMPLATES[4]

  // Distribute days evenly across the week
  const daySpacing = Math.floor(7 / daysAvail)
  const assignedDays = templates.map((_, i) =>
    DAYS[Math.min(i * daySpacing, 6)]
  )

  const totalRatio = templates.reduce((sum, t) => sum + t.durationRatio, 0)

  const weeks: PlanWeek[] = WEEK_MULTIPLIERS.map((multiplier, wi) => {
    const weekMinutes = totalMinutesPerWeek * multiplier

    const sessions: PlanSession[] = templates.map((tmpl, i) => {
      const rawMin = (tmpl.durationRatio / totalRatio) * weekMinutes
      const duration_min = Math.round(rawMin / 5) * 5 // round to nearest 5

      return {
        day: assignedDays[i],
        type: tmpl.type,
        duration_min,
        intensity: wi === 3 ? 'easy' : tmpl.intensity, // week 4 is recovery
        description: tmpl.description,
      }
    })

    const total_load_minutes = Math.round(weekMinutes)

    return { week_number: wi + 1, sessions, total_load_minutes }
  })

  return {
    user_id: profile.id,
    generated_at: new Date().toISOString(),
    version: 1,
    goal_anchor: {
      goal_type: profile.goal_type,
      goal_date: profile.goal_date,
      goal_description: profile.goal_description,
    },
    weeks,
    status: 'active',
    adaptation_count: 0,
    is_fallback: true,
  }
}
