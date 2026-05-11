import Anthropic from '@anthropic-ai/sdk'
import type { Profile, Plan, PlanWeek, PlanSession, StrengthExercise, Intensity, SessionType } from '@/types'
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
  // Strength-only
  focus?: string
  session_summary?: string
  exercises?: StrengthExercise[]
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

function getMondayOfThisWeek(): string {
  const d = new Date()
  const day = d.getDay() // 0=Sun ... 6=Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offsetToMonday)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function isoToday(): string {
  return new Date().toISOString().split('T')[0]
}

function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
        duration_min:
          s.duration_min === 0
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
      ...(s.type === 'strength'
        ? {
            focus: s.focus,
            session_summary: s.session_summary,
            exercises: s.exercises,
          }
        : {}),
    })),
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface VerifyResult {
  valid: boolean
  issues: string[]
}

export function verifyPlan(weeks: PlanWeek[], raceDate: string | null): VerifyResult {
  const issues: string[] = []
  if (weeks.length === 0) {
    issues.push('Plan has zero weeks')
    return { valid: false, issues }
  }

  // Every session must have a real ISO date
  for (const week of weeks) {
    for (const session of week.sessions) {
      if (!session.date || !ISO_DATE.test(session.date)) {
        issues.push(`Week ${week.week_number}: session "${session.day}" has invalid date "${session.date}"`)
      }
    }
  }

  // Final session must land on the race date when there is one
  if (raceDate) {
    const lastWeek = weeks[weeks.length - 1]
    const lastSession = lastWeek.sessions[lastWeek.sessions.length - 1]
    if (lastSession?.date !== raceDate) {
      issues.push(
        `Final session date is ${lastSession?.date ?? 'missing'}, expected race date ${raceDate}`,
      )
    }
  }

  // All session dates across the plan must be non-decreasing
  const dates = weeks.flatMap(w => w.sessions.map(s => s.date)).filter(Boolean) as string[]
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < dates[i - 1]) {
      issues.push('Plan dates are not in chronological order')
      break
    }
  }

  // At least one rest day per week
  for (const week of weeks) {
    if (!week.sessions.some(s => s.type === 'rest')) {
      issues.push(`Week ${week.week_number} has no rest day`)
    }
  }

  return { valid: issues.length === 0, issues }
}

function strengthContext(pref: Profile['strength_preference']): string {
  switch (pref) {
    case 'light':
      return 'Include 1 short strength session per week (30-40 min), focused on injury prevention exercises (single-leg work, core, posterior chain).'
    case 'moderate':
      return 'Include 2 strength sessions per week (45-60 min each), balanced with triathlon volume. Lower body strength and upper body pull/push patterns.'
    case 'serious':
      return 'Include 2-3 strength sessions per week. At least one should incorporate plyometrics or functional movements. Include a mobility/stretching day if availability allows.'
    case 'none':
    default:
      return 'Do NOT include strength sessions.'
  }
}

function strengthSchemaFragment(pref: Profile['strength_preference']): string {
  if (pref === 'none' || !pref) return ''
  return `\n\nFor every session with type "strength", populate these additional fields:
- focus: short string like "Lower body, posterior chain"
- session_summary: 1-2 sentence description of what this session is achieving
- exercises: array of 4-7 exercises, each with:
    name (e.g., "Romanian Deadlift")
    sets (number, e.g., 3)
    reps (string, e.g., "8-10" or "AMRAP" or "30s")
    rest_seconds (number)
    description (1-2 sentences explaining the movement)
    cue (1 sentence — primary form cue)`
}

