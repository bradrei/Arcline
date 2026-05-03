'use server'

import Anthropic from '@anthropic-ai/sdk'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { detectInjury } from '@/lib/ai/detectInjury'
import { saveSessionAndTriggerAdaptation } from '@/lib/sessions/save'
import { importStravaHistory } from '@/lib/strava/importHistory'
import { StravaReauthRequiredError, type StravaToken } from '@/lib/strava/client'
import type { NewSession, SessionType } from '@/types'

// ── Injury check (session context — also pauses active plan) ─────────────────

export async function checkSessionInjury(
  text: string,
): Promise<{ injured: boolean; triggerText: string }> {
  if (!text.trim()) return { injured: false, triggerText: '' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { injured: false, triggerText: '' }

  const result = await detectInjury(text, 'session_log')

  if (result.injured) {
    await supabase.from('injury_flags').insert({
      user_id: user.id,
      trigger_text: text,
      trigger_source: 'session_log',
      referral_confirmed: false,
    })

    // Pause active plan — HC2 requirement
    await supabase
      .from('plans')
      .update({ status: 'paused_injury' })
      .eq('user_id', user.id)
      .eq('status', 'active')
  }

  return result
}

// ── Manual session log ───────────────────────────────────────────────────────

export interface ManualSessionInput {
  session_date: string
  session_type: SessionType
  duration_min: number
  distance_km: number | null
  avg_hr: number | null
  max_hr: number | null
  rpe: number | null
  avg_pace: string | null
  power_watts: number | null
  notes: string | null
}

export async function logManualSession(
  data: ManualSessionInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const sessionData: NewSession = {
    user_id: user.id,
    plan_session_ref: null,
    session_date: data.session_date,
    input_method: 'manual',
    session_type: data.session_type,
    duration_min: data.duration_min,
    distance_km: data.distance_km,
    avg_hr: data.avg_hr,
    max_hr: data.max_hr,
    rpe: data.rpe,
    avg_pace: data.avg_pace || null,
    power_watts: data.power_watts,
    notes: data.notes || null,
    raw_data: null,
    strava_activity_id: null,
  }

  try {
    await saveSessionAndTriggerAdaptation(supabase, user.id, sessionData)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Save failed.' }
  }
}

// ── Screenshot extraction ────────────────────────────────────────────────────

export interface ExtractedSession {
  session_type: string | null
  duration_min: number | null
  distance_km: number | null
  avg_hr: number | null
  max_hr: number | null
  avg_pace: string | null
  notes: string | null
  confidence: 'high' | 'medium' | 'low'
}

const EXTRACTION_PROMPT = `Extract training session data from this image.
Return valid JSON only, matching this exact schema:
{
  "session_type": string | null,
  "duration_min": number | null,
  "distance_km": number | null,
  "avg_hr": number | null,
  "max_hr": number | null,
  "avg_pace": string | null,
  "notes": string | null,
  "confidence": "high" | "medium" | "low"
}

Set confidence based on how clearly the data is readable in the image.
If a field is not visible, return null — do not guess.`

export async function extractScreenshot(
  formData: FormData,
): Promise<{ data?: ExtractedSession; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('your-')) {
    return { error: 'AI extraction not configured.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const file = formData.get('screenshot') as File | null
  if (!file) return { error: 'No file provided.' }

  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    return { error: 'Only JPEG and PNG files are supported.' }
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: 'File must be under 10MB.' }
  }

  // Upload to Supabase Storage
  const buffer = await file.arrayBuffer()
  const path = `${user.id}/${Date.now()}.jpg`

  const { error: uploadError } = await supabase.storage
    .from('session-screenshots')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` }
  }

  // Convert to base64 for Claude vision
  const base64 = Buffer.from(buffer).toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png'

  try {
    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const extracted = JSON.parse(jsonText) as ExtractedSession
    return { data: extracted }
  } catch {
    return { error: 'Could not extract session data from the image.' }
  }
}

// ── Confirm screenshot session (after user reviews extracted data) ────────────

export async function confirmSession(
  data: Omit<ManualSessionInput, 'session_type'> & { session_type: string },
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const knownTypes: SessionType[] = ['swim', 'bike', 'run', 'brick', 'strength', 'rest', 'open_water', 'race']
  const sessionType: SessionType = knownTypes.includes(data.session_type as SessionType)
    ? (data.session_type as SessionType)
    : 'other'

  const sessionData: NewSession = {
    user_id: user.id,
    plan_session_ref: null,
    session_date: data.session_date,
    input_method: 'screenshot',
    session_type: sessionType,
    duration_min: data.duration_min,
    distance_km: data.distance_km,
    avg_hr: data.avg_hr,
    max_hr: data.max_hr,
    rpe: data.rpe,
    avg_pace: data.avg_pace || null,
    power_watts: data.power_watts,
    notes: data.notes || null,
    raw_data: null,
    strava_activity_id: null,
  }

  try {
    await saveSessionAndTriggerAdaptation(supabase, user.id, sessionData)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Save failed.' }
  }
}

// ── Strava disconnect ────────────────────────────────────────────────────────

export async function disconnectStrava(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('profiles')
    .update({ strava_connected: false, strava_token: null })
    .eq('id', user.id)

  redirect('/app/settings/integrations')
}

// ── Strava bulk history import ───────────────────────────────────────────────

export async function importStravaHistory90(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('strava_connected, strava_token')
    .eq('id', user.id)
    .single()

  if (!profile?.strava_connected || !profile.strava_token) {
    redirect('/app/settings/integrations?error=strava_not_connected')
  }

  try {
    const result = await importStravaHistory(
      supabase,
      user.id,
      profile.strava_token as unknown as StravaToken,
      90,
    )
    redirect(
      `/app/settings/integrations?strava=imported&imported=${result.imported}&skipped=${result.skipped}`,
    )
  } catch (err) {
    if (err instanceof StravaReauthRequiredError) {
      await supabase
        .from('profiles')
        .update({ strava_needs_reauth: true })
        .eq('id', user.id)
      redirect('/app/settings/integrations?error=strava_reauth')
    }
    throw err
  }
}
