'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { generatePlan } from '@/lib/ai/generatePlan'
import type { Benchmark, BenchmarkResults, Profile } from '@/types'

interface BenchmarkResultPatch {
  run_pace?: string | null
  bike_power?: number | null
  bike_kmh?: number | null
  swim_pace?: string | null
  notes?: string | null
}

export async function logBenchmarkResult(
  benchmarkId: string,
  patch: BenchmarkResultPatch,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: existing, error: fetchErr } = await supabase
    .from('benchmarks')
    .select('id, user_id, results, status')
    .eq('id', benchmarkId)
    .eq('user_id', user.id)
    .single()
  if (fetchErr || !existing) return { error: 'Benchmark not found.' }

  const merged: BenchmarkResults = {
    ...((existing.results as BenchmarkResults | null) ?? {}),
    ...patch,
  }

  const { error: updateErr } = await supabase
    .from('benchmarks')
    .update({ results: merged, status: 'in_progress' })
    .eq('id', benchmarkId)
  if (updateErr) return { error: updateErr.message }

  return {}
}

/**
 * Finalise the benchmark: mark complete, then generate the plan with benchmark
 * results passed in via the profile (we stash them temporarily on goal_paces
 * if not already set, so the AI sees calibrated pace data).
 */
export async function finalizeBenchmark(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bench } = await supabase
    .from('benchmarks')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const benchmark = bench as Benchmark | null
  if (benchmark) {
    await supabase
      .from('benchmarks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', benchmark.id)
  }

  // Load profile and generate plan with benchmark context baked into goal_paces
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!profileData) redirect('/app/dashboard')

  const profile = profileData as Profile
  const results = (benchmark?.results ?? {}) as BenchmarkResults

  // Backfill goal_paces from benchmark results if not already set
  const existingPaces = profile.goal_paces ?? {}
  const mergedPaces = {
    swim_per_100m: existingPaces.swim_per_100m ?? results.swim_pace ?? undefined,
    bike_kmh: existingPaces.bike_kmh ?? results.bike_kmh ?? undefined,
    run_per_km: existingPaces.run_per_km ?? results.run_pace ?? undefined,
  }

  if (
    mergedPaces.swim_per_100m ||
    mergedPaces.bike_kmh ||
    mergedPaces.run_per_km
  ) {
    await supabase
      .from('profiles')
      .update({ goal_paces: mergedPaces })
      .eq('id', user.id)
    profile.goal_paces = mergedPaces
  }

  // Archive any active plan first (no-op for fresh users)
  await supabase
    .from('plans')
    .update({ status: 'archived' })
    .eq('user_id', user.id)
    .eq('status', 'active')

  const newPlan = await generatePlan(profile)
  await supabase.from('plans').insert(newPlan)

  redirect('/app/dashboard')
}

export async function skipBenchmark(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('benchmarks')
    .update({ status: 'skipped', completed_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .in('status', ['pending', 'in_progress'])

  // Generate plan without benchmark calibration
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!profileData) redirect('/app/dashboard')

  await supabase
    .from('plans')
    .update({ status: 'archived' })
    .eq('user_id', user.id)
    .eq('status', 'active')

  const newPlan = await generatePlan(profileData as Profile)
  await supabase.from('plans').insert(newPlan)

  redirect('/app/dashboard')
}
