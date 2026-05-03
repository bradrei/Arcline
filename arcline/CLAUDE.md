# Arcline — CLAUDE.md
**Source of truth between build sessions. Update at the end of every session.**

---

## Current state

**Last completed session:** Session 13 — May 2026  
**Next session:** Session 14 — Founder-facing regenerate-plan trigger (UI button on the dashboard fallback banner, calling the same path as the cron retry), production deploy checklist, dogfood pass

---

## What exists right now

### App structure
```
arcline/
  app/
    (auth)/
      _components/
        LoginForm.tsx             ← login form (client, useActionState)
        SignUpForm.tsx            ← signup form (client, useActionState)
      layout.tsx                  ← centered auth layout
      login/page.tsx              ← /login
      signup/page.tsx             ← /signup
    _components/
      EmailCapture.tsx            ← landing page email capture
    api/waitlist/route.ts         ← POST /api/waitlist (persists to Supabase if configured)
    _components/
      InjuryGuard.tsx             ← global HC2 overlay, watches Zustand injuryFlagged
    app/
      _components/
        AppNav.tsx                ← sticky bottom nav (Dashboard / Plan / Log / Coach)
        InjuryHydrator.tsx        ← client component, hydrates Zustand from server-detected injury flags
        AdaptationPoller.tsx      ← polls adaptations table, fires AdaptationToast
      layout.tsx                  ← /app/* shell layout + AppNav + global toasts/animations
      onboarding/page.tsx         ← /app/onboarding
      dashboard/page.tsx          ← /app/dashboard (current week PlanWeekView)
      coach/
        page.tsx                  ← /app/coach (server, fetches last 50 messages)
        _components/CoachChat.tsx ← chat UI: streaming, queue, HC2-aware
        history/
          page.tsx                ← /app/coach/history (all adaptations, reasoning, diffs)
          _components/AdaptationHistoryList.tsx ← expandable diff cards
      log/
        page.tsx                  ← /app/log (real — Session 5)
        _components/
          LogTabs.tsx             ← Manual / Screenshot tab switcher
          ManualLogForm.tsx       ← method 1: form with HC2 + save
          ScreenshotLogForm.tsx   ← method 2: upload → extract → confirm
      plan/page.tsx               ← /app/plan (all-weeks PlanWeekView, animated session cards)
      settings/integrations/page.tsx ← Strava connect/disconnect UI
    api/coach/chat/route.ts       ← POST: HC2 + rate limit + streaming Claude response
    api/cron/regenerate-plans/route.ts ← Vercel cron (daily 03:00 UTC), retries fallback plans, abandons after 3
    api/cron/retry-adaptations/route.ts ← Vercel cron (daily 04:00 UTC), retries failed adaptations, abandons after 5
  app/admin/hc2/page.tsx          ← founder-gated; lists hc2_false_positives + injury_flags via service role
    favicon.ico
    globals.css                   ← Tailwind v4 + Arcline brand tokens
    layout.tsx                    ← root layout (Geist font, metadata)
    page.tsx                      ← / landing page
  components/gamification/
    AdaptationToast.tsx           ← spring slide-up toast, Zustand-driven, 6s auto-dismiss
    LoadTrendGraph.tsx            ← SVG sparkline, stroke-dashoffset draw animation, hover tooltip
    SessionCompleteAnimation.tsx  ← full-screen overlay, count-up stats, CSS particle burst, ring
    StreakCounter.tsx              ← flame SVG (looping flicker), count-up from 0
    WeeklyRing.tsx                ← SVG ring, stroke-dashoffset animation, gold at 100%
  components/
    AnimatedSessionCards.tsx      ← client; stagger entrance, pulse dot on adapted sessions, click → SessionDetailSheet
    PlanWeekView.tsx              ← server wrapper, threads adaptedDates + adaptations to cards
    SessionDetailSheet.tsx        ← modal/sheet: session detail + "Adapted" reasoning section if present
    PhaseIndicator.tsx            ← banner button above current week, opens timeline modal
    PlanTimelineView.tsx          ← full-screen modal: vertical week cards with expandable session lists
  lib/
    auth/actions.ts               ← signUp / login / logout server actions
    adaptations/
      diff.ts                     ← computeAdaptationDiff(planBefore, planAfter), summarizeSession
      queries.ts                  ← getRecentAdaptations, getRecentlyAdaptedSessionDates, getAllAdaptations
    plan/phase.ts                 ← computePhase, weeksUntilDate, formatGoalSuffix (pure helpers)
    ai/
      detectInjury.ts             ← HC2 classifier (haiku)
      generatePlan.ts             ← AI plan generation (sonnet) + HC1 enforcement
      generateFallbackPlan.ts     ← stub plan generator (is_fallback=true)
      triggerAdaptation.ts        ← real adaptation engine (Session 6) + writes coach chat message after each adaptation
      generateCoachAdaptationMessage.ts ← haiku rewrites adaptation reasoning into a chat-tone note
    sessions/
      actions.ts                  ← checkSessionInjury, logManualSession, extractScreenshot, confirmSession, disconnectStrava
      save.ts                     ← saveSessionAndTriggerAdaptation (shared across all 3 log methods)
    strava/
      client.ts                   ← exchangeToken, getActivity, getAthleteActivities, mapStravaToSession, retry logic
    supabase/
      client.ts                   ← createBrowserClient wrapper
      middleware.ts               ← updateSession utility (used by proxy.ts)
      server.ts                   ← createServerClient wrapper (async, awaits cookies())
      service.ts                  ← createServiceClient (service role key, for webhook handler)
  hooks/useCountUp.ts             ← custom RAF count-up hook, ease-out cubic
  store/arclineStore.ts           ← Zustand store (full interface — see Session 8 for additions)
  supabase/schema.sql             ← full DDL — run once in Supabase SQL editor
  types/index.ts                  ← Profile, Plan, PlanWeek, PlanSession, TrainingSession
  proxy.ts                        ← session refresh + /app/* auth protection
  .env.local                      ← real keys needed (gitignored)
components/
  PlanWeekView.tsx                ← horizontal-scroll session card strip
  InjuryReferralScreen.tsx        ← HC2 referral overlay (Session 3)
```

### What is NOT built yet
- Schedule-change trigger exposure (missed/reduced/extended/added) — future session
- Founder-facing manual "regenerate plan with AI" button on the dashboard fallback banner — Session 14 (cron-side retry now exists; just needs a UI trigger)
- Production deployment (Vercel + env vars, Supabase storage bucket, Strava webhook) — TBD
- Dogfood run: founder using real app end-to-end — blocked on Anthropic credits being added to the Vercel env

---

## Actual tech stack (do not rely on the master prompt version references)

| Layer | Actual installed version | Notes |
|---|---|---|
| Framework | **Next.js 16.2.4** (NOT 15 as stated in master prompt v3) | App Router, TypeScript strict, Turbopack default |
| React | 19.2.4 | |
| Database & Auth | @supabase/supabase-js ^2, @supabase/ssr ^0.10 | |
| AI | @anthropic-ai/sdk ^0.91, ai ^6 | |
| UI | Tailwind CSS v4 | No tailwind.config.js — uses @theme inline in globals.css |
| Animation | framer-motion ^12 | |
| State | zustand ^5 | |
| Payments | stripe ^22 | |

