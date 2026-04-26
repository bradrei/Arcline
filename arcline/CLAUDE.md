# Arcline — CLAUDE.md
**Source of truth between build sessions. Update at the end of every session.**

---

## Current state

**Last completed session:** Session 7 — April 2026  
**Next session:** Session 8 — Gamification UX (AdaptationToast, WeeklyRing, StreakCounter, LoadTrendGraph, SessionCompleteAnimation) + conservative return adaptation after confirmed injury referral

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
        AppNav.tsx                ← sticky bottom nav (Dashboard / Plan / Log)
        InjuryHydrator.tsx        ← client component, hydrates Zustand from server-detected injury flags
      layout.tsx                  ← /app/* shell layout + AppNav
      onboarding/page.tsx         ← /app/onboarding
      dashboard/page.tsx          ← /app/dashboard (current week PlanWeekView)
      log/
        page.tsx                  ← /app/log (real — Session 5)
        _components/
          LogTabs.tsx             ← Manual / Screenshot tab switcher
          ManualLogForm.tsx       ← method 1: form with HC2 + save
          ScreenshotLogForm.tsx   ← method 2: upload → extract → confirm
      plan/page.tsx               ← /app/plan (all-weeks PlanWeekView)
      settings/integrations/page.tsx ← Strava connect/disconnect UI
    favicon.ico
    globals.css                   ← Tailwind v4 + Arcline brand tokens
    layout.tsx                    ← root layout (Geist font, metadata)
    page.tsx                      ← / landing page
  components/gamification/
    AdaptationToast.tsx           ← STUB (Session 8)
    LoadTrendGraph.tsx            ← STUB (Session 8)
    SessionCompleteAnimation.tsx  ← STUB (Session 8)
    StreakCounter.tsx              ← STUB (Session 8)
    WeeklyRing.tsx                ← STUB (Session 8)
  lib/
    auth/actions.ts               ← signUp / login / logout server actions
    ai/
      detectInjury.ts             ← HC2 classifier (haiku)
      generatePlan.ts             ← AI plan generation (sonnet) + HC1 enforcement
      generateFallbackPlan.ts     ← stub plan generator (is_fallback=true)
      triggerAdaptation.ts        ← real adaptation engine (Session 6)
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
  store/arclineStore.ts           ← Zustand store (exact master prompt interface)
  supabase/schema.sql             ← full DDL — run once in Supabase SQL editor
  types/index.ts                  ← Profile, Plan, PlanWeek, PlanSession, TrainingSession
  proxy.ts                        ← session refresh + /app/* auth protection
  .env.local                      ← real keys needed (gitignored)
components/
  PlanWeekView.tsx                ← horizontal-scroll session card strip
  InjuryReferralScreen.tsx        ← HC2 referral overlay (Session 3)
```

### What is NOT built yet
- Adaptation queue processor (adaptation_queue rows written, never consumed) — future session
- Schedule-change trigger exposure (missed/reduced/extended/added) — future session
- Conservative return adaptation after confirmed injury referral (−20% intensity, week 1 back) — Session 8 TODO
- Gamification UX (replaces stubs) — Session 8
- AdaptationToast (wired to Zustand — deferred, see note in triggerAdaptation.ts) — Session 8
- Dogfood cycle — Session 10

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
