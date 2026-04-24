import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email } = await request.json() as { email?: string }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  // TODO (Session 2): persist to Supabase waitlist table once schema is live
  console.log(`[waitlist] ${email}`)

  return NextResponse.json({ ok: true })
}
