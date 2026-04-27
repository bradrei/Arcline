import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectInjury } from '@/lib/ai/detectInjury'
import type { Plan, Profile, TrainingSession } from '@/types'

const RATE_LIMIT_PER_HOUR = 30
const MAX_TOKENS = 1024

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.startsWith('your-')) {
    return NextResponse.json(
      { type: 'error', message: 'Coach is not configured yet.' },
      { status: 503 },
    )
  }

  let body: { message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ type: 'error', message: 'Invalid request.' }, { status: 400 })
  }

  const message = (body.message ?? '').trim()
  if (!message) {
    return NextResponse.json({ type: 'error', message: 'Empty message.' }, { status: 400 })
  }
  if (message.length > 2000) {
    return NextResponse.json(
      { type: 'error', message: 'Message too long. Keep it under 2000 characters.' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ type: 'error', message: 'Not authenticated.' }, { status: 401 })
  }

  // Rate limit — 30 user messages per rolling hour
  const oneHourAgo = new Date(+new Date() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('coach_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'user')
    .gte('created_at', oneHourAgo)

  if ((recentCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      {
        type: 'rate_limit',
        message: "You've sent a lot of messages — let's pace ourselves. Try again in a few minutes.",
      },
      { status: 429 },
    )
  }

  // HC2 — every user message runs through injury detection
  const injuryCheck = await detectInjury(message, 'chat')
  if (injuryCheck.injured) {
    await supabase.from('coach_messages').insert({
      user_id: user.id,
      role: 'user',
      content: message,
      injury_flagged: true,
    })
    await supabase.from('injury_flags').insert({
      user_id: user.id,
      trigger_text: injuryCheck.triggerText || message,
      trigger_source: 'chat',
      referral_confirmed: false,
    })
    await supabase
      .from('plans')
      .update({ status: 'paused_injury' })
      .eq('user_id', user.id)
      .eq('status', 'active')

    return NextResponse.json({
      type: 'injury',
      triggerText: injuryCheck.triggerText || message,
      message:
        "I'm pausing our chat for a moment. Please check the screen that just opened.",
    })
  }

  // Save the user message
  const { error: insertErr } = await supabase.from('coach_messages').insert({
    user_id: user.id,
    role: 'user',
    content: message,
  })
  if (insertErr) {
    return NextResponse.json(
      { type: 'error', message: 'Could not save message.' },
      { status: 500 },
    )
  }

  // Build context — profile, current plan, recent sessions, recent chat history
  const [profileResult, planResult, sessionsResult, historyResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sessions')
      .select('session_date, session_type, duration_min, distance_km, rpe, notes')
      .eq('user_id', user.id)
      .order('session_date', { ascending: false })
      .limit(5),
    supabase
      .from('coach_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .eq('injury_flagged', false)
      .order('created_at', { ascending: false })
      .limit(11), // 10 prior + the one we just inserted
  ])

  const profile = profileResult.data as Profile | null
  const activePlan = planResult.data as Plan | null
  const recentSessions = (sessionsResult.data ?? []) as Pick<
    TrainingSession,
    'session_date' | 'session_type' | 'duration_min' | 'distance_km' | 'rpe' | 'notes'
  >[]
  const history = ((historyResult.data ?? []) as { role: 'user' | 'assistant'; content: string }[])
    .reverse()

  const today = new Date().toISOString().split('T')[0]
  const planContext = activePlan
    ? {
        version: activePlan.version,
        status: activePlan.status,
        next_two_weeks: activePlan.weeks?.slice(0, 2),
      }
    : null

  const goal = profile
    ? {
        type: profile.goal_type,
        date: profile.goal_date,
        description: profile.goal_description,
      }
    : null

  const systemPrompt = `You are Arcline, an expert triathlon and Ironman coach speaking directly to your athlete.
You have full visibility into their profile, current training plan, recent sessions, and goal.

Your tone: Direct. Knowledgeable. Warm but not soft. You coach — you don't lecture.
Use second person. Reference their actual sessions and goal date when relevant.
Keep responses concise — 2-4 paragraphs max. Athletes don't want essays.

Rules you must follow without exception:
1. Never give medical advice. If they describe pain or injury, tell them to consult a professional and stop discussing it.
2. Never recommend changes that would breach a 15% weekly load increase ceiling.
3. Never invent sessions or stats — work only with the data provided.
4. If they ask "why did you change my plan", reference the actual recent adaptation reasoning if available; if not, explain that you adjusted based on their recent sessions and load.
5. If they ask something outside your scope (medical prescriptions, gear purchasing decisions, nutrition prescriptions), give brief general guidance and recommend a specialist.

Today's date: ${today}
Athlete profile: ${JSON.stringify(profile)}
Goal: ${JSON.stringify(goal)}
Current plan (next 2 weeks): ${JSON.stringify(planContext)}
Recent sessions (most recent first): ${JSON.stringify(recentSessions)}`

  const anthropic = new Anthropic({ apiKey })
  const encoder = new TextEncoder()
  const collected: string[] = []

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          messages: history.map(m => ({ role: m.role, content: m.content })),
        })

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const chunk = event.delta.text
            collected.push(chunk)
            controller.enqueue(encoder.encode(chunk))
          }
        }

        const fullText = collected.join('').trim()
        if (fullText) {
          await supabase.from('coach_messages').insert({
            user_id: user.id,
            role: 'assistant',
            content: fullText,
          })
        }
        controller.close()
      } catch (err) {
        // Surface a final marker so the client can show an error state
        controller.enqueue(encoder.encode(''))
        controller.error(err)
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
