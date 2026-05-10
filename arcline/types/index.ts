export type { User } from '@supabase/supabase-js'

export type InjurySource = 'session_log' | 'notes' | 'screenshot' | 'onboarding' | 'chat'

export interface CoachMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  injury_flagged: boolean
}

export type AdaptationTrigger =
  | 'session_performance'
  | 'missed'
  | 'reduced'
  | 'extended'
  | 'added'
  | 'injury_return'

export interface Adaptation {
  id: string
  user_id: string
  plan_id: string | null
  created_at: string
  trigger_type: AdaptationTrigger | string | null
  trigger_session_id: string | null
  ai_reasoning: string | null
  load_before: number | null
  load_after: number | null
  plan_before: Plan | null
  plan_after: Plan | null
}

export interface SessionChange {
  type: 'modified' | 'added' | 'removed'
  date: string
  before?: PlanSession
  after?: PlanSession
}

export interface Profile {
  id: string
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  sex: string | null
  resting_hr: number | null
  training_years: number | null
  disciplines: string[] | null
  injuries_conditions: string | null
  weekly_hours_available: number | null
  weekly_days_available: number | null
  goal_type: 'event_date' | 'pace_ability' | null
  goal_date: string | null
  goal_description: string | null
  onboarding_complete: boolean
  strava_connected: boolean
  strava_token: Record<string, unknown> | null
  strava_needs_reauth?: boolean
  last_plan_restart_at?: string | null
  calibration_choice?: 'import' | 'benchmark' | 'fresh' | null
  strength_preference?: 'none' | 'light' | 'moderate' | 'serious' | null
  race_distance?: 'sprint' | 'olympic' | '70.3' | 'ironman' | 'standalone_run' | 'other' | null
  goal_time_seconds?: number | null
  goal_paces?: { swim_per_100m?: string; bike_kmh?: number; run_per_km?: string } | null
  created_at: string
  updated_at: string
}

export interface BenchmarkProtocolSession {
  day_number: number
  date: string
  type: 'run' | 'bike' | 'swim'
  title: string
  protocol: string
  target_metric: 'avg_pace' | 'avg_power'
}

export interface BenchmarkProtocol {
  sessions: BenchmarkProtocolSession[]
}

export interface BenchmarkResults {
  run_pace?: string | null
  bike_power?: number | null
  bike_kmh?: number | null
  swim_pace?: string | null
  notes?: string | null
}

export interface Benchmark {
  id: string
  user_id: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  protocol: BenchmarkProtocol
  results: BenchmarkResults | null
  created_at: string
  completed_at: string | null
}

export interface StrengthExercise {
  name: string
  sets: number
  reps: string
  rest_seconds: number
  description: string
  cue: string
}

export interface StrengthSessionSet {
  id: string
  session_id: string
  user_id: string
  exercise_name: string
  exercise_index: number
  set_number: number
  weight_kg: number | null
  reps_completed: number | null
  logged_at: string
}

export type SessionType = 'swim' | 'bike' | 'run' | 'brick' | 'strength' | 'rest' | 'open_water' | 'race' | 'other'
export type Intensity = 'easy' | 'moderate' | 'hard' | 'race_pace'

export interface PlanSession {
  day: string
  date?: string
  type: SessionType
  duration_min: number
  intensity: Intensity
  intensity_multiplier?: number
  description: string
  target_pace?: string
  target_hr_zone?: number
  completed?: boolean
  // Strength sessions only
  focus?: string
  exercises?: StrengthExercise[]
  session_summary?: string
}

export interface PlanWeek {
  week_number: number
  week_start?: string
  sessions: PlanSession[]
  total_load_minutes?: number
}

export interface Plan {
  id: string
  user_id: string
  generated_at: string
  version: number
  goal_anchor: Record<string, unknown> | null
  weeks: PlanWeek[]
  status: 'active' | 'paused_injury' | 'archived'
  adaptation_count: number
  is_fallback: boolean
}

export type NewSession = Omit<TrainingSession, 'id' | 'logged_at'>

// Named TrainingSession to avoid collision with Supabase's auth Session type
export interface TrainingSession {
  id: string
  user_id: string
  plan_session_ref: Record<string, unknown> | null
  logged_at: string
  session_date: string
  input_method: 'manual' | 'screenshot' | 'strava' | null
  session_type: SessionType | null
  duration_min: number | null
  distance_km: number | null
  avg_hr: number | null
  max_hr: number | null
  rpe: number | null
  avg_pace: string | null
  power_watts: number | null
  notes: string | null
  raw_data: Record<string, unknown> | null
  strava_activity_id: number | null
}
