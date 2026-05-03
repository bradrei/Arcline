-- Arcline database schema
-- Run this in the Supabase SQL editor. Safe to re-run — all statements are idempotent.
-- When the editor shows the RLS dialog, click "Run" (not "Run without RLS").

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
  strava_needs_reauth boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Backfill column on existing tables (safe to re-run)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS strava_needs_reauth boolean DEFAULT false;

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

CREATE TABLE IF NOT EXISTS adaptation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  processed boolean DEFAULT false,
  attempt_count int DEFAULT 0,
  last_attempted_at timestamptz,
  abandoned boolean DEFAULT false,
  last_error text
);
ALTER TABLE adaptation_queue ADD COLUMN IF NOT EXISTS attempt_count int DEFAULT 0;
ALTER TABLE adaptation_queue ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz;
ALTER TABLE adaptation_queue ADD COLUMN IF NOT EXISTS abandoned boolean DEFAULT false;
ALTER TABLE adaptation_queue ADD COLUMN IF NOT EXISTS last_error text;

CREATE TABLE IF NOT EXISTS plan_generation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id) ON DELETE CASCADE,
  status text DEFAULT 'pending', -- 'pending' | 'processing' | 'done' | 'failed' | 'abandoned'
  created_at timestamptz DEFAULT now(),
  attempt_count int DEFAULT 0,
  last_attempted_at timestamptz,
  last_error text
);
ALTER TABLE plan_generation_queue ADD COLUMN IF NOT EXISTS attempt_count int DEFAULT 0;
ALTER TABLE plan_generation_queue ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz;
ALTER TABLE plan_generation_queue ADD COLUMN IF NOT EXISTS last_error text;

CREATE TABLE IF NOT EXISTS plan_generation_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id) ON DELETE CASCADE,
  attempts int,
  last_error text,
  failed_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  injury_flagged boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS founder_bug_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_url text,
  message text,
  user_agent text,
  status text DEFAULT 'open', -- 'open' | 'resolved' | 'wontfix'
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_messages_user_created_idx
  ON coach_messages (user_id, created_at DESC);

-- ─────────────────────────────────────────────
-- Row Level Security — public tables
-- ─────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptations ENABLE ROW LEVEL SECURITY;
ALTER TABLE injury_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE hc2_false_positives ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_generation_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_bug_log ENABLE ROW LEVEL SECURITY;
-- waitlist: no RLS (server-side only via service role key)
-- founder_bug_log: RLS enabled with no public policy — writes go through service role
--                  in lib/founder/actions.ts after the FOUNDER_EMAIL gate.

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

DROP POLICY IF EXISTS "own adaptation queue" ON adaptation_queue;
CREATE POLICY "own adaptation queue" ON adaptation_queue FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own plan generation queue" ON plan_generation_queue;
CREATE POLICY "own plan generation queue" ON plan_generation_queue FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own plan generation failures" ON plan_generation_failures;
CREATE POLICY "own plan generation failures" ON plan_generation_failures FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own coach messages" ON coach_messages;
CREATE POLICY "own coach messages" ON coach_messages FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Storage — session screenshots bucket
-- ─────────────────────────────────────────────

-- Create the bucket (private — no public URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-screenshots', 'session-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload files into their own folder: session-screenshots/{userId}/...
DROP POLICY IF EXISTS "own screenshots upload" ON storage.objects;
CREATE POLICY "own screenshots upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'session-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read files from their own folder
DROP POLICY IF EXISTS "own screenshots read" ON storage.objects;
CREATE POLICY "own screenshots read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'session-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own screenshots
DROP POLICY IF EXISTS "own screenshots delete" ON storage.objects;
CREATE POLICY "own screenshots delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'session-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

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
