'use client'

import { create } from 'zustand'
import type { User, Profile, Plan, TrainingSession, InjurySource } from '@/types'

interface ArclineStore {
  // Auth
  user: User | null
  setUser: (user: User | null) => void

  // Profile
  profile: Profile | null
  setProfile: (profile: Profile | null) => void

  // Plan
  activePlan: Plan | null
  setActivePlan: (plan: Plan | null) => void
  adaptationPending: boolean
  adaptationPendingSince: number | null
  setAdaptationPending: (pending: boolean) => void

  // Sessions
  currentWeekSessions: TrainingSession[]
  setCurrentWeekSessions: (sessions: TrainingSession[]) => void

  // Gamification
  streak: number
  setStreak: (streak: number) => void
  weeklyCompletionPercent: number
  setWeeklyCompletionPercent: (pct: number) => void

  // Session complete animation
  showSessionComplete: boolean
  sessionCompleteData: { duration_min: number; distance_km: number | null; rpe: number | null } | null
  triggerSessionComplete: (data: { duration_min: number; distance_km: number | null; rpe: number | null }) => void
  dismissSessionComplete: () => void

  // Safety
  injuryFlagged: boolean
  injuryTriggerText: string
  injurySource: InjurySource | null
  injuryOnResolve: (() => void) | null
  setInjuryFlagged: (
    flagged: boolean,
    triggerText?: string,
    source?: InjurySource,
    onResolve?: (() => void) | null,
  ) => void

  // UI
  showAdaptationToast: boolean
  adaptationReasoning: string
  triggerAdaptationToast: (reasoning: string) => void
  dismissAdaptationToast: () => void
}

export const useArclineStore = create<ArclineStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  profile: null,
  setProfile: (profile) => set({ profile }),

  activePlan: null,
  setActivePlan: (activePlan) => set({ activePlan }),
  adaptationPending: false,
  adaptationPendingSince: null,
  setAdaptationPending: (pending) =>
    pending
      ? set({ adaptationPending: true, adaptationPendingSince: Date.now() })
      : set({ adaptationPending: false, adaptationPendingSince: null }),

  currentWeekSessions: [],
  setCurrentWeekSessions: (currentWeekSessions) => set({ currentWeekSessions }),

  streak: 0,
  setStreak: (streak) => set({ streak }),
  weeklyCompletionPercent: 0,
  setWeeklyCompletionPercent: (weeklyCompletionPercent) => set({ weeklyCompletionPercent }),

  showSessionComplete: false,
  sessionCompleteData: null,
  triggerSessionComplete: (data) => set({ showSessionComplete: true, sessionCompleteData: data }),
  dismissSessionComplete: () => set({ showSessionComplete: false, sessionCompleteData: null }),

  injuryFlagged: false,
  injuryTriggerText: '',
  injurySource: null,
  injuryOnResolve: null,
  setInjuryFlagged: (flagged, triggerText, source, onResolve) =>
    flagged
      ? set({ injuryFlagged: true, injuryTriggerText: triggerText ?? '', injurySource: source ?? null, injuryOnResolve: onResolve ?? null })
      : set({ injuryFlagged: false, injuryTriggerText: '', injurySource: null, injuryOnResolve: null }),

  showAdaptationToast: false,
  adaptationReasoning: '',
  triggerAdaptationToast: (reasoning) =>
    set({ showAdaptationToast: true, adaptationReasoning: reasoning }),
  dismissAdaptationToast: () =>
    set({ showAdaptationToast: false, adaptationReasoning: '' }),
}))
