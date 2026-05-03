import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generatePlan } from '@/lib/ai/generatePlan'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_ATTEMPTS = 3
const BATCH_SIZE = 5

interface QueueRow {
  id: string
  user_id: string
  plan_id: string | null
  attempt_count: number
}

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${expected}`
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: queue, error: queueError } = await supabase
    .from('plan_generation_queue')
    .select('id, user_id, plan_id, attempt_count')
    .eq('status', 'pending')
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 500 })
  }

  const rows = (queue ?? []) as QueueRow[]
  const results: { id: string; status: 'regenerated' | 'retried' | 'abandoned' | 'skipped' }[] = []

  for (const row of rows) {
    const nextAttempt = row.attempt_count + 1
    await supabase
      .from('plan_generation_queue')
      .update({
        status: 'processing',
        attempt_count: nextAttempt,
        last_attempted_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', row.user_id)
      .single()

    if (!profileData) {
      await supabase
        .from('plan_generation_queue')
        .update({ status: 'failed', last_error: 'Profile not found' })
        .eq('id', row.id)
      results.push({ id: row.id, status: 'skipped' })
      continue
    }

    const profile = profileData as Profile

    try {
      const newPlan = await generatePlan(profile)

      if (newPlan.is_fallback) {
        // Still a fallback — Anthropic likely still down. Queue another attempt
        // unless we've now hit MAX_ATTEMPTS.
        if (nextAttempt >= MAX_ATTEMPTS) {
          await supabase.from('plan_generation_failures').insert({
            user_id: row.user_id,
            plan_id: row.plan_id,
            attempts: nextAttempt,
            last_error: 'AI plan generation produced fallback after all retries',
          })
          await supabase
            .from('plan_generation_queue')
            .update({
              status: 'abandoned',
              last_error: 'fallback after max attempts',
            })
            .eq('id', row.id)
          results.push({ id: row.id, status: 'abandoned' })
        } else {
          await supabase
            .from('plan_generation_queue')
            .update({ status: 'pending', last_error: 'fallback returned' })
            .eq('id', row.id)
          results.push({ id: row.id, status: 'retried' })
        }
        continue
      }

      // Real AI plan — archive the previous plan, install this one
      if (row.plan_id) {
        await supabase
          .from('plans')
          .update({ status: 'archived' })
          .eq('id', row.plan_id)
      }
      await supabase.from('plans').insert(newPlan)
      await supabase
        .from('plan_generation_queue')
        .update({ status: 'done' })
        .eq('id', row.id)
      results.push({ id: row.id, status: 'regenerated' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const finalAttempt = nextAttempt >= MAX_ATTEMPTS

      if (finalAttempt) {
        await supabase.from('plan_generation_failures').insert({
          user_id: row.user_id,
          plan_id: row.plan_id,
          attempts: nextAttempt,
          last_error: message.slice(0, 1000),
        })
        await supabase
          .from('plan_generation_queue')
          .update({ status: 'abandoned', last_error: message.slice(0, 1000) })
          .eq('id', row.id)
        results.push({ id: row.id, status: 'abandoned' })
      } else {
        await supabase
          .from('plan_generation_queue')
          .update({ status: 'pending', last_error: message.slice(0, 1000) })
          .eq('id', row.id)
        results.push({ id: row.id, status: 'retried' })
      }
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
