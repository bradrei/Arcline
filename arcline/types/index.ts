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
  created_at: string
  updated_at: string
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
