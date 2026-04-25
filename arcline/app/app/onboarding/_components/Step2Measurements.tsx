'use client'

import { useState } from 'react'
import type { OnboardingFormData } from './OnboardingFlow'
import { StepNav } from './StepNav'

interface Props {
  data: OnboardingFormData
  onChange: (u: Partial<OnboardingFormData>) => void
  onNext: () => void
  onBack: () => void
  isLoading: boolean
  error: string | null
}

export function Step2Measurements({ data, onChange, onNext, onBack, isLoading, error }: Props) {
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric')

  // Imperial display state
  const [feet, setFeet] = useState(() => {
    if (!data.height_cm) return ''
    return String(Math.floor(data.height_cm / 30.48))
  })
  const [inches, setInches] = useState(() => {
    if (!data.height_cm) return ''
    return String(Math.round((data.height_cm / 2.54) % 12))
  })
  const [lbs, setLbs] = useState(() => {
    if (!data.weight_kg) return ''
    return String(Math.round(data.weight_kg / 0.453592))
  })

  function handleImperialHeight(f: string, i: string) {
    setFeet(f)
    setInches(i)
    const totalInches = (Number(f) || 0) * 12 + (Number(i) || 0)
    if (totalInches > 0) onChange({ height_cm: Math.round(totalInches * 2.54) })
  }

  function handleImperialWeight(val: string) {
    setLbs(val)
    if (val) onChange({ weight_kg: Math.round(Number(val) * 0.453592 * 10) / 10 })
  }

  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-foreground">Height and weight.</h2>
      <p className="mb-8 text-foreground-muted">
        Used to estimate your training load and power-to-weight ratios.
      </p>

      {/* Unit toggle */}
      <div className="mb-6 inline-flex rounded-xl border border-white/10 p-1">
        {(['metric', 'imperial'] as const).map(u => (
          <button
            key={u}
            type="button"
            onClick={() => setUnit(u)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition cursor-pointer ${
              unit === u
                ? 'bg-brand-teal text-background'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            {u === 'metric' ? 'cm / kg' : 'ft+in / lbs'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {unit === 'metric' ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground-muted">Height (cm)</label>
              <input
                type="number"
                inputMode="numeric"
                min={100}
                max={250}
                value={data.height_cm || ''}
                onChange={e => onChange({ height_cm: Number(e.target.value) })}
                placeholder="e.g. 178"
                className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground-muted">Weight (kg)</label>
              <input
                type="number"
                inputMode="decimal"
                min={30}
                max={250}
                value={data.weight_kg || ''}
                onChange={e => onChange({ weight_kg: Number(e.target.value) })}
                placeholder="e.g. 74"
                className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40"
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground-muted">Height</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  inputMode="numeric"
                  min={3}
                  max={8}
                  value={feet}
                  onChange={e => handleImperialHeight(e.target.value, inches)}
                  placeholder="ft"
                  className="w-1/2 rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={11}
                  value={inches}
                  onChange={e => handleImperialHeight(feet, e.target.value)}
                  placeholder="in"
                  className="w-1/2 rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground-muted">Weight (lbs)</label>
              <input
                type="number"
                inputMode="decimal"
                value={lbs}
                onChange={e => handleImperialWeight(e.target.value)}
                placeholder="e.g. 165"
                className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40"
              />
            </div>
          </>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      <StepNav onBack={onBack} onNext={onNext} isLoading={isLoading} />
    </div>
  )
}
