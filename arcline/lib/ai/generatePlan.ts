import Anthropic from '@anthropic-ai/sdk'
import type { Profile, Plan, PlanWeek, PlanSession, Intensity, SessionType } from '@/types'
import { generateFallbackPlan } from './generateFallbackPlan'
import { weeksUntilDate } from '@/lib/plan/phase'

const INTENSITY_MULTIPLIERS: Record<Intensity, number> = {
  easy: 1.0,
  moderate: 1.3,
  hard: 1.6,
  race_pace: 1.8,
}

const BLOCK_SIZE = 12
const MIN_WEEKS = 4
const PACE_GOAL_WEEKS = 12
const MAX_TOKENS_PER_BLOCK = 8192

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

interface PhaseRanges {
  base: [number, number] | null
  build: [number, number]
  peak: [number, number] | null
  taper: [number, number] | null
}

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  d.setDate(d.getDate() + daysUntilMonday)
  return d.toISOString().split('T')[0]
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function computeWeekLoad(sessions: AIPlanSession[]): number {
  return sessions.reduce((sum, s) => {
    const mult = INTENSITY_MULTIPLIERS[s.intensity] ?? 1.0
    return sum + s.duration_min * mult
  }, 0)
}

function computeTotalWeeks(profile: Profile): number {
  if (profile.goal_type === 'event_date' && profile.goal_date) {
    const weeks = weeksUntilDate(profile.goal_date)
    return Math.max(MIN_WEEKS, weeks)
  }
  return PACE_GOAL_WEEKS
}

function computePhaseRanges(totalWeeks: number): PhaseRanges {
  if (totalWeeks <= 6) return { base: null, build: [1, totalWeeks], peak: null, taper: null }
  const baseEnd = Math.max(1, Math.floor(totalWeeks * 0.30))
  const buildEnd = Math.max(baseEnd + 1, Math.floor(totalWeeks * 0.70))
  const peakEnd = Math.max(buildEnd + 1, Math.floor(totalWeeks * 0.90))
  return {
    base: [1, baseEnd],
    build: [baseEnd + 1, buildEnd],
    peak: buildEnd + 1 <= peakEnd ? [buildEnd + 1, peakEnd] : null,
    taper: peakEnd + 1 <= totalWeeks ? [peakEnd + 1, totalWeeks] : null,
  }
}

function describePhases(ranges: PhaseRanges): string {
  const parts: string[] = []
  if (ranges.base) parts.push(`Base phase (weeks ${ranges.base[0]}-${ranges.base[1]}): aerobic base, technique, easy volume`)
  parts.push(`Build phase (weeks ${ranges.build[0]}-${ranges.build[1]}): tempo, threshold, brick sessions, growing volume`)
  if (ranges.peak) parts.push(`Peak phase (weeks ${ranges.peak[0]}-${ranges.peak[1]}): race-specific intensity, sharpening, highest volume`)
  if (ranges.taper) parts.push(`Taper phase (weeks ${ranges.taper[0]}-${ranges.taper[1]}): reduced volume, kept intensity, rest before race`)
  return parts.map(p => `- ${p}`).join('\n')
}

// HC1: cap each week at 115% of the previous week's load (chains across all weeks).
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

