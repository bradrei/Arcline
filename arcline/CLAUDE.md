# Arcline — CLAUDE.md
**Source of truth between build sessions. Update at the end of every session.**

---

## Current state

**Last completed session:** Session 3 — April 2026  
**Next session:** Session 4 — Plan generation + dashboard

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
    app/
      layout.tsx                  ← /app/* shell layout
      onboarding/page.tsx         ← /app/onboarding (shell — Session 3)
      dashboard/page.tsx          ← /app/dashboard (shell — Session 4)
      log/page.tsx                ← /app/log (shell — Session 5)
      plan/page.tsx               ← /app/plan (shell — Session 4)
      settings/integrations/page.tsx ← /app/settings/integrations (shell — Session 6)
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
    supabase/
      client.ts                   ← createBrowserClient wrapper
      middleware.ts               ← updateSession utility (used by proxy.ts)
      server.ts                   ← createServerClient wrapper (async, awaits cookies())
  store/arclineStore.ts           ← Zustand store (exact master prompt interface)
  supabase/schema.sql             ← full DDL — run once in Supabase SQL editor
  types/index.ts                  ← Profile, Plan, PlanWeek, PlanSession, TrainingSession
  proxy.ts                        ← session refresh + /app/* auth protection
  .env.local                      ← real keys needed (gitignored)
```

### What is NOT built yet
- Plan generation + dashboard — Session 4
- Session logging (manual + screenshot) — Session 5
- Strava integration — Session 6
- Adaptation engine + HC1 — Session 7
- Schedule-change adaptation — Session 7/8
- HC2 injury detection + referral screen — Session 9
- Gamification UX (replaces stubs) — Session 8
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