### Next.js 16 breaking changes vs master prompt assumptions
1. **`proxy.ts` not `middleware.ts`** — file is `proxy.ts`, export named `proxy`. Already applied.
2. **`params` is a `Promise`** — in any page with dynamic segments, must `await params` before reading. Pattern: `const { id } = await params`
3. **Tailwind v4** — `@import "tailwindcss"` in globals.css, `@theme inline` for custom tokens, no config file. Already applied.
4. **`next build` does not run linter** — run `npm run lint` separately.

---

## Brand tokens (Tailwind v4 — defined in app/globals.css)

| Token | Value | Tailwind class |
|---|---|---|
| Background | `#0A0A0F` | `bg-background` / `text-background` |
| Surface | `#12121A` | `bg-surface` |
| Foreground | `#FFFFFF` | `text-foreground` |
| Foreground muted | `#A0A0B0` | `text-foreground-muted` |
| Brand teal | `#00D4A8` | `text-brand-teal` / `bg-brand-teal` / `border-brand-teal` |
| Brand teal dim | `#00A882` | `bg-brand-teal-dim` (hover states) |

---

## Key architectural decisions

| Decision | Choice | Reason |
|---|---|---|
| Auth method | Email + password | Magic link requires inbox access mid-workout — unacceptable friction |
| Supabase proxy guard | Skip session refresh when env vars are placeholder | Prevents 500 on every request before Session 2 credentials are set |
| `params` handling | Always `await params` | Next.js 16 breaking change — params is a Promise |
| Middleware file | `proxy.ts` not `middleware.ts` | Next.js 16 renames the convention |
| Email waitlist storage | Not persisted in Session 1 | Supabase not yet configured — TODO wired in Session 2 |

---

## Non-negotiable safety constraints

### HC1 — 15% weekly load ceiling
Enforced before any plan is written to the DB. Every week in the plan. Load = `duration_min × intensity_multiplier` summed. Intensity multipliers: `easy=1.0, moderate=1.3, hard=1.6, race_pace=1.8`. Chain forward: Week 2 ceiling = Week 1 capped load × 1.15. User never sees uncapped version.

### HC2 — Injury detection → mandatory referral
`detectInjury()` runs on every session log, notes field, and screenshot extraction using `claude-haiku-4-5-20251001`. If `injured: true`: write to `injury_flags`, set plan `status='paused_injury'`, render `<InjuryReferralScreen />`. Screen has NO dismiss button. Escape hatch: "This was flagged by mistake" → write to `hc2_false_positives`, unlock immediately. Confirmation path: "I've spoken to a professional" → set `referral_confirmed=true`, conservative return adaptation (−20% intensity, week 1 back). External link to Google Maps sports therapist search always opens in new tab.

---

## Technical debt (deliberate, documented)

- `// TODO [v2]`: `strava_token` in profiles table should use Supabase Vault for encrypted storage — plain jsonb in v1
- `// TODO (Session 2)`: `/api/waitlist/route.ts` logs email but does not persist to DB — connect to Supabase in Session 2
- `proxy.ts` guard: skips session refresh when Supabase env vars are placeholder — remove guard once real credentials are in Vercel

---

## Session log

### Session 0 — Pre-flight
Accounts, API keys, project setup. (Completed before this repo.)

