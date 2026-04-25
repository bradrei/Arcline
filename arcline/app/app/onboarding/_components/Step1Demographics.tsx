import type { OnboardingFormData } from './OnboardingFlow'
import { StepNav } from './StepNav'

interface Props {
  data: OnboardingFormData
  onChange: (u: Partial<OnboardingFormData>) => void
  onNext: () => void
  isLoading: boolean
  error: string | null
}

export function Step1Demographics({ data, onChange, onNext, isLoading, error }: Props) {
  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-foreground">Let&apos;s start with the basics.</h2>
      <p className="mb-8 text-foreground-muted">
        This helps us calibrate your training zones and recovery from day one.
      </p>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground-muted">Age</label>
          <input
            type="number"
            inputMode="numeric"
            min={10}
            max={99}
            value={data.age}
            onChange={e => onChange({ age: e.target.value })}
            placeholder="e.g. 32"
            className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground-muted">Sex</label>
          <select
            value={data.sex}
            onChange={e => onChange({ sex: e.target.value })}
            className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40 appearance-none cursor-pointer"
          >
            <option value="" disabled>Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <StepNav onNext={onNext} isLoading={isLoading} isFirst />
    </div>
  )
}
