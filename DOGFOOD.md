# Arcline Dogfood Protocol

## Daily routine (founder, weeks 1-2)
1. Open the app every day, even on rest days
2. Log every session within 12 hours of finishing it
3. Use all three logging methods at least once each in week 1 (manual, screenshot, Strava webhook)
4. Send one message to the AI Coach per day minimum
5. Tap the bug button (bottom-right, founder-only) whenever something feels off

## What to test specifically
- Does the adaptation engine fire after every session?
- Does the reasoning make sense?
- Is the load increase ever above 15%? (It should never be)
- Does the chat coach feel like a real coach or like ChatGPT?
- Does the long-term view actually help or feel like clutter?
- Does the phase indicator label match where you actually are in your build?
- Does the timeline modal load fast enough on long plans (26+ weeks)?
- Do "Ask coach about this session" prefills land naturally in chat?
- Do quick-action chips disappear when not relevant?
- Is the streak counter accurate when you take a planned rest day?

## Marketing capture
- Screenshot the first time the AI adapts because of a hard session
- Screen record one full session log to adaptation flow
- Write 200 words after week 1 — "what surprised me about training with my own AI"

## Definition of "ready for external beta"
- Founder has logged 2 full training weeks without finding a critical bug
- At least 5 adaptations have fired with sensible reasoning
- HC2 has not triggered any false positives during normal use
- Coach chat has handled at least 10 distinct conversation topics

## How to use the founder bug button
- Visible only when logged in with the email matched to `FOUNDER_EMAIL` env var
- Floats bottom-right on every `/app/*` page
- Captures: page URL, message, user agent, timestamp
- Writes to `founder_bug_log` table — review with:
  ```sql
  select created_at, page_url, message
  from founder_bug_log
  where status = 'open'
  order by created_at desc;
  ```
- Mark as resolved by updating `status = 'resolved'`

## How to bootstrap from existing Strava history
1. Connect Strava on `/app/settings/integrations`
2. Tap **Import last 90 days from Strava** (one-time)
3. Existing sessions are deduplicated automatically
4. Go to `/app/settings` → tap **Regenerate my plan with full history** to rebuild the AI plan with the imported context

## When something is clearly broken in production
- Plan generation falling back: check `plan_generation_queue` and `plan_generation_failures`
- Adaptations not firing: check `adaptation_queue` for unprocessed rows
- Strava not syncing: check `profiles.strava_needs_reauth` — if true, banner on integrations page
- HC2 false positives: review `/admin/hc2`

## Environment variables that must be set in Vercel
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` (must have credits)
- `NEXT_PUBLIC_APP_URL` (e.g. `https://arcline.vercel.app`)
- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN`
- `CRON_SECRET` (any random string, used by Vercel cron auth)
- `FOUNDER_EMAIL` (gates the bug log + admin routes)