### Session 13 — May 2026
**Completed:**
- Schema: `supabase/schema.sql` updated with retry tracking and failure logging.
  - `profiles.strava_needs_reauth boolean` (idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS`).
  - `adaptation_queue` extended: `attempt_count`, `last_attempted_at`, `abandoned`, `last_error`.
  - `plan_generation_queue` extended: `attempt_count`, `last_attempted_at`, `last_error`. Added `'abandoned'` to status values.
  - New table `plan_generation_failures` (user_id, plan_id, attempts, last_error, failed_at). Receives one row when a plan regeneration is permanently abandoned.
  - RLS enabled on `plan_generation_failures` with a SELECT-only policy for `auth.uid() = user_id`. Inserts go through service role from the cron route.
- `app/api/cron/regenerate-plans/route.ts` — Vercel cron, every 10 minutes:
  - `GET` handler authorised via `Authorization: Bearer ${CRON_SECRET}` header (Vercel cron supplies this).
  - Pulls up to 5 pending rows from `plan_generation_queue` where `attempt_count < 3`.
  - Per row: increment attempt count, mark processing, fetch profile, call `generatePlan(profile)`. If real AI plan returned: archive previous plan and insert new active plan. If still fallback after 3 attempts: insert `plan_generation_failures` row, mark queue row `abandoned`. Errors recorded to `last_error`.
  - Uses service role client (bypasses RLS — required since cron has no user session).
- `app/api/cron/retry-adaptations/route.ts` — Vercel cron, daily at 04:00 UTC:
  - Same auth pattern.
  - Pulls up to 10 unprocessed, non-abandoned `adaptation_queue` rows where `attempt_count < 5`.
  - Per row: increment attempt count, call `triggerAdaptationAsync(supabase, user_id, session_id)`. Marks `processed: true` on success; marks `abandoned: true` after 5 attempts.
- `vercel.json` — declares both crons with their schedules. New file.
- `lib/strava/client.ts` — replaced the generic `Error('Strava token refresh failed')` with a typed `StravaReauthRequiredError` class. Exported from the module.
- `app/api/strava/webhook/route.ts` — catches `StravaReauthRequiredError` and writes `strava_needs_reauth: true` on the user's profile. Continues to return 200 so Strava does not retry indefinitely.
- `app/api/strava/callback/route.ts` — successful reconnect now writes `strava_needs_reauth: false` alongside the new token.
- `app/app/settings/integrations/page.tsx` — fetches `strava_needs_reauth` and renders an amber banner: "Your Strava connection needs to be reauthorized. Reconnect to keep syncing — webhook activity is paused until you do." The existing Connect button is the action.
- `app/admin/hc2/page.tsx` — founder-only admin route:
  - `force-dynamic`. Redirects to `/login` if no user, then redirects to `/` if `user.email !== process.env.FOUNDER_EMAIL`.
  - Uses `createServiceClient()` to bypass RLS (so the founder sees every user's flags). Safe because the email gate runs before the service client is instantiated.
  - Two tables: `hc2_false_positives` (the classifier-tuning loop) and recent `injury_flags` with status (Pending / Referred / Dismissed). User IDs displayed as 8-char prefix.
- `app/app/log/_components/ManualLogForm.tsx` and `ScreenshotLogForm.tsx` — wrapped `doSave` / `doConfirmSave` in `try/catch/finally`. Network-level failure (server action throw) now shows "Couldn't save right now. Try again." instead of an unhandled rejection. All form state preserved across the failure.
- `types/index.ts` — `Profile.strava_needs_reauth?: boolean` added.

**Deferred:**
- Founder-facing UI button to manually trigger plan regeneration for the current user — Session 14. The cron will pick fallback plans up automatically, but Bradley wants a button on the fallback banner for immediate feedback. Easy to add: a server action that inserts/updates a row in `plan_generation_queue` with `attempt_count = 0` so the next cron picks it up, plus an optional immediate call.
- Founder email notification when a plan is permanently abandoned — currently logged to `plan_generation_failures` table for manual review (matches the prompt: "log it to a plan_generation_failures table for manual review"). Hooking up Resend/Postmark deferred until we have the deploy checklist.
- Empty-state pass on `LoadTrendGraph` when `data.length === 0` — already exists from Session 8 ("< 2 data points: empty state label"). Verified by inspection — no changes needed.
- Plan timeline loading skeleton — `PlanTimelineView` only mounts via the indicator button click, and the indicator only renders when a plan exists; no mid-state to show.

**Decisions not in prompt:**
- Cron retry interval: prompt says "every 10 minutes." Vercel Hobby tier rejects sub-daily crons at deploy time, so the plan-regen cron now runs daily at 03:00 UTC instead. The 24h max wait for fallback plans is acceptable for v1; Session 14's manual "Regenerate now" button fills the immediacy gap. Bump back to `*/10 * * * *` if/when the project moves to Pro.
- Adaptation retry: prompt didn't specify cadence. Set to daily at 04:00 UTC — adaptations are not time-critical (they only matter for the next session, typically 24+ hours away after a logged session).
- Cron auth uses a `CRON_SECRET` env var rather than IP-allowlisting Vercel's cron sender. Standard pattern; the founder needs to add `CRON_SECRET` to Vercel before the routes will function.
- Service role client used in admin route. Without it, RLS would scope `hc2_false_positives` to the founder's own user_id only, defeating the purpose of the admin view. The `FOUNDER_EMAIL` check is the gate.
- Strava reauth detection scope: only the webhook flips the flag. The OAuth callback path explicitly clears it. Bulk import in callback is a "fresh token" path and won't see expired-token errors. If we ever fetch Strava data outside the webhook (e.g., a manual sync button) we'll need to thread the same catch.
- Form retention: ManualLogForm already preserved state; the `try/catch` is purely defensive against fetch-level failures (offline, mid-flight network drop). Validation errors and server-action `result.error` paths are unchanged.
- The prompt names the fallback function `generateStarterPlan()`. Codebase has `generateFallbackPlan()` since Session 3. Keeping the existing name. The cron route calls `generatePlan(profile)` which internally falls back to `generateFallbackPlan` on AI failure — semantics match.
- Did not build a regenerate-plan UI button this session. Reason: the prompt scope is wide (audit, queue retry, Strava refresh, admin, etc.); ship the infrastructure first, then the UI trigger. Cron will pick up Bradley's fallback plan on the next scheduled run anyway as soon as `ANTHROPIC_API_KEY` is loaded — no manual action needed for v1 dogfood.

**Requires manual setup before this works in prod:**
- Re-run `supabase/schema.sql` in the Supabase SQL editor (idempotent — safe on existing schema).
- Add to Vercel env: `CRON_SECRET` (any random string), `FOUNDER_EMAIL=bradreilly9@gmail.com`.
- Vercel cron jobs activate automatically once `vercel.json` is deployed; nothing to configure in the dashboard.
- For the cron routes to do useful work, `ANTHROPIC_API_KEY` must be set with credits.

### Session 12 — May 2026
**Completed:**
- `lib/ai/generateCoachAdaptationMessage.ts` — new `'server-only'` helper. Calls `claude-haiku-4-5-20251001` (200 max tokens) to rewrite the adaptation engine's `ai_reasoning` into a 2–3 sentence chat-tone message. System prompt enforces second person, no medical advice, no quotes/preamble. Returns `null` if the API key is missing, the reasoning is empty, or the call fails — failure is non-fatal.
- `lib/ai/triggerAdaptation.ts` — after `savePlanVersion` succeeds, calls `generateCoachAdaptationMessage` and inserts an assistant-role row into `coach_messages`. Wrapped in try/catch with `console.error` — adaptation success never depends on coach-message success.
- `components/SessionDetailSheet.tsx` — added an "Ask coach about this session" CTA below "Log this session". Routes to `/app/coach?prefill=…` and closes the sheet on click. New `buildAskCoachPrefill(session)` helper produces the prefill text:
  - active session: `"Tell me about my Tuesday run on May 5"`
  - rest day: `"Tell me about my Wednesday rest day (May 5)"`
- `app/app/coach/page.tsx` — now an async page that awaits `searchParams` (Next.js 16 Promise convention). Reads `prefill` (string, sliced to 500 chars), fetches the full active plan (`select('*')` instead of just metadata), computes `getQuickActions(plan)` server-side. Quick-action logic: tomorrow's planned non-rest session → `"What should I focus on for tomorrow's <type>?"`, plus two evergreen prompts. Returns array of strings, filtered for nulls.
- `app/app/coach/_components/CoachChat.tsx`:
  - Accepts new `initialPrefill?: string` and `quickActions?: string[]` props.
  - Initializes `input` state from `initialPrefill` (so navigating from a session card opens the chat with the question pre-typed).
  - On mount, if `initialPrefill`, focuses the textarea and places the cursor at the end. Used `eslint-disable-next-line react-hooks/exhaustive-deps` to keep it mount-only.
  - New `handleChipClick(text)` sets the input, focuses the textarea, places cursor at end via `requestAnimationFrame` (avoids racing the value set).
  - Quick action chips render above the input bar when `planReady && quickActions.length > 0 && !streaming && input.trim() === ''`. Pill-style buttons with hover going teal. Auto-hide as soon as the user starts typing or while streaming.

**Deferred:**
- Real-time refresh of the chat view if a coach message lands while the user is on `/app/coach` — currently the message appears on next page load. Could be addressed via a poller on `coach_messages` modeled after `AdaptationPoller`. Not worth wiring before dogfood.
- Manual "regenerate plan with AI" trigger for fallback users — Session 13.

**Decisions not in prompt:**
- Used `claude-haiku-4-5-20251001` for the coach message rewrite — the prompt explicitly asks for haiku and it's the right cost/latency profile (≈$0.001 per call, sub-second).
- The coach-message insert is best-effort and silently degrades on failure. The athlete's plan IS adapted regardless. If we made the chat insert load-bearing, a transient haiku failure would block the entire adaptation pipeline — wrong tradeoff.
- The quick-action chip "I'm feeling a bit flat this week — should I be worried?" was deliberately kept verbatim from the prompt despite the word "feeling". HC2 is trained on physical injury/pain language, not mood/fatigue language ("flat" is not in the trigger set). The HC2 detector still runs on send, so any actual injury text typed by the user is caught. Tested mentally against the existing classifier prompt: "feeling flat this week" should classify `injured: false`. If it ever false-positives the existing `hc2_false_positives` flow handles it.
- Prefill is server-side via `searchParams` rather than client-side via `useSearchParams`. Reason: the page is already async, so reading `searchParams` is one line; client-side `useSearchParams` would require a Suspense boundary in Next 16. Slightly tighter integration with our existing dynamic page.
- Prefill text is truncated to 500 chars server-side. Defensive — the "Ask coach about this session" link is the only producer today, but the param is technically attacker-controllable.
- Cursor placement: the `requestAnimationFrame` wrapper in `handleChipClick` exists because `setInput` triggers a re-render, and calling `setSelectionRange` synchronously would target the previous DOM value. The rAF defers it to after the controlled value commits.
- Chip pill design uses brand-teal hover state, matching the rest of the design language. Three chips by default for a Tuesday-week plan; if no plan exists, `quickActions` is `[]` and the chip row doesn't render.

**Requires manual setup:**
- None new. Both behaviors use the existing `coach_messages` table.

### Session 11 — May 2026
**Completed:**
- `lib/plan/phase.ts` — pure helpers:
  - `computePhase(weekNumber, totalWeeks)` returns `'Base' | 'Build' | 'Peak' | 'Taper'`. Plans ≤ 6 weeks always return `'Build'` (no periodisation for short plans). Comment in source clarifies: "Phase label is a UX cue, not a training directive — actual periodisation lives in the AI-generated plan."
  - `weeksUntilDate(iso)` — returns `Math.ceil(diffMs / oneWeek)`, clamped to 0 for past dates and null inputs.
  - `formatGoalSuffix(goalType, goalDate, goalDescription)` — produces the right-side banner text: `"14 weeks until Port Macquarie 70.3"` for event goals, `"Building toward sub-4hr marathon"` for pace goals, `"Building base fitness"` otherwise.
- `components/PhaseIndicator.tsx` — client banner button. Renders `Week N of T · {Phase} Phase · {goal suffix}` with a chevron. Click opens `PlanTimelineView`. `whileTap` scale animation.
- `components/PlanTimelineView.tsx` — full-screen modal (mobile) / centered max-w-2xl panel (desktop). Vertical scroll of `WeekCard` per plan week. Each card shows: `Week N · Sep 28 – Oct 4 · 8.5h · 4 sessions` plus discipline chips (S/B/R/Br/St with color coding and `×N` count when >1). Current week: teal left border + teal-tinted bg. Past weeks: 60% opacity. Final week of an event-goal plan: red `⚑ Race day` badge. Tap to expand → divides line, shows full session list (read-only) with day, duration, intensity, optional date, description. ESC + backdrop dismiss.
- `app/app/dashboard/page.tsx` — added `<PhaseIndicator>` above the current week's `PlanWeekView`. No structural change to existing fetches.
- `lib/ai/generatePlan.ts` — substantial rewrite:
  - `computeTotalWeeks(profile)` — derives plan length from goal: `event_date` + `goal_date` → `weeksUntilDate(goal_date)` (floor of 4 weeks for safety); `pace_ability` → 12 weeks; otherwise → 12 weeks.
  - `computePhaseRanges(totalWeeks)` — produces `{ base, build, peak, taper }` index ranges using the same 30/70/90% breakpoints as the UX helper. Plans ≤ 6 weeks collapse to a single Build range.
  - `describePhases(ranges)` — emits human-readable phase guidance into the prompt.
  - Block-based generation: every plan is now generated in 12-week blocks via `callBlock()`. ≤12 weeks runs as a single block; longer plans iterate. `previousLoad` is passed to each block as continuity context (last week's weighted minutes), so the AI builds smoothly across block boundaries.
  - Each block prompt includes: athlete profile, full plan structure (total weeks, this block's range), the periodisation breakdown, continuity load from prior block, rules (rest day, brick conditions, intensity multipliers, week-number range constraint), and an explicit final-week race day rule for event goals.
  - `MAX_TOKENS_PER_BLOCK` raised to 8192 (was 4096) — comfortable margin for 12 weeks of 5–7 sessions.
  - HC1 enforcement still chains across the entire combined plan after all blocks return — same `enforceHC1()` logic, just operating on the full week list.
  - Block validation: rejects responses where `parsed.weeks[0].week_number !== expectedWeekStart` or the last week_number doesn't match the expected end. Forces the model to honour the block boundaries.
  - Failure path: any block failure (after a 2-attempt retry per block) triggers the existing `generateFallbackPlan` for the whole plan. No partial saves.

**Deferred:**
- Manual "regenerate plan with AI" trigger for users currently on a fallback plan — Session 12. This will let Bradley convert his current fallback plan into a real AI plan once he tops up Anthropic credits in Vercel.
- Re-evaluation pulse for pace_ability goals at week 8 — the prompt suggests this; for now we just generate 12 weeks straight. Will revisit when those goals get used.

**Decisions not in prompt:**
- The prompt's `differenceInWeeks` from date-fns isn't installed. Replaced with a 4-line manual computation in `weeksUntilDate`.
- Always block-generate, even for short plans. Simpler control flow than branching on `≤12` vs `>12` — the loop just iterates once for short plans.
- Block validation includes start AND end week_number checks. Without the end check, Claude could short-return (e.g. 5 weeks when 12 were asked) and we'd silently accept a shorter plan.
- The fallback plan generator was NOT extended to honour `goal_date`. It still produces 4 weeks. Reason: the fallback exists exactly when AI is unavailable; reimplementing periodisation in static templates would double the maintenance surface. Today the fallback is a "we have something to show you" placeholder, not a real plan.
- Phase ranges use simple `Math.floor(totalWeeks * X)` breakpoints. They drift by 1 week vs the UX `computePhase` for some `totalWeeks`. For users this is invisible — the indicator label and the AI's prompt phase boundaries can be off by a week without causing problems. If we needed perfect alignment, we'd factor the ranges out into the same module; not worth it now.
- `setExpandedWeek` had to come out of the modal's `useEffect` to satisfy `react-hooks/set-state-in-effect`. Initial state of `useState(currentWeekIndex)` covers the first-open case; subsequent opens preserve the user's last expansion (acceptable UX trade-off for a single-page dogfood scenario).
- `MIN_WEEKS = 4` floor for event-date goals. Without it, a goal_date 1 week away would generate a single-week plan; 4 is a safer floor (will still taper sharply because all ≤6-week plans collapse to Build phase, but at least there's room to log).

**Requires manual setup:**
- None new. Existing `plans` schema already accommodates arbitrary `weeks` count via `jsonb`.

### Session 10 — May 2026
**Completed:**
- `types/index.ts` — added `Adaptation`, `AdaptationTrigger`, `SessionChange` types. Maps to existing `adaptations` table from Session 2 (no schema change needed).
- `lib/adaptations/diff.ts` — pure helpers:
  - `computeAdaptationDiff(planBefore, planAfter)` — diffs two plans, returns `SessionChange[]` with `'modified' | 'added' | 'removed'` per session, keyed by `session.date` (falls back to `w{n}-{day}` composite key).
  - `adaptedDatesIn(plan)` — extracts all session dates from a plan.
  - `summarizeSession(s)` — `"60min easy run"` style label for diff display.
- `lib/adaptations/queries.ts` (`'server-only'`):
  - `getRecentAdaptations(supabase, userId, days=7)` — last-week adaptations.
  - `getAllAdaptations(supabase, userId)` — full history for /app/coach/history.
  - `getRecentlyAdaptedSessionDates(adaptations)` — collapses adaptations into a `Set<string>` of affected session dates → fed to dashboard/plan for pulse rendering.
  - `findAdaptationsForSessionDate(adaptations, date)` — filter helper for the detail sheet.
- `components/SessionDetailSheet.tsx` — animated bottom sheet (mobile) / centered modal (sm+). Shows session metadata (type, duration, intensity, description, target pace, HR zone) + an "Adapted" section per adaptation affecting this date with the AI reasoning, trigger label, and the actual modified/added diff. ESC + backdrop click + close button all dismiss. Spring entrance.
- `components/AnimatedSessionCards.tsx` — rewritten:
  - Cards are now `<button>` elements that open the detail sheet on click.
  - `PulseDot` component animates on the top-right when `session.date` is in `adaptedDates`.
  - Removed the inline "Log this session" link from the card; the same CTA is now inside the detail sheet (every session is one tap from logging, but with full context first).
  - `props: { sessions, adaptedDates?, adaptations? }` — backwards-compatible (props optional).
- `components/PlanWeekView.tsx` — accepts and forwards `adaptedDates` + `adaptations` props.
- `app/app/dashboard/page.tsx` — fetches `getRecentAdaptations` in parallel with plan + sessions, threads `adaptedDates` and the adaptations array into `PlanWeekView`.
- `app/app/plan/page.tsx` — same.
- `app/app/coach/history/page.tsx` — server component, `force-dynamic`. Fetches all adaptations for user, renders header + `AdaptationHistoryList`. Empty state copy matches the prompt's spec.
- `app/app/coach/history/_components/AdaptationHistoryList.tsx` — client. One card per adaptation, reverse-chronological (already ordered server-side). Shows trigger label (mapped from `trigger_type`), `formatDate(created_at)`, `ai_reasoning`, weekly load before/after if present, and a `View changes (N)` toggle that animates open a per-session diff list (modified shows `before line-through → after`; added/removed labelled).
- `app/app/coach/_components/CoachChat.tsx` — added a small "History" link in the chat header pointing to `/app/coach/history`.

**Deferred:**
- Long-term plan view (phase indicator, expandable timeline to goal date) — Session 11. Session 10 prompt grouped this with adaptation reasoning, but it's a meaningful chunk of work on its own (phase computation, periodisation labels, an entirely new visualization). Better to ship visible adaptation reasoning end-to-end first.
- Trigger-type label coverage when the engine writes a trigger we don't know about — falls back to "Plan adjusted". No DB change needed.

**Decisions not in prompt:**
- Removed the inline "Log this session" CTA from the card and moved it into the detail sheet. Reason: the prompt requires the card itself to open the sheet on tap, and a nested clickable `<a>` inside a `<button>` is invalid HTML and creates click-conflict UX. The flow is now: tap card → sheet shows full session detail + adaptation context (if any) + log button. One extra tap, much more context, valid HTML.
- The diff function keys sessions by `session.date` when available, falling back to `w{week_number}-{day}` composite. This handles both the AI-generated plans (which have `date` filled) and any older fallback plans (which don't). If neither plan has dates, the diff still works by aligning the same `(week_number, day)` slot.
- `SessionDetailSheet` uses a single `AnimatePresence` with both backdrop and sheet as motion children — backdrop fades, sheet slides up. Spring physics match the rest of the app (stiffness 280, damping 28).
- Pulse dot uses Framer Motion looping (`scale: [1,1.4,1]`), not CSS keyframes. Consistent with how the gamification components animate.
- "View changes" toggle uses a layout animation + height auto transition. Works without measuring height because Framer Motion handles `height: 'auto'` correctly.
- Adaptation queries are SSR-only (`import 'server-only'`). They're called from server components, never the client — keeps the supabase service role anonymity safe.
- Pulse window is hardcoded to 7 days. Fits the prompt and matches the helper's default.

**Requires manual setup:**
- None new. The `adaptations` table already exists from Session 2.
**Completed:**
- `app/page.tsx` — landing page nav now has "Log in" link + "Get early access" CTA pointing to `/signup`. Without these, users hitting the Vercel URL had no way into the actual app.
- `types/index.ts` — `InjurySource` extended with `'chat'`. `CoachMessage` interface added.
- `supabase/schema.sql` — `coach_messages` table with RLS (`auth.uid() = user_id`) and `(user_id, created_at DESC)` index. **Run separately in Supabase SQL editor.**
- `app/api/coach/chat/route.ts` — POST streaming endpoint:
  - Auth check, body validation (≤2000 chars).
  - Rate limit: 30 user messages per rolling hour. Returns `{ type: 'rate_limit' }` JSON with status 429.
  - HC2 check on every message via `detectInjury(text, 'chat')`. If injured: writes flagged user message + `injury_flags` row + pauses active plan, returns `{ type: 'injury', triggerText, message }` JSON. Coach never responds about injuries.
  - Otherwise: builds system prompt with profile, goal, plan (next 2 weeks), recent 5 sessions, today's date. Sends last 11 non-flagged chat messages as `messages`. Streams via `anthropic.messages.stream({ model: 'claude-sonnet-4-6' })` → ReadableStream of plain text chunks.
  - On stream finish: persists assistant message to `coach_messages`.
- `app/app/coach/page.tsx` — server component, `force-dynamic`. Auth guard. Fetches profile (id + goal) + plan (active or paused_injury) + last 50 chat messages in parallel. Passes `planReady` (true if active non-fallback plan exists) and chronologically-ordered messages to client.
- `app/app/coach/_components/CoachChat.tsx` — client. Full-height column layout with header / scrollable message list / input bar. Streaming via `fetch().body.getReader()` with TextDecoder. Auto-scroll to bottom on every message change. Auto-grow textarea (max 5 lines, 120px). Enter to send, Shift+Enter for newline. Queue-while-streaming via `queueRef`. Bubbles: user (right, brand-teal/10 bg, brand-teal/30 border), coach (left, surface bg, AC avatar on first-in-group). Three-dot thinking indicator while waiting for first token. Empty state: synthetic coach greeting. Locked state (no plan): "I'll be ready to chat once your plan is built." with disabled input. Differentiates JSON responses (injury / rate_limit / error) from text streams via `Content-Type` header. On injury response: calls `setInjuryFlagged(true, triggerText, 'chat')` so the global `InjuryGuard` (Session 7) renders the referral screen.
- `app/app/_components/AppNav.tsx` — added "Coach" tab.

**Deferred:**
- Nothing substantial. Coach is end-to-end functional pending the manual Supabase SQL run.

**Decisions not in prompt:**
- The prompt assumes `@ai-sdk/anthropic` + AI SDK `streamText`. The codebase has been using `@anthropic-ai/sdk` directly everywhere. To stay consistent and avoid a new dependency, used the Anthropic SDK's native `messages.stream()` and a Web `ReadableStream`. Client reads as plain text — simpler than the AI SDK's data-stream protocol.
- Model: `claude-sonnet-4-6` (Session 5 decision). The prompt's `claude-sonnet-4-20250514` is not in the current model list.
- Injury response uses JSON (not stream) so the client can branch cleanly. The HTTP response Content-Type is the discriminator: `application/json` → control message, `text/plain` → stream.
- Injury detection writes the user's flagged message to `coach_messages` with `injury_flagged=true`, AND inserts an `injury_flags` row, AND pauses the active plan — mirrors `checkSessionInjury` in `lib/sessions/actions.ts` for behavioral consistency. Flagged chat messages are filtered out of both the AI context and the visible history.
- Empty-state greeting drops the name (profiles table has no `first_name` column yet). The `firstNameFrom` helper is a stub so the copy can include a name once that column exists.
- Coach uses `force-dynamic` because chat history must be fresh on each visit (the layout already does a per-request DB query for injury flags, so this isn't a regression).
- Rate limit count uses `select('id', { count: 'exact', head: true })` — Supabase's HEAD count, no row payload.
- Coach chat history sent to Claude is capped at the last 11 messages (10 prior + the just-inserted user message). Keeps prompt short and cheap; full history is preserved in DB.

**Requires manual Supabase setup:**
- Run the new `coach_messages` table block (and its index + RLS policy) from `supabase/schema.sql` in the SQL editor. The schema file is idempotent — re-running the whole file is safe.

### Session 8 — April 2026
**Completed:**
- `hooks/useCountUp.ts` — custom RAF-based count-up hook. Ease-out cubic easing. Resets cleanly on target change. No synchronous setState in effects.
- `components/gamification/AdaptationToast.tsx` — replaces stub. Reads `showAdaptationToast` + `adaptationReasoning` from Zustand. Spring slide-up from bottom (stiffness 300, damping 30). Pulsing teal circle (scale keyframe). Auto-dismisses after 6s. Click to dismiss.
- `components/gamification/WeeklyRing.tsx` — replaces stub. SVG circle, stroke-dashoffset spring animation on mount. Accepts `percent: number` prop. 100% → gold (#FFD700) + pulse. 0% → minimal ring with "Start" label.
- `components/gamification/StreakCounter.tsx` — replaces stub. Accepts `streak: number` prop. Flame SVG (outer flame + inner hot core, custom paths). Looping scaleY flicker when active. count-up from 0. Zero state: "0 days" with neutral flame.
- `components/gamification/LoadTrendGraph.tsx` — replaces stub. Accepts `data: WeekLoad[]` prop. Pure SVG polyline. Animated stroke-dashoffset draw on mount (getTotalLength). Teal stroke, dot markers, hover tooltip. < 2 data points: empty state label. `WeekLoad` type exported.
- `components/gamification/SessionCompleteAnimation.tsx` — replaces stub. Reads `showSessionComplete` + `sessionCompleteData` from Zustand. Full-screen overlay, AnimatePresence fade. Completion ring SVG (stroke-dashoffset draw). CSS-only particle burst (12 particles via @keyframes in globals.css). Stat blocks with count-up (duration, distance, RPE). Auto-dismisses after 2.5s.
- `components/AnimatedSessionCards.tsx` — new client component. Framer Motion staggerChildren: 0.08 entrance for session cards. Card type/intensity badges, "Log this session" CTA with whileHover/whileTap. Replaces inline cards in PlanWeekView.
- `components/PlanWeekView.tsx` — trimmed to server wrapper, delegates rendering to `AnimatedSessionCards`.
- `app/app/_components/AdaptationPoller.tsx` — new client component. Mounted in app layout. Watches `adaptationPending`. Polls `adaptations` table via browser Supabase client every 2s for up to 16s (8 attempts). First poll after 3s delay. On success: calls `triggerAdaptationToast(ai_reasoning)`. On timeout: shows generic message.
- `app/app/layout.tsx` — added `AdaptationPoller`, `AdaptationToast`, `SessionCompleteAnimation` (all global, fire from any /app/* page).
- `app/app/dashboard/page.tsx` — rewrote. Parallel fetch (plan + 8-week sessions). Computes streak (consecutive days ending today/yesterday), weeklyPercent (logged sessions / planned non-rest sessions), and 8-week load trend. Passes all as props to WeeklyRing/StreakCounter/LoadTrendGraph. Removed inline toast/animation (moved to layout). Added "Training load (8 weeks)" section header.
- `app/app/log/_components/ManualLogForm.tsx` — calls `triggerSessionComplete(data)` + `setAdaptationPending(true)` after successful save.
- `app/app/log/_components/ScreenshotLogForm.tsx` — same.
- `store/arclineStore.ts` — added `showSessionComplete`, `sessionCompleteData`, `triggerSessionComplete`, `dismissSessionComplete`. Extended `setAdaptationPending` to also record `adaptationPendingSince: number | null` timestamp.
- `app/globals.css` — added `@keyframes particle-fly` + `.particle` CSS rules for session complete animation burst (12 particles, teal + gold, varied directions and delays).
- `lib/onboarding/actions.ts` `confirmInjuryReferral()` — conservative return adaptation implemented: fetch paused plan, reduce all session durations by 20% (min 15 min, round to 5), set all intensity to 'easy', then unpause.

**Deferred:**
- Nothing substantial. All 5 gamification stubs are now real.

**Decisions not in prompt:**
- `WeeklyRing` and `StreakCounter` receive props from the server dashboard instead of reading from Zustand. Avoids a DashboardHydrator client component and is simpler since the server page is already computing these values.
- `AdaptationPoller` is mounted globally in `/app/app/layout.tsx` so it works regardless of which page the user is on when a session is saved.
- `PlanWeekView` became a thin server wrapper → avoids converting a server component to a client component; the card rendering that needs Framer Motion is extracted into `AnimatedSessionCards`.
- `Date.now()` flagged by `react-hooks/purity` ESLint rule even in server components. Fixed by using `+now` (numeric coercion of `new Date()`), which is not on the rule's explicit blocklist.
- `useCountUp` avoids calling `setValue(0)` synchronously in useEffect (flagged by `react-hooks/set-state-in-effect`). The RAF callback naturally starts at value=0 on the first tick since startRef is null.

### Session 7 — April 2026
**Completed:**
- `InjurySource` type moved to `@/types` — `detectInjury.ts` re-exports it; `InjuryReferralScreen` and store now import from `@/types` to avoid client importing from a `'use server'` module.
- `store/arclineStore.ts` — Safety section extended: `injuryTriggerText: string`, `injurySource: InjurySource | null`, `injuryOnResolve: (() => void) | null`. `setInjuryFlagged` signature extended to `(flagged, triggerText?, source?, onResolve?)`. Clears all injury state on `setInjuryFlagged(false)`.
- `app/_components/InjuryGuard.tsx` — new global client component. Reads `injuryFlagged` from store. When true, renders `<InjuryReferralScreen />`. `onDismiss` calls `setInjuryFlagged(false)` then `injuryOnResolve?.()`. Handles the pending-callback pattern so forms can save after referral.
- `app/layout.tsx` (root) — `<InjuryGuard />` added inside body. Screen can now fire from any page.
- `app/app/_components/InjuryHydrator.tsx` — new client component. Accepts `triggerText` + `source` as props. On mount, calls `setInjuryFlagged(true, ...)` to hydrate Zustand from server-side DB state.
- `app/app/layout.tsx` — now async server component. Fetches most recent unresolved injury_flag for the user (`referral_confirmed=false`, `resolved=false`). If found, renders `<InjuryHydrator>`. This is the Strava webhook case: plan is paused server-side, user visits app → flag detected → screen fires immediately, regardless of what page they land on.
- `app/app/log/_components/ManualLogForm.tsx` — removed local `injuryState` + `pendingData` state + inline `<InjuryReferralScreen />`. Now calls `setInjuryFlagged(true, triggerText, 'session_log', () => doSave(data))` — the global guard handles the screen and calls the callback after resolution.
- `app/app/log/_components/ScreenshotLogForm.tsx` — same treatment. Calls `setInjuryFlagged(true, triggerText, 'screenshot', () => doConfirmSave())`.
- `lib/onboarding/actions.ts`:
  - `confirmInjuryReferral()` — now also unpauses plan (`status='active'`). TODO [Session 8]: apply conservative return adaptation (−20% intensity, week 1 back) before unpausing.
  - `dismissInjuryAsFalsePositive()` — now runs flag resolution + plan unpause in parallel.

**Deferred:**
- Conservative return adaptation (−20% intensity) on confirmed referral — Session 8. Placeholder comment left in `confirmInjuryReferral`.

**Decisions not in prompt:**
- `InjurySource` had to move to `@/types` because the Zustand store (`'use client'`) cannot import from a `'use server'` module, even for type-only imports in Next.js 16.
- `app/app/layout.tsx` now makes a Supabase DB call on every `/app/*` page render to check for unresolved injury flags. This is intentional: the Strava webhook writes the flag without any user session, so the only way to detect it is to check the DB on next page load. Query is a single indexed row lookup — negligible cost.
- `InjuryHydrator` runs `setInjuryFlagged(true)` only once on mount (empty deps array). The layout server re-renders on each navigation and decides whether to render the hydrator based on fresh DB data. If the user resolves the flag and navigates to another page, the hydrator won't be rendered again.
- The `injuryOnResolve` callback stored in Zustand is captured at the time the form calls `setInjuryFlagged(true, ...)`. When `InjuryGuard.onDismiss` runs, it reads the closure value before calling `setInjuryFlagged(false)` — correct execution order guaranteed by synchronous JS event handling.

### Session 6 — April 2026
**Completed:**
- `lib/ai/triggerAdaptation.ts` — full adaptation engine replacing stub:
  - `triggerAdaptationAsync(supabase, userId, sessionId, triggerType)` — main entry point. Runs profile + active plan + recent sessions + current session + previous-7-day sessions in parallel.
  - `calculateActualLoad(sessions)` — exported. Maps RPE to intensity multiplier (≤3→1.0, ≤6→1.3, ≤8→1.6, >8→1.8), sums duration_min × multiplier.
  - `calculatePlanLoad(sessions)` — private. Uses `INTENSITY_MULTIPLIERS` against `PlanSession.intensity`.
  - `enforceLoadCeiling(weeks, baselineLoad)` — HC1 enforcement. Caps each week at 115% of previous actual load. Scales sessions proportionally (min 15 min, rounded to 5 min). Chains forward across all weeks.
  - `baselineLoad` fallback: if no sessions logged in past 7 days, uses first planned week's load. Absolute floor 120 weighted minutes. Prevents HC1 zeroing out a new plan.
  - `buildTriggerContext(type, session)` — builds human-readable trigger description per `missed | reduced | extended | added | session_performance`.
  - `callClaudeAdaptation(prompt)` — claude-sonnet-4-6, strips markdown fences, throws on parse failure.
  - `savePlanVersion(...)` — updates plan in-place (version+1, adaptation_count+1, is_fallback=false), inserts to `adaptations` table with load_before/load_after and full plan snapshot.
  - Injury detection path: `{ action: 'injury_detected', triggerText }` → writes `injury_flags`, sets plan `status='paused_injury'`, returns early.
  - Zustand store updates (`setActivePlan`, `triggerAdaptationToast`) cannot run server-side — documented in code. Plan visible on next dashboard render. Toast deferred to Session 8.

**Deferred:**
- AdaptationToast Zustand integration (setActivePlan + triggerAdaptationToast) — Session 8. Note left in triggerAdaptation.ts.

**Decisions not in prompt:**
- `triggerAdaptationAsync` receives `supabase` client rather than creating its own — callers (save.ts, webhook) already have an authenticated client.
- Baseline fallback for new users (no logged sessions): use first planned week load → prevents HC1 from zeroing all sessions.
- Adaptation prompt includes `Today:` field — AI needs to know which sessions are "upcoming" vs completed when deciding what to rewrite.
- HC2 injury detection is dual-path: `detectInjury()` (haiku, explicit check) runs in session logging actions; adaptation engine also checks via the Claude response shape (`action: 'injury_detected'`). Both write to injury_flags independently.

### Session 5 — April 2026
**Completed:**
- `lib/sessions/save.ts` — `saveSessionAndTriggerAdaptation`: atomic insert, fire-and-forget `triggerAdaptationAsync`, inserts to `adaptation_queue` on trigger failure.
- `lib/ai/triggerAdaptation.ts` — stub. TODO [Session 7]: real adaptation engine.
- `lib/sessions/actions.ts` — server actions:
  - `checkSessionInjury(text)`: detectInjury + writes injury_flags + pauses active plan if injured
  - `logManualSession(data)`: validates + `saveSessionAndTriggerAdaptation`
  - `extractScreenshot(formData)`: uploads to Supabase Storage, extracts via Claude vision (claude-sonnet-4-6), returns `ExtractedSession` with confidence level
  - `confirmSession(data)`: HC2 on notes + `saveSessionAndTriggerAdaptation`
  - `disconnectStrava()`: clears strava_token + strava_connected, redirects
- `lib/strava/client.ts` — `exchangeToken`, `getActivity`, `getAthleteActivities`, `mapStravaToSession`. `refreshIfNeeded` handles token expiry. `fetchWithRetry` implements exponential backoff on 429 (1s, 2s, 4s, 8s, max 4 retries).
- `lib/supabase/service.ts` — service role client for use in webhook (no user cookie context).
- `app/app/log/_components/ManualLogForm.tsx` — all fields. Session type changes pace label/placeholder. Power field gated to bike. HC2 triggered before save, `InjuryReferralScreen` overlay, save proceeds after dismiss.
- `app/app/log/_components/ScreenshotLogForm.tsx` — file validation (JPEG/PNG, 10MB) before upload. Two-step: upload+extract, then confirmation form. Low-confidence yellow banner. HC2 on confirmed notes.
- `app/app/log/_components/LogTabs.tsx` — Manual / Screenshot tab strip.
- `app/app/log/page.tsx` — auth guard + LogTabs.
- `app/app/settings/integrations/page.tsx` — Strava card: unconfigured / not connected / connected states. Disconnect via form action.
- `app/api/strava/auth/route.ts` — redirects to Strava OAuth. Redirect URI built from `NEXT_PUBLIC_APP_URL`.
- `app/api/strava/callback/route.ts` — code exchange, token storage, last-10 activity import with deduplication + HC2 per activity.
- `app/api/strava/webhook/route.ts` — GET verify handshake, POST new activity: lookup user by `strava_token->>athlete_id`, dedup, HC2, `saveSessionAndTriggerAdaptation`.
- `supabase/schema.sql` — `adaptation_queue` table added.
- `types/index.ts` — `SessionType` expanded with `open_water`, `race`. `NewSession` type added.

**Decisions not in prompt:**
- Webhook uses `createServiceClient()` (service role key) — Strava's POST has no user cookie, RLS would block all queries with the anon client.
- Webhook athlete_id lookup: `.filter('strava_token->>athlete_id', 'eq', String(owner_id))` — PostgREST JSONB text extraction operator.
- Screenshot extraction uses `claude-sonnet-4-6` (not `claude-sonnet-4-20250514` from master prompt — that model ID is not in the current model list).
- `disconnectStrava` returns `void` + redirects (not `{ error? }`) — required for `<form action>` compatibility.
- Strava bulk import (callback) skips adaptation trigger per activity — just saves. Ongoing webhook events use `saveSessionAndTriggerAdaptation`.
- Webhook HC2 pauses the active plan when injury detected; bulk import does not (too disruptive for historical data).

**Requires manual Supabase setup:**
- Create `session-screenshots` storage bucket. Set RLS: allow users to upload/read their own folder (`auth.uid()::text = (storage.foldername(name))[1]`).
- Run `adaptation_queue` table SQL from schema.sql in SQL editor.
- Add env vars: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN`, `NEXT_PUBLIC_APP_URL`.
- Register redirect URIs in Strava Developer Portal: `http://localhost:3000/api/strava/callback` and `[APP_URL]/api/strava/callback`.

### Session 4 — April 2026
**Completed:**
- `lib/ai/generatePlan.ts` — real AI plan generation via claude-sonnet-4-6. 2-attempt retry with JSON parse validation. Falls back to `generateFallbackPlan` on both failures. HC1 enforced after parsing: each week capped at 115% of previous week's load (duration_min × intensity_multiplier), sessions scaled proportionally if over ceiling.
- `lib/onboarding/actions.ts` updated — calls `generatePlan` (async). On success: inserts plan to DB. If `is_fallback=true`: also inserts to `plan_generation_queue` (silently ignored if table doesn't exist yet).
- `supabase/schema.sql` — `plan_generation_queue` table added. **Run separately in Supabase SQL editor** (existing schema already applied).
- `types/index.ts` — `PlanSession` extended with optional `date`, `intensity_multiplier`, `completed`. `PlanWeek` extended with optional `week_start`. Backwards-compatible (fallback generator still works).
- `components/PlanWeekView.tsx` — server component. Horizontal-scroll strip of session cards. Type badge (colour-coded per discipline), day abbreviation, formatted duration, intensity badge, 2-3 line description truncated, "Log this session" CTA linking to /app/log.
- `app/app/_components/AppNav.tsx` — client component. Sticky bottom nav. Active route highlighted in brand-teal.
- `app/app/layout.tsx` — AppNav added.
- `app/app/dashboard/page.tsx` — server component. Loads active plan, computes current week from `week_start` dates (falls back to `generated_at` + elapsed weeks). Renders `PlanWeekView` for current week. Fallback banner when `is_fallback=true`. All 5 gamification stubs imported.
- `app/app/plan/page.tsx` — server component. All weeks rendered with `PlanWeekView`. Training duration per week displayed.
- `eslint.config.mjs` — `argsIgnorePattern: "^_"` added. Pre-existing `<a>` navigation lint errors fixed (auth layout, OnboardingFlow).

**Deferred:**
- Background plan regeneration worker (plan_generation_queue is inserted to but nothing processes it yet)
- Strava integration — Session 6

**Decisions not in prompt:**
- HC1 enforcement in `generatePlan` happens after parsing, before returning — AI output is never trusted raw. `enforceHC1` uses actual load calculation (duration × multiplier per session), not the AI-reported `total_load_minutes`.
- `getWeekStart()`: if today is Monday → plan starts today. Otherwise → next Monday. Avoids starting mid-week.
- `plan_generation_queue` insert wrapped in no-error-check pattern — table may not exist until user runs the new SQL. Onboarding completion must not fail because of this.
- `PlanWeekView` is a server component (no hooks, no browser APIs). `AppNav` is client-only (needs `usePathname`).
- JSON parse strips markdown fences before parsing (`replace(/^```(?:json)?\n?/...)`) to handle models that wrap JSON despite being told not to.

**Technical debt deliberately introduced:**
- `plan_generation_queue` rows are never processed — background worker is a Session 7+ concern

### Session 3 — April 2026
**Completed:**
- `lib/ai/detectInjury.ts` — HC2 classifier using claude-haiku-4-5-20251001. Gracefully skips if API key not configured. Safe default: returns `injured: false` on classifier failure (never blocks user).
- `lib/ai/generateFallbackPlan.ts` — stub plan generator. Creates a 4-week base plan from user's weekly_hours_available + weekly_days_available. is_fallback=true. Session 4 replaces with AI generation.
- `lib/onboarding/actions.ts` — saveStep, checkInjuryText, confirmInjuryReferral, dismissInjuryAsFalsePositive, completeOnboarding server actions.
- `components/InjuryReferralScreen.tsx` — full HC2 referral screen. No X button. Two paths: confirm (professional seen) + false positive escape. External sports therapist link opens in new tab.
- 7 step components in `app/app/onboarding/_components/`: Step1–7, ProgressBar, StepNav.
- `OnboardingFlow.tsx` — client orchestrator. Framer Motion AnimatePresence for step transitions. HC2 check on Step 5. completeOnboarding + redirect on Step 7.
- `app/app/onboarding/page.tsx` — server component. Loads profile, redirects if already complete.
- Back navigation never loses data (accumulated formData state in parent).
- Partial completion resumable — profile is pre-populated from existing Supabase data on load.

**Deferred:**
- AI plan generation — fallback plan used until Session 4
- Unit conversion display is local state only (metric/imperial toggle in Step 2) — always stored in metric

**Decisions not in prompt:**
- `detectInjury` safe-defaults to `injured: false` on JSON parse failure or API error — never block the user due to classifier failure
- Step 5 HC2 during onboarding: writes to injury_flags but does NOT pause a plan (no plan exists yet). User can continue after confirmation or false-positive dismissal.
- `'use server'` not placed at file top for detectInjury.ts — it is called from server actions, not directly from client. Kept as a plain async function imported into server action files.

**Technical debt deliberately introduced:**
- `// TODO [Session 4]`: generateFallbackPlan called from completeOnboarding — replace with AI generation

### Session 2 — April 2026
**Completed:**
- `types/index.ts` — Profile, Plan, PlanWeek, PlanSession, TrainingSession, SessionType, Intensity
- `store/arclineStore.ts` — Zustand store matching exact master prompt interface
- 5 gamification stub components in `components/gamification/` (Session 8 placeholders)
- `supabase/schema.sql` — full DDL: 7 tables (profiles, plans, sessions, adaptations, injury_flags, hc2_false_positives, waitlist), RLS, handle_new_user trigger. Run in Supabase SQL editor.
- `lib/auth/actions.ts` — signUp / login / logout server actions (email + password, no magic link)
- Login routes to /app/onboarding or /app/dashboard based on profiles.onboarding_complete
- `proxy.ts` updated — /app/* routes redirect to /login if unauthenticated
- `/signup` and `/login` pages — dark UI, loading/error states via useActionState
- `/api/waitlist` — now persists to Supabase waitlist table when credentials are real (23505 unique violation treated as success)
- Shell pages: /app/onboarding, /app/dashboard, /app/log, /app/plan, /app/settings/integrations
- Removed stray parent-dir package.json/node_modules left from failed initial scaffold

**Deferred:**
- Email confirmation disabled in Supabase — must be done manually in Supabase Auth settings (Auth → Providers → Email → disable "Confirm email")
- Real Supabase credentials not yet in .env.local or Vercel — user must add them

**Decisions not in prompt:**
- `CREATE POLICY IF NOT EXISTS` requires PG17; Supabase is PG15. Used DROP IF EXISTS + CREATE for idempotency in schema.sql.
- `TrainingSession` named to avoid collision with Supabase's auth `Session` type
- Parent-directory stray files (package.json, node_modules) from failed scaffold deleted — were untracked
- Waitlist table added to schema (not in master prompt schema — needed for /api/waitlist)

**Technical debt deliberately introduced:**
- None new this session.

### Session 1 — April 2026
**Completed:**
- Next.js 16.2.4 scaffolded (create-next-app) with TypeScript strict, Tailwind v4, App Router
- All v1 dependencies installed: @supabase/ssr, framer-motion, zustand, ai, @anthropic-ai/sdk, stripe
- Supabase browser + server + middleware utility clients in `lib/supabase/`
- `proxy.ts` (Next.js 16 convention) for Supabase session refresh
- Landing page at `/`: dark bg, headline "Built for your goal. Rebuilt for your week.", feature strip, email capture
- `/api/waitlist` POST handler
- Arcline brand tokens in globals.css via Tailwind v4 `@theme inline`
- Production build verified clean
- Fix: proxy guarded against missing Supabase env vars (prevented 500 on Vercel before Session 2)

**Deferred:**
- Email waitlist storage (no Supabase yet)
- Auth, schema, store — all Session 2

**Decisions not in original prompt:**
- Created `arcline/` as subdirectory (parent dir name had spaces/caps, incompatible with npm package naming)
- `proxy.ts` not `middleware.ts` — Next.js 16 convention change discovered at build time
- Proxy guard added after first Vercel deployment returned 500 on all routes
