import { createClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS. Only use in server-side webhook handlers.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}