function buildBlockPrompt(
  profile: Profile,
  totalWeeks: number,
  blockStart: number,
  blockSize: number,
  weekStart: string,
  previousLoad: number | null,
  ranges: PhaseRanges,
  raceDate: string | null,
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

  const finalRule = isFinalBlock && isEventGoal && raceDate
    ? `\n\nFINAL BLOCK / RACE WEEK:\n- The final week (week ${totalWeeks}) is race week and MUST end on race day ${raceDate}.\n- The very last session in week ${totalWeeks} MUST be type "race", intensity "race_pace", dated EXACTLY ${raceDate}.\n- Schedule the rest of the taper week appropriately around it (short, sharp, low volume).`
    : ''

  const todayISO = isoToday()

  let raceLine: string
  if (isEventGoal && raceDate) {
    const distance = profile.race_distance ?? 'event'
    const finishMode = profile.goal_time_seconds
      ? `targeting a total finish time of ${formatSeconds(profile.goal_time_seconds)} for their ${distance}.`
      : `goal: finish their ${distance}, no specific time target.`
    const pacesLine = profile.goal_paces
      ? `Target paces: swim ${profile.goal_paces.swim_per_100m ?? 'unspecified'} per 100m, bike ${profile.goal_paces.bike_kmh ?? 'unspecified'} km/h, run ${profile.goal_paces.run_per_km ?? 'unspecified'} per km. Calibrate threshold and race-pace zones to these.`
      : ''
    raceLine = `RACE DATE: ${raceDate}\nRACE NAME: ${profile.goal_description ?? 'their target race'}\nRACE DISTANCE: ${distance}\nThe athlete is ${finishMode}\n${pacesLine}\nThe full plan covers every week from today (${todayISO}) until race day. Total length: ${totalWeeks} weeks.`
  } else {
    raceLine = `GOAL: ${profile.goal_description ?? 'pace/ability target'} (no fixed event date). Plan length: ${totalWeeks} weeks.`
  }

  return `You are Arcline, an expert triathlon and Ironman coach.

TODAY'S DATE: ${todayISO}
${raceLine}

This API call generates weeks ${blockStart}–${blockEnd} of the plan (${blockSize} week${blockSize === 1 ? '' : 's'}).

ATHLETE PROFILE:
- Age: ${profile.age ?? 'unknown'}, Sex: ${profile.sex ?? 'unknown'}
- Height: ${profile.height_cm ?? '?'}cm, Weight: ${profile.weight_kg ?? '?'}kg
- Resting HR: ${profile.resting_hr ?? 'not provided'} bpm
- Training years: ${profile.training_years ?? 1}
- Disciplines: ${(profile.disciplines ?? []).join(', ') || 'triathlon'}
- Injuries/conditions: ${profile.injuries_conditions || 'none'}
- Weekly availability: ${profile.weekly_hours_available ?? 6} hours across ${profile.weekly_days_available ?? 4} days

STRENGTH: ${strengthContext(profile.strength_preference)}${strengthSchemaFragment(profile.strength_preference)}

PERIODISATION (across the full ${totalWeeks}-week plan):
${describePhases(ranges)}

${continuity}

ABSOLUTE REQUIREMENTS — your output is REJECTED if any of these are violated:
1. Output ONLY raw JSON matching the schema. No markdown fences, no commentary, no text before/after.
2. week_number values in this block MUST be exactly ${blockStart} through ${blockEnd}, in order.
3. Week 1 of this block starts ${weekStart}. Each subsequent week_start is exactly 7 days later.
4. EVERY session MUST have a real ISO date (YYYY-MM-DD) computed from week_start + day-of-week offset. NEVER omit the date. NEVER use a day name in place of a date.
5. Every week MUST contain exactly one rest day (type "rest", duration_min 0, intensity "easy", completed false).
6. intensity_multiplier values are FIXED: easy=1.0, moderate=1.3, hard=1.6, race_pace=1.8.
7. total_load_minutes MUST equal the sum of (duration_min × intensity_multiplier) across all sessions in the week.
8. Distribute non-rest sessions across the athlete's available ${profile.weekly_days_available ?? 4} training days. Never schedule more than that.
9. Total weekly active duration approximates ~${Math.round((profile.weekly_hours_available ?? 6) * 60)} minutes during peak weeks; reduce in base/taper.
10. Include brick sessions when the athlete trains 5+ days and trains both bike and run.${finalRule}

SCHEMA:
${schema}

Generate weeks ${blockStart}–${blockEnd} now. JSON only.`
}

async function callBlock(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  expectedWeekStart: number,
  expectedWeekEnd: number,
): Promise<AIPlanWeek[]> {
  // Single attempt — Vercel Hobby caps functions at 60s. With chunked generation
  // and the outer retry, the budget is tight; internal retries push it over.
  // Fast fail to the outer fallback path on any block error.
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
}

async function generateFullPlanWeeks(
  client: Anthropic,
  systemPrompt: string,
  profile: Profile,
  totalWeeks: number,
  planStart: string,
  raceDate: string | null,
): Promise<AIPlanWeek[]> {
  const ranges = computePhaseRanges(totalWeeks)
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
      raceDate,
    )

    const blockWeeks = await callBlock(client, systemPrompt, userPrompt, blockStart, blockEnd)
    allWeeks.push(...blockWeeks)

    blockStart += blockSize
    dateCursor = addDays(dateCursor, blockSize * 7)
  }

  return allWeeks
}

export async function generatePlan(profile: Profile): Promise<Omit<Plan, 'id'>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('your-')) {
    return generateFallbackPlan(profile, profile.id)
  }

  const totalWeeks = computeTotalWeeks(profile)
  const planStart = getMondayOfThisWeek()
  const raceDate =
    profile.goal_type === 'event_date' && profile.goal_date ? profile.goal_date : null

  const client = new Anthropic({ apiKey })
  const systemPrompt =
    'You are an expert triathlon coach building personalised, periodised, date-anchored training plans for hybrid athletes (swim/bike/run). Your output is JSON only — no markdown, no explanation, no code fences. Every session you generate must include a real ISO date.'

  // Single attempt within Vercel's 60s function budget. Fast-fall to the static
  // fallback on any AI failure — the cron picks fallback plans up and retries.
  try {
    const aiWeeks = await generateFullPlanWeeks(
      client,
      systemPrompt,
      profile,
      totalWeeks,
      planStart,
      raceDate,
    )
    const enforced = enforceHC1(aiWeeks)
    const planWeeks = enforced.map(aiWeekToPlanWeek)

    const verification = verifyPlan(planWeeks, raceDate)
    if (!verification.valid) {
      console.warn('Plan verification failed:', verification.issues.join('; '))
      return generateFallbackPlan(profile, profile.id)
    }

    return {
      user_id: profile.id,
      generated_at: new Date().toISOString(),
      version: 1,
      goal_anchor: {
        goal_type: profile.goal_type,
        goal_date: profile.goal_date,
        goal_description: profile.goal_description,
      },
      weeks: planWeeks,
      status: 'active',
      adaptation_count: 0,
      is_fallback: false,
    }
  } catch (err) {
    console.error('Plan generation failed:', err)
    return generateFallbackPlan(profile, profile.id)
  }
}
