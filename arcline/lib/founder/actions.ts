'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function submitFounderBug(
  message: string,
  pageUrl: string,
  userAgent: string,
): Promise<{ ok?: true; error?: string }> {
  const trimmed = message.trim()
  if (!trimmed) return { error: 'Message required.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const founderEmail = process.env.FOUNDER_EMAIL
  if (!founderEmail || user.email !== founderEmail) {
    return { error: 'Not authorized.' }
  }

  // Service role client — RLS denies everyone else by design.
  const adminClient = createServiceClient()
  const { error } = await adminClient.from('founder_bug_log').insert({
    page_url: pageUrl.slice(0, 500),
    message: trimmed.slice(0, 4000),
    user_agent: userAgent.slice(0, 500),
    status: 'open',
  })

  if (error) return { error: error.message }
  return { ok: true }
}
