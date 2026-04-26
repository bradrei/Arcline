import type { SupabaseClient } from '@supabase/supabase-js'
import type { NewSession } from '@/types'
import { triggerAdaptationAsync } from '@/lib/ai/triggerAdaptation'

export async function saveSessionAndTriggerAdaptation(
  supabase: SupabaseClient,
  userId: string,
  sessionData: NewSession,
) {
  const { data: savedSession, error } = await supabase
    .from('sessions')
    .insert(sessionData)
    .select()
    .single()

  if (error) throw new Error(`Session save failed: ${error.message}`)

  // Fire-and-forget — user gets confirmation immediately
  triggerAdaptationAsync(supabase, userId, savedSession.id).catch(async err => {
    console.error('Adaptation trigger failed, will retry on next load:', err)
    await supabase.from('adaptation_queue').insert({
      user_id: userId,
      session_id: savedSession.id,
    })
  })

  return savedSession
}
