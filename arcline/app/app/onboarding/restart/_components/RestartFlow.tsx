'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import type { Profile } from '@/types'
import { ProgressBar } from '../../_components/ProgressBar'
import { Step7Goal } from '../../_components/Step7Goal'
import { Step8Calibration } from '../../_components/Step8Calibration'
import { StepStrength } from '../../_components/StepStrength'
import { StepSchedule } from '../../_components/StepSchedule'
import {
  DEFAULT_DISCIPLINE_FREQUENCY,
  DEFAULT_WEEKDAY_AVAILABILITY,
  type OnboardingFormData,
} from '../../_components/OnboardingFlow'
import { completeRestart } from '@/lib/onboarding/actions'

interface Props {
  profile: Profile
}

const TOTAL_STEPS = 4

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? 48 : -48, opacity: 0 }),
}

function profileToData(p: Profile): OnboardingFormData {
  return {
    age: p.age?.toString() ?? '',
    sex: p.sex ?? '',
    height_cm: p.height_cm ?? 0,
    weight_kg: p.weight_kg ?? 0,
    resting_hr: p.resting_hr?.toString() ?? '',
    training_years: p.training_years ?? 2,
    disciplines: p.disciplines ?? [],
    injuries_conditions: p.injuries_conditions ?? '',
    weekly_hours_available: p.weekly_hours_available ?? 6,
    weekly_days_available: p.weekly_days_available ?? 4,
    weekday_availability: p.weekday_availability ?? DEFAULT_WEEKDAY_AVAILABILITY,
    discipline_frequency: p.discipline_frequency ?? DEFAULT_DISCIPLINE_FREQUENCY,
    strength_preference:
      (p.strength_preference as OnboardingFormData['strength_preference']) ?? 'none',
    goal_type: (p.goal_type as OnboardingFormData['goal_type']) ?? 'event_date',
    goal_date: p.goal_date ?? '',
    goal_description: p.goal_description ?? '',
    race_distance: (p.race_distance as OnboardingFormData['race_distance']) ?? '',
    goal_mode: p.goal_time_seconds ? 'time' : 'finish',
    goal_time_hh: p.goal_time_seconds
      ? String(Math.floor(p.goal_time_seconds / 3600))
      : '',
    goal_time_mm: p.goal_time_seconds
      ? String(Math.floor((p.goal_time_seconds % 3600) / 60)).padStart(2, '0')
      : '',
    goal_time_ss: p.goal_time_seconds
      ? String(p.goal_time_seconds % 60).padStart(2, '0')
      : '',
    swim_pace_per_100m: p.goal_paces?.swim_per_100m ?? '',
    bike_kmh: p.goal_paces?.bike_kmh != null ? String(p.goal_paces.bike_kmh) : '',
    run_pace_per_km: p.goal_paces?.run_per_km ?? '',
    calibration_choice: '',
  }
}

export function RestartFlow({ profile }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [direction, setDirection] = useState(1)
  const [data, setData] = useState<OnboardingFormData>(profileToData(profile))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(u: Partial<OnboardingFormData>) {
    setData(prev => ({ ...prev, ...u }))
    setError(null)
  }

  function validate(s: number): string | null {
    switch (s) {
      case 1:
        if (!data.goal_type) return 'Pick a goal type.'
        if (data.goal_type === 'event_date' && !data.goal_date) return 'Enter your race date.'
        if (!data.goal_description.trim()) return 'Describe your goal or event.'
        return null
      case 2:
        if (!data.strength_preference) return 'Pick a strength preference.'
        return null
      case 3: {
        const total =
          data.discipline_frequency.swim +
          data.discipline_frequency.bike +
          data.discipline_frequency.run +
          data.discipline_frequency.strength
        if (total === 0) return 'Pick at least one session in any discipline.'
        return null
      }
      case 4:
        if (!data.calibration_choice) return 'Pick a calibration option.'
        return null
      default:
        return null
    }
  }

  async function handleNext() {
    const err = validate(step)
    if (err) {
      setError(err)
      return
    }
    if (step < TOTAL_STEPS) {
      setDirection(1)
      setStep((step + 1) as 1 | 2 | 3 | 4)
      return
    }

    setIsLoading(true)
    const isEvent = data.goal_type === 'event_date'
    const useTime = isEvent && data.goal_mode === 'time'
    const goalSeconds = useTime
      ? (Number(data.goal_time_hh || 0) * 3600 +
          Number(data.goal_time_mm || 0) * 60 +
          Number(data.goal_time_ss || 0)) || null
      : null
    const paces = useTime
      ? {
          swim_per_100m: data.swim_pace_per_100m || undefined,
          bike_kmh: data.bike_kmh ? Number(data.bike_kmh) : undefined,
          run_per_km: data.run_pace_per_km || undefined,
        }
      : null
    if (!data.calibration_choice) {
      setError('Pick a calibration option.')
      setIsLoading(false)
      return
    }
    const result = await completeRestart({
      goal_type: data.goal_type,
      goal_date: data.goal_date || null,
      goal_description: data.goal_description,
      race_distance: isEvent && data.race_distance ? data.race_distance : null,
      goal_time_seconds: goalSeconds,
      goal_paces: paces,
      strength_preference: data.strength_preference,
      weekday_availability: data.weekday_availability,
      discipline_frequency: data.discipline_frequency,
      calibration_choice: data.calibration_choice,
    })
    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  function goBack() {
    if (step === 1) return
    setDirection(-1)
    setStep((step - 1) as 1 | 2 | 3 | 4)
  }

  const stepProps = {
    data,
    onChange: update,
    onNext: handleNext,
    onBack: goBack,
    isLoading,
    error,
  }

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-12">
      <Link href="/app/settings" className="mb-8 block text-sm text-foreground-muted hover:text-foreground">
        ← Back to settings
      </Link>
      <h1 className="mb-1 text-xl font-bold text-foreground">Start a new plan</h1>
      <p className="mb-8 text-sm text-foreground-muted">
        Goal → Strength → Schedule → Calibration. Your old plan archives automatically — session
        history stays.
      </p>

      <ProgressBar current={step} total={TOTAL_STEPS} />

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: [0.32, 0, 0.67, 0] }}
        >
          {step === 1 && <Step7Goal {...stepProps} />}
          {step === 2 && <StepStrength {...stepProps} />}
          {step === 3 && <StepSchedule {...stepProps} />}
          {step === 4 && <Step8Calibration {...stepProps} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
