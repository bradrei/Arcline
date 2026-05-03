import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { triggerAdaptationAsync } from '@/lib/ai/triggerAdaptation'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_ATTEMPTS = 5
const BATCH_SIZE = 10

interface QueueRow {
  id: string
  user_id: string
  session_id: string | null
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
    .from('adaptation_queue')
    .select('id, user_id, session_id, attempt_count')
    .eq('processed', false)
    .eq('abandoned', false)
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 500 })
  }

  const rows = (queue ?? []) as QueueRow[]
  const results: { id: string; status: 'processed' | 'retried' | 'abandoned' }[] = []

  for (const row of rows) {
    const nextAttempt = row.attempt_count + 1
    await supabase
      .from('adaptation_queue')
      .update({
        attempt_count: nextAttempt,
        last_attempted_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    try {
      await triggerAdaptationAsync(supabase, row.user_id, row.session_id)
      await supabase
        .from('adaptation_queue')
        .update({ processed: true, last_error: null })
        .eq('id', row.id)
      results.push({ id: row.id, status: 'processed' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const finalAttempt = nextAttempt >= MAX_ATTEMPTS

      if (finalAttempt) {
        await supabase
          .from('adaptation_queue')
          .update({ abandoned: true, last_error: message.slice(0, 1000) })
          .eq('id', row.id)
        results.push({ id: row.id, status: 'abandoned' })
      } else {
        await supabase
          .from('adaptation_queue')
          .update({ last_error: message.slice(0, 1000) })
          .eq('id', row.id)
        results.push({ id: row.id, status: 'retried' })
      }
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
