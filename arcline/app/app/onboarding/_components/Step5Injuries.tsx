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

export function Step5Injuries({ data, onChange, onNext, onBack, isLoading, error }: Props) {
  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-foreground">
        Any injuries or conditions we should know about?
      </h2>
      <p className="mb-8 text-foreground-muted">
        Optional. This stays private. We use it to protect you — not restrict you.
      </p>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground-muted">
          Injuries or conditions <span className="text-xs">(optional)</span>
        </label>
        <textarea
          rows={4}
          value={data.injuries_conditions}
          onChange={e => onChange({ injuries_conditions: e.target.value })}
          placeholder="e.g. Left knee — had surgery in 2023, fully recovered. Mild lower back stiffness after long runs."
          className="resize-none rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40"
        />
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      <StepNav onBack={onBack} onNext={onNext} isLoading={isLoading} />
    </div>
  )
}
