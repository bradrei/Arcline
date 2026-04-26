import Anthropic from '@anthropic-ai/sdk'
import type { Profile, Plan, PlanWeek, PlanSession, Intensity, SessionType } from '@/types'
import { generateFallbackPlan } from './generateFallbackPlan'

const INTENSITY_MULTIPLIERS: Record<Intensity, number> = {
  easy: 1.0,
  moderate: 1.3,
  hard: 1.6,
  race_pace: 1.8,
}

interface AIPlanSession {
  day: string
  date: string
  type: string
  duration_min: number
  intensity: Intensity
  intensity_multiplier: number
  description: string
  target_pace?: string
  target_hr_zone?: number
  completed: boolean
}

interface AIPlanWeek {
  week_number: number
  week_start: string
  total_load_minutes: number
  sessions: AIPlanSession[]
}

interface AIPlanOutput {
  weeks: AIPlanWeek[]
}

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay() // 0=Sun, 1=Mon ... 6=Sat
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  d.setDate(d.getDate() + daysUntilMonday)
  return d.toISOString().split('T')[0]
}

function computeWeekLoad(sessions: AIPlanSession[]): number {
  return sessions.reduce((sum, s) => {
    const mult = INTENSITY_MULTIPLIERS[s.intensity] ?? 1.0
    return sum + s.duration_min * mult
  }, 0)
}

// HC1: cap each week at 115% of the previous week's load
function enforceHC1(weeks: AIPlanWeek[]): AIPlanWeek[] {
  if (weeks.length === 0) return weeks
  const result: AIPlanWeek[] = [weeks[0]]

  for (let i = 1; i < weeks.length; i++) {
    const prevLoad = computeWeekLoad(result[i - 1].sessions)
    const ceiling = prevLoad * 1.15
    const currentLoad = computeWeekLoad(weeks[i].sessions)

    if (currentLoad > ceiling) {
      const scaleFactor = ceiling / currentLoad
      const scaledSessions = weeks[i].sessions.map(s => ({
        ...s,
        duration_min: s.duration_min === 0
          ? 0
          : Math.max(15, Math.round((s.duration_min * scaleFactor) / 5) * 5),
      }))
      result.push({
        ...weeks[i],
        sessions: scaledSessions,
        total_load_minutes: Math.round(computeWeekLoad(scaledSessions)),
      })
    } else {
      result.push(weeks[i])
    }
  }
  return result
}

function aiWeekToPlanWeek(w: AIPlanWeek): PlanWeek {
  return {
    week_number: w.week_number,
    week_start: w.week_start,
    total_load_minutes: w.total_load_minutes,
    sessions: w.sessions.map((s): PlanSession => ({
      day: s.day,
      date: s.date,
      type: s.type as SessionType,
      duration_min: s.duration_min,
      intensity: s.intensity,
      intensity_multiplier: s.intensity_multiplier,
      description: s.description,
      target_pace: s.target_pace,
      target_hr_zone: s.target_hr_zone,
      completed: s.completed,
    })),
  }
}

function buildUserPrompt(profile: Profile, weekCount: number, weekStart: string): string {
  const schema = `{
  "weeks": [
    {
      "week_number": 1,
      "week_start": "YYYY-MM-DD",
      "total_load_minutes": 480,
      "sessions": [
        {
          "day": "Monday",
          "date": "YYYY-MM-DD",
          "type": "swim|bike|run|brick|strength|rest|other",
          "duration_min": 45,
          "intensity": "easy|moderate|hard|race_pace",
          "intensity_multiplier": 1.0,
          "description": "2-3 sentence session brief.",
          "target_pace": "optional e.g. 5:30/km",
          "target_hr_zone": null,
          "completed": false
        }
      ]
    }
  ]
}`

  return `Athlete profile:
- Age: ${profile.age ?? 'unknown'}, Sex: ${profile.sex ?? 'unknown'}
- Height: ${profile.height_cm ?? '?'}cm, Weight: ${profile.weight_kg ?? '?'}kg
- Resting HR: ${profile.resting_hr ?? 'not provided'} bpm
- Training years: ${profile.training_years ?? 1}
- Disciplines: ${(profile.disciplines ?? []).join(', ') || 'triathlon'}
- Injuries/conditions: ${profile.injuries_conditions || 'none'}
- Weekly availability: ${profile.weekly_hours_available ?? 6} hours across ${profile.weekly_days_available ?? 4} days
- Goal: ${profile.goal_type === 'event_date' ? `event on ${profile.goal_date}` : 'fitness goal'}
- Goal description: ${profile.goal_description ?? 'not specified'}

Generate a ${weekCount}-week training block. Week 1 starts ${weekStart}.

Rules:
- Include exactly 1 rest day per week (type "rest", duration_min 0, intensity "easy", completed false)
- Include brick sessions when athlete trains 5+ days and trains both bike and run
- Periodization: weeks build toward peak, final week is recovery at ~70% of peak load
- Distribute training across the available ${profile.weekly_days_available ?? 4} days plus 1 rest day
- Match total weekly active duration to ~${Math.round((profile.weekly_hours_available ?? 6) * 60)} minutes
- intensity_multiplier must match: easy=1.0, moderate=1.3, hard=1.6, race_pace=1.8
- total_load_minutes = sum of (duration_min × intensity_multiplier) across all sessions in the week
- All session dates must be real calendar dates beginning from ${weekStart}
- Output ONLY raw JSON matching the schema exactly. No markdown. No code fences. No text before or after.

Schema:
${schema}`
}

export async function generatePlan(profile: Profile): Promise<Omit<Plan, 'id'>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const weekCount = profile.goal_type === 'pace_ability' ? 6 : 4
  const weekStart = getWeekStart()

  if (!apiKey || apiKey.startsWith('your-')) {
    return generateFallbackPlan(profile, profile.id)
  }

  const client = new Anthropic({ apiKey })
  const systemPrompt =
    'You are an expert triathlon coach building personalised training plans for hybrid athletes (swim/bike/run). Output ONLY raw JSON — no markdown, no explanation, no code fences, no text before or after the JSON object.'
  const userPrompt = buildUserPrompt(profile, weekCount, weekStart)

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const rawText = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
      const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      const parsed = JSON.parse(jsonText) as AIPlanOutput

      if (!Array.isArray(parsed.weeks) || parsed.weeks.length === 0) {
        throw new Error('empty weeks array')
      }

      const enforced = enforceHC1(parsed.weeks)

      return {
        user_id: profile.id,
        generated_at: new Date().toISOString(),
        version: 1,
        goal_anchor: {
          goal_type: profile.goal_type,
          goal_date: profile.goal_date,
          goal_description: profile.goal_description,
        },
        weeks: enforced.map(aiWeekToPlanWeek),
        status: 'active',
        adaptation_count: 0,
        is_fallback: false,
      }
    } catch {
      if (attempt === 1) break
    }
  }

  // Both attempts failed — use fallback plan
  return generateFallbackPlan(profile, profile.id)
}
