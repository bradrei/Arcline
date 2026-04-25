'use client'

import { create } from 'zustand'
import type { User, Profile, Plan, TrainingSession } from '@/types'

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
  setAdaptationPending: (pending: boolean) => void

  // Sessions
  currentWeekSessions: TrainingSession[]
  setCurrentWeekSessions: (sessions: TrainingSession[]) => void

  // Gamification
  streak: number
  setStreak: (streak: number) => void
  weeklyCompletionPercent: number
  setWeeklyCompletionPercent: (pct: number) => void

  // Safety
  injuryFlagged: boolean
  setInjuryFlagged: (flagged: boolean) => void

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
  setAdaptationPending: (adaptationPending) => set({ adaptationPending }),

  currentWeekSessions: [],
  setCurrentWeekSessions: (currentWeekSessions) => set({ currentWeekSessions }),

  streak: 0,
  setStreak: (streak) => set({ streak }),
  weeklyCompletionPercent: 0,
  setWeeklyCompletionPercent: (weeklyCompletionPercent) => set({ weeklyCompletionPercent }),

  injuryFlagged: false,
  setInjuryFlagged: (injuryFlagged) => set({ injuryFlagged }),

  showAdaptationToast: false,
  adaptationReasoning: '',
  triggerAdaptationToast: (reasoning) =>
    set({ showAdaptationToast: true, adaptationReasoning: reasoning }),
  dismissAdaptationToast: () =>
    set({ showAdaptationToast: false, adaptationReasoning: '' }),
}))
