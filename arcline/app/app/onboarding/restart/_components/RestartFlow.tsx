'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import type { Profile } from '@/types'
import { ProgressBar } from '../../_components/ProgressBar'
import { Step7Goal } from '../../_components/Step7Goal'
import { Step8Calibration } from '../../_components/Step8Calibration'
import type { OnboardingFormData } from '../../_components/OnboardingFlow'
import { completeRestart } from '@/lib/onboarding/actions'

interface Props {
  profile: Profile
}

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
    goal_type: (p.goal_type as OnboardingFormData['goal_type']) ?? 'event_date',
    goal_date: p.goal_date ?? '',
    goal_description: p.goal_description ?? '',
    calibration_choice: '',
  }
}

export function RestartFlow({ profile }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [direction, setDirection] = useState(1)
  const [data, setData] = useState<OnboardingFormData>(profileToData(profile))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(u: Partial<OnboardingFormData>) {
    setData(prev => ({ ...prev, ...u }))
    setError(null)
  }

  function validateGoal(): string | null {
    if (!data.goal_type) return 'Pick a goal type.'
    if (data.goal_type === 'event_date' && !data.goal_date) return 'Enter your race date.'
    if (!data.goal_description.trim()) return 'Describe your goal or event.'
    return null
  }

  async function handleNext() {
    setError(null)
    if (step === 1) {
      const err = validateGoal()
      if (err) {
        setError(err)
        return
      }
      setDirection(1)
      setStep(2)
      return
    }
    if (!data.calibration_choice) {
      setError('Pick a calibration option.')
      return
    }
    setIsLoading(true)
    const result = await completeRestart({
      goal_type: data.goal_type,
      goal_date: data.goal_date || null,
      goal_description: data.goal_description,
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
    setStep(1)
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
        Confirm your goal and pick how to calibrate. Your old plan archives automatically — session
        history stays.
      </p>

      <ProgressBar current={step} total={2} />

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
          {step === 1 ? (
            <Step7Goal {...stepProps} />
          ) : (
            <Step8Calibration {...stepProps} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
