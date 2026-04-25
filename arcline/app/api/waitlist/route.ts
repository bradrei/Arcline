import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your-')

export async function POST(request: Request) {
  const body = await request.json() as { email?: string }
  const email = body.email?.trim()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  if (supabaseConfigured) {
    // Use service role key — waitlist table has no RLS (server-side only)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error } = await supabase.from('waitlist').insert({ email })
    if (error && error.code !== '23505') {
      // 23505 = unique_violation (already signed up) — treat as success
      console.error('[waitlist] insert error:', error.message)
      return NextResponse.json({ error: 'Failed to save. Try again.' }, { status: 500 })
    }
  } else {
    console.log(`[waitlist] ${email}`)
  }

  return NextResponse.json({ ok: true })
}
