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

export function Step3RestingHR({ data, onChange, onNext, onBack, isLoading, error }: Props) {
  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-foreground">Resting heart rate.</h2>
      <p className="mb-8 text-foreground-muted">
        Optional — skip if you don&apos;t know it. We&apos;ll refine this from your session data.
      </p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground-muted">Resting HR (bpm)</label>
          <span
            title="Best measured first thing in the morning before you get up."
            className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-white/20 text-xs text-foreground-muted"
          >
            ?
          </span>
        </div>
        <input
          type="number"
          inputMode="numeric"
          min={30}
          max={120}
          value={data.resting_hr}
          onChange={e => onChange({ resting_hr: e.target.value })}
          placeholder="e.g. 52"
          className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40"
        />
        <p className="text-xs text-foreground-muted">
          Best measured first thing in the morning, before getting up.
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      <StepNav onBack={onBack} onNext={onNext} isLoading={isLoading} />
    </div>
  )
}
