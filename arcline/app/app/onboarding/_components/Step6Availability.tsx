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

export function Step6Availability({ data, onChange, onNext, onBack, isLoading, error }: Props) {
  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-foreground">How much time do you have?</h2>
      <p className="mb-8 text-foreground-muted">
        Be realistic. We&apos;ll build a plan that fits your actual week, not your ideal one.
      </p>

      <div className="flex flex-col gap-8">
        {/* Hours slider */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-medium text-foreground-muted">
              Hours per week
            </label>
            <span className="text-lg font-bold text-foreground">
              {data.weekly_hours_available}
              <span className="ml-1 text-sm font-normal text-foreground-muted">hrs</span>
            </span>
          </div>
          <input
            type="range"
            min={2}
            max={20}
            value={data.weekly_hours_available}
            onChange={e => onChange({ weekly_hours_available: Number(e.target.value) })}
            className="w-full accent-brand-teal cursor-pointer"
          />
          <div className="flex justify-between text-xs text-foreground-muted">
            <span>2 hrs</span>
            <span>20 hrs</span>
          </div>
        </div>

        {/* Days per week — button grid */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-foreground-muted">Days per week</label>
          <div className="grid grid-cols-7 gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => onChange({ weekly_days_available: d })}
                className={`rounded-xl py-3 text-sm font-bold transition cursor-pointer ${
                  data.weekly_days_available === d
                    ? 'bg-brand-teal text-background'
                    : 'border border-white/10 text-foreground-muted hover:border-white/20 hover:text-foreground'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      <StepNav onBack={onBack} onNext={onNext} isLoading={isLoading} />
    </div>
  )
}
