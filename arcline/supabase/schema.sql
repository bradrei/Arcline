-- Arcline database schema
-- Run this once in the Supabase SQL editor on a fresh project.
-- All statements use IF NOT EXISTS / OR REPLACE for idempotency.

-- ─────────────────────────────────────────────
-- Pre-flight: show existing tables
-- ─────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ─────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  age int,
  height_cm numeric,
  weight_kg numeric,
  sex text,
  resting_hr int,
  training_years numeric,
  disciplines text[],
  injuries_conditions text,
  weekly_hours_available numeric,
  weekly_days_available int,
  goal_type text,
  goal_date date,
  goal_description text,
  onboarding_complete boolean DEFAULT false,
  strava_connected boolean DEFAULT false,
  strava_token jsonb, -- TODO [v2]: migrate to Supabase Vault for encrypted token storage
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  generated_at timestamptz DEFAULT now(),
  version int DEFAULT 1,
  goal_anchor jsonb,
  weeks jsonb NOT NULL,
  status text DEFAULT 'active', -- 'active' | 'paused_injury' | 'archived'
  adaptation_count int DEFAULT 0,
  is_fallback boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  plan_session_ref jsonb,
  logged_at timestamptz DEFAULT now(),
  session_date date NOT NULL,
  input_method text, -- 'manual' | 'screenshot' | 'strava'
  session_type text,
  duration_min numeric,
  distance_km numeric,
  avg_hr int,
  max_hr int,
  rpe int CHECK (rpe BETWEEN 1 AND 10),
  avg_pace text,
  power_watts int,
  notes text,
  raw_data jsonb,
  strava_activity_id bigint UNIQUE
);

CREATE TABLE IF NOT EXISTS adaptations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id),
  created_at timestamptz DEFAULT now(),
  trigger_type text, -- 'session_performance' | 'missed' | 'reduced' | 'extended' | 'added' | 'injury_return'
  trigger_session_id uuid REFERENCES sessions(id),
  ai_reasoning text,
  load_before numeric,
  load_after numeric,
  plan_before jsonb,
  plan_after jsonb
);

CREATE TABLE IF NOT EXISTS injury_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  detected_at timestamptz DEFAULT now(),
  trigger_text text,
  trigger_source text,
  referral_confirmed boolean DEFAULT false,
  confirmed_at timestamptz,
  resolved boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS hc2_false_positives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  trigger_text text,
  source text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Added Session 4: queue for background AI plan regeneration when fallback was used
CREATE TABLE IF NOT EXISTS plan_generation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id) ON DELETE CASCADE,
  status text DEFAULT 'pending', -- 'pending' | 'processing' | 'done' | 'failed'
  created_at timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptations ENABLE ROW LEVEL SECURITY;
ALTER TABLE injury_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE hc2_false_positives ENABLE ROW LEVEL SECURITY;
-- waitlist: no RLS (server-side only via service role key)

-- Policies: DROP IF EXISTS then CREATE for idempotency on PG15
DROP POLICY IF EXISTS "own profile" ON profiles;
CREATE POLICY "own profile" ON profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "own plans" ON plans;
CREATE POLICY "own plans" ON plans FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own sessions" ON sessions;
CREATE POLICY "own sessions" ON sessions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own adaptations" ON adaptations;
CREATE POLICY "own adaptations" ON adaptations FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own injury flags" ON injury_flags;
CREATE POLICY "own injury flags" ON injury_flags FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own false positives" ON hc2_false_positives;
CREATE POLICY "own false positives" ON hc2_false_positives FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Auto-create profile on signup
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
