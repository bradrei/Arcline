'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import type { Profile } from '@/types'
import { ProgressBar } from './ProgressBar'
import { Step1Demographics } from './Step1Demographics'
import { Step2Measurements } from './Step2Measurements'
import { Step3RestingHR } from './Step3RestingHR'
import { Step4TrainingHistory } from './Step4TrainingHistory'
import { Step5Injuries } from './Step5Injuries'
import { Step6Availability } from './Step6Availability'
import { Step7Goal } from './Step7Goal'
import { InjuryReferralScreen } from '@/components/InjuryReferralScreen'
import {
  saveStep,
  checkInjuryText,
  completeOnboarding,
} from '@/lib/onboarding/actions'

export interface OnboardingFormData {
  // Step 1
  age: string
  sex: string
  // Step 2
  height_cm: number
  weight_kg: number
  // Step 3
  resting_hr: string
  // Step 4
  training_years: number
  disciplines: string[]
  // Step 5
  injuries_conditions: string
  // Step 6
  weekly_hours_available: number
  weekly_days_available: number
  // Step 7
  goal_type: 'event_date' | 'pace_ability'
  goal_date: string
  goal_description: string
}

function profileToFormData(profile: Profile | null): OnboardingFormData {
  return {
    age: profile?.age?.toString() ?? '',
    sex: profile?.sex ?? '',
    height_cm: profile?.height_cm ?? 0,
    weight_kg: profile?.weight_kg ?? 0,
    resting_hr: profile?.resting_hr?.toString() ?? '',
    training_years: profile?.training_years ?? 2,
    disciplines: profile?.disciplines ?? [],
    injuries_conditions: profile?.injuries_conditions ?? '',
    weekly_hours_available: profile?.weekly_hours_available ?? 6,
    weekly_days_available: profile?.weekly_days_available ?? 4,
    goal_type: (profile?.goal_type as OnboardingFormData['goal_type']) ?? 'event_date',
    goal_date: profile?.goal_date ?? '',
    goal_description: profile?.goal_description ?? '',
  }
}

const TOTAL_STEPS = 7

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? 48 : -48, opacity: 0 }),
}

interface Props {
  initialProfile: Profile | null
}

export function OnboardingFlow({ initialProfile }: Props) {
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [formData, setFormData] = useState<OnboardingFormData>(
    profileToFormData(initialProfile)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [injuryState, setInjuryState] = useState<{
    show: boolean
    triggerText: string
  }>({ show: false, triggerText: '' })

  function update(updates: Partial<OnboardingFormData>) {
    setFormData(prev => ({ ...prev, ...updates }))
    setError(null)
  }

  function goBack() {
    setDirection(-1)
    setStep(prev => prev - 1)
    setError(null)
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validateStep(s: number): string | null {
    switch (s) {
      case 1:
        if (!formData.age || Number(formData.age) < 10) return 'Please enter a valid age.'
        if (!formData.sex) return 'Please select a sex.'
        return null
      case 2:
        if (!formData.height_cm || formData.height_cm < 100) return 'Please enter a valid height.'
        if (!formData.weight_kg || formData.weight_kg < 30) return 'Please enter a valid weight.'
        return null
      case 3:
        return null // optional
      case 4:
        if (formData.disciplines.length === 0) return 'Select at least one discipline.'
        return null
      case 5:
        return null // optional
      case 6:
        return null
      case 7:
        if (!formData.goal_type) return 'Please select a goal type.'
        if (formData.goal_type === 'event_date' && !formData.goal_date)
          return 'Please enter your event date.'
        if (!formData.goal_description.trim()) return 'Please describe your goal or event.'
        return null
      default:
        return null
    }
  }

  // ── Step save helpers ─────────────────────────────────────────────────────

  async function saveCurrentStep(): Promise<boolean> {
    const validationError = validateStep(step)
    if (validationError) {
      setError(validationError)
      return false
    }

    const stepPayloads: Record<number, Parameters<typeof saveStep>[0]> = {
      1: { age: Number(formData.age), sex: formData.sex },
      2: { height_cm: formData.height_cm, weight_kg: formData.weight_kg },
      3: { resting_hr: formData.resting_hr ? Number(formData.resting_hr) : null },
      4: {
        training_years: formData.training_years,
        disciplines: formData.disciplines,
      },
      5: { injuries_conditions: formData.injuries_conditions },
      6: {
        weekly_hours_available: formData.weekly_hours_available,
        weekly_days_available: formData.weekly_days_available,
      },
    }

    const payload = stepPayloads[step]
    if (payload) {
      const result = await saveStep(payload)
      if (result.error) {
        setError(result.error)
        return false
      }
    }

    return true
  }

  // ── Next handler ──────────────────────────────────────────────────────────

  async function handleNext() {
    setIsLoading(true)
    setError(null)

    // Step 5: run HC2 check before advancing
    if (step === 5 && formData.injuries_conditions.trim()) {
      const { injured, triggerText } = await checkInjuryText(
        formData.injuries_conditions,
        'onboarding'
      )
      if (injured) {
        setInjuryState({ show: true, triggerText })
        setIsLoading(false)
        return
      }
    }

    const saved = await saveCurrentStep()
    if (!saved) {
      setIsLoading(false)
      return
    }

    // Step 7: complete onboarding + generate plan
    if (step === TOTAL_STEPS) {
      const result = await completeOnboarding({
        goal_type: formData.goal_type,
        goal_date: formData.goal_date || null,
        goal_description: formData.goal_description,
      })
      // completeOnboarding redirects on success; only reaches here on error
      if (result?.error) setError(result.error)
      setIsLoading(false)
      return
    }

    setDirection(1)
    setStep(prev => prev + 1)
    setIsLoading(false)
  }

  // ── Injury screen dismissed ───────────────────────────────────────────────

  async function handleInjuryDismiss() {
    setInjuryState({ show: false, triggerText: '' })
    // Save the step data (without re-running the HC2 check) and advance
    setIsLoading(true)
    const saved = await saveCurrentStep()
    if (saved) {
      setDirection(1)
      setStep(prev => prev + 1)
    }
    setIsLoading(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const stepProps = { data: formData, onChange: update, onNext: handleNext, isLoading, error }

  const steps: Record<number, React.ReactNode> = {
    1: <Step1Demographics {...stepProps} />,
    2: <Step2Measurements {...stepProps} onBack={goBack} />,
    3: <Step3RestingHR {...stepProps} onBack={goBack} />,
    4: <Step4TrainingHistory {...stepProps} onBack={goBack} />,
    5: <Step5Injuries {...stepProps} onBack={goBack} />,
    6: <Step6Availability {...stepProps} onBack={goBack} />,
    7: <Step7Goal {...stepProps} onBack={goBack} />,
  }

  return (
    <>
      {/* HC2 overlay — full screen, no dismiss */}
      {injuryState.show && (
        <InjuryReferralScreen
          triggerText={injuryState.triggerText}
          source="onboarding"
          onDismiss={handleInjuryDismiss}
        />
      )}

      <div className="mx-auto w-full max-w-lg px-6 py-12">
        <Link href="/" className="mb-12 block text-lg font-bold tracking-tight">
          arc<span className="text-brand-teal">line</span>
        </Link>

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
            {steps[step]}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}
