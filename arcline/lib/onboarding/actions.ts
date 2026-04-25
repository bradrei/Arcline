'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { detectInjury, type InjurySource } from '@/lib/ai/detectInjury'
import { generateFallbackPlan } from '@/lib/ai/generateFallbackPlan'
import type { Profile } from '@/types'

type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>

export async function saveStep(data: ProfileUpdate): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('profiles')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return {}
}

export async function checkInjuryText(
  text: string,
  source: InjurySource
): Promise<{ injured: boolean; triggerText: string }> {
  if (!text.trim()) return { injured: false, triggerText: '' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { injured: false, triggerText: '' }

  const result = await detectInjury(text, source)

  if (result.injured) {
    // Record the flag — no plan to pause yet during onboarding
    await supabase.from('injury_flags').insert({
      user_id: user.id,
      trigger_text: text,
      trigger_source: source,
      referral_confirmed: false,
    })
  }

  return result
}

export async function confirmInjuryReferral(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Confirm the most recent unresolved flag
  const { data: flag } = await supabase
    .from('injury_flags')
    .select('id')
    .eq('user_id', user.id)
    .eq('referral_confirmed', false)
    .order('detected_at', { ascending: false })
    .limit(1)
    .single()

  if (flag) {
    await supabase
      .from('injury_flags')
      .update({ referral_confirmed: true, confirmed_at: new Date().toISOString() })
      .eq('id', flag.id)
  }

  return {}
}

export async function dismissInjuryAsFalsePositive(
  triggerText: string,
  source: InjurySource
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  await supabase.from('hc2_false_positives').insert({
    user_id: user.id,
    trigger_text: triggerText,
    source,
  })

  // Resolve the outstanding flag if one exists
  await supabase
    .from('injury_flags')
    .update({ resolved: true })
    .eq('user_id', user.id)
    .eq('referral_confirmed', false)

  return {}
}

export async function completeOnboarding(
  finalData: ProfileUpdate
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Save final step + mark onboarding complete
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      ...finalData,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (profileError) return { error: profileError.message }

  // Fetch full profile to build the fallback plan
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (fetchError || !profile) return { error: 'Could not load profile for plan generation.' }

  // Generate and save fallback plan
  // TODO [Session 4]: Replace generateFallbackPlan with AI plan generation
  const planData = generateFallbackPlan(profile as Profile, user.id)

  const { error: planError } = await supabase.from('plans').insert(planData)
  if (planError) return { error: planError.message }

  redirect('/app/dashboard')
}