function buildBlockPrompt(
  profile: Profile,
  totalWeeks: number,
  blockStart: number,
  blockSize: number,
  weekStart: string,
  previousLoad: number | null,
  ranges: PhaseRanges,
): string {
  const blockEnd = blockStart + blockSize - 1
  const isFinalBlock = blockEnd === totalWeeks
  const isEventGoal = profile.goal_type === 'event_date'

  const schema = `{
  "weeks": [
    {
      "week_number": ${blockStart},
      "week_start": "YYYY-MM-DD",
      "total_load_minutes": 480,
      "sessions": [
        {
          "day": "Monday",
          "date": "YYYY-MM-DD",
          "type": "swim|bike|run|brick|strength|rest|other|race",
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

  const continuity = previousLoad !== null
    ? `Continuity: the previous block ended with weekly load of ${Math.round(previousLoad)} weighted minutes. Build naturally from there — never spike above 115% of the previous week.`
    : 'This is the first block of the plan.'

  const finalWeekRule = isFinalBlock && isEventGoal
    ? `\n- The final week (week ${totalWeeks}) MUST include race day itself as a session of type "race". Race day intensity is "race_pace". Schedule the rest of the taper week appropriately around it.`
    : ''

  return `Athlete profile:
- Age: ${profile.age ?? 'unknown'}, Sex: ${profile.sex ?? 'unknown'}
- Height: ${profile.height_cm ?? '?'}cm, Weight: ${profile.weight_kg ?? '?'}kg
- Resting HR: ${profile.resting_hr ?? 'not provided'} bpm
- Training years: ${profile.training_years ?? 1}
- Disciplines: ${(profile.disciplines ?? []).join(', ') || 'triathlon'}
- Injuries/conditions: ${profile.injuries_conditions || 'none'}
- Weekly availability: ${profile.weekly_hours_available ?? 6} hours across ${profile.weekly_days_available ?? 4} days
- Goal type: ${profile.goal_type ?? 'unspecified'}
- Goal date: ${profile.goal_date ?? 'open-ended'}
- Goal description: ${profile.goal_description ?? 'not specified'}

Plan structure:
- Total plan length: ${totalWeeks} week${totalWeeks === 1 ? '' : 's'}
- This call generates weeks ${blockStart} through ${blockEnd} (${blockSize} week${blockSize === 1 ? '' : 's'})
- Periodisation across the whole plan:
${describePhases(ranges)}

${continuity}

Rules:
- Each week has exactly 1 rest day (type "rest", duration_min 0, intensity "easy", completed false)
- Distribute remaining sessions across the athlete's available ${profile.weekly_days_available ?? 4} training days
- Match total weekly active duration to ~${Math.round((profile.weekly_hours_available ?? 6) * 60)} minutes during peak weeks; reduce in base/taper
- Include brick sessions when the athlete trains 5+ days and trains both bike and run
- intensity_multiplier values are fixed: easy=1.0, moderate=1.3, hard=1.6, race_pace=1.8
- total_load_minutes = sum of (duration_min × intensity_multiplier) across all sessions in the week
- Apply the appropriate phase from the periodisation above for each week in this block
- Week 1 of the block starts ${weekStart}; subsequent weeks follow weekly. All session dates must be real calendar dates.
- week_number values in this block must be exactly ${blockStart} through ${blockEnd}, in that order${finalWeekRule}
- Output ONLY raw JSON matching the schema. No markdown, no code fences, no text before or after.

Schema:
${schema}`
}

async function callBlock(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  expectedWeekStart: number,
  expectedWeekEnd: number,
): Promise<AIPlanWeek[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: MAX_TOKENS_PER_BLOCK,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const rawText = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
      const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      const parsed = JSON.parse(jsonText) as AIPlanOutput

      if (!Array.isArray(parsed.weeks) || parsed.weeks.length === 0) {
        throw new Error('empty weeks array')
      }
      if (parsed.weeks[0].week_number !== expectedWeekStart) {
        throw new Error(`block week_number mismatch: got ${parsed.weeks[0].week_number}, expected ${expectedWeekStart}`)
      }
      if (parsed.weeks[parsed.weeks.length - 1].week_number !== expectedWeekEnd) {
        throw new Error(
          `block end mismatch: got ${parsed.weeks[parsed.weeks.length - 1].week_number}, expected ${expectedWeekEnd}`,
        )
      }
      return parsed.weeks
    } catch {
      if (attempt === 1) throw new Error('block generation failed after retry')
    }
  }
  throw new Error('unreachable')
}

export async function generatePlan(profile: Profile): Promise<Omit<Plan, 'id'>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('your-')) {
    return generateFallbackPlan(profile, profile.id)
  }

  const totalWeeks = computeTotalWeeks(profile)
  const planStart = getWeekStart()
  const ranges = computePhaseRanges(totalWeeks)

  const client = new Anthropic({ apiKey })
  const systemPrompt =
    'You are an expert triathlon coach building personalised, periodised training plans for hybrid athletes (swim/bike/run). Output ONLY raw JSON — no markdown, no explanation, no code fences, no text before or after the JSON object.'

  try {
    const allWeeks: AIPlanWeek[] = []
    let blockStart = 1
    let dateCursor = planStart

    while (blockStart <= totalWeeks) {
      const remaining = totalWeeks - blockStart + 1
      const blockSize = Math.min(BLOCK_SIZE, remaining)
      const blockEnd = blockStart + blockSize - 1
      const previousLoad =
        allWeeks.length > 0 ? computeWeekLoad(allWeeks[allWeeks.length - 1].sessions) : null

      const userPrompt = buildBlockPrompt(
        profile,
        totalWeeks,
        blockStart,
        blockSize,
        dateCursor,
        previousLoad,
        ranges,
      )

      const blockWeeks = await callBlock(client, systemPrompt, userPrompt, blockStart, blockEnd)
      allWeeks.push(...blockWeeks)

      blockStart += blockSize
      dateCursor = addDays(dateCursor, blockSize * 7)
    }

    const enforced = enforceHC1(allWeeks)

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
    return generateFallbackPlan(profile, profile.id)
  }
}
