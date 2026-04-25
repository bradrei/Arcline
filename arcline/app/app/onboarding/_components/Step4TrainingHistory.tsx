import type { OnboardingFormData } from './OnboardingFlow'
import { StepNav } from './StepNav'

const DISCIPLINES = [
  'Swim', 'Bike', 'Run', 'Triathlon', 'Open Water', 'Duathlon', 'Strength', 'Other',
]

interface Props {
  data: OnboardingFormData
  onChange: (u: Partial<OnboardingFormData>) => void
  onNext: () => void
  onBack: () => void
  isLoading: boolean
  error: string | null
}

export function Step4TrainingHistory({ data, onChange, onNext, onBack, isLoading, error }: Props) {
  function toggleDiscipline(d: string) {
    const next = data.disciplines.includes(d)
      ? data.disciplines.filter(x => x !== d)
      : [...data.disciplines, d]
    onChange({ disciplines: next })
  }

  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-foreground">Your training background.</h2>
      <p className="mb-8 text-foreground-muted">
        Helps us set the right starting point — not too easy, not too much too soon.
      </p>

      <div className="flex flex-col gap-8">
        {/* Years slider */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-medium text-foreground-muted">Years training</label>
            <span className="text-lg font-bold text-foreground">
              {data.training_years === 20 ? '20+' : data.training_years}
              <span className="ml-1 text-sm font-normal text-foreground-muted">
                {data.training_years === 1 ? 'year' : 'years'}
              </span>
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            value={data.training_years}
            onChange={e => onChange({ training_years: Number(e.target.value) })}
            className="w-full accent-brand-teal cursor-pointer"
          />
          <div className="flex justify-between text-xs text-foreground-muted">
            <span>Just starting</span>
            <span>20+ years</span>
          </div>
        </div>

        {/* Disciplines */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-foreground-muted">
            Disciplines <span className="text-xs">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {DISCIPLINES.map(d => {
              const active = data.disciplines.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDiscipline(d)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition cursor-pointer ${
                    active
                      ? 'bg-brand-teal text-background'
                      : 'border border-white/10 text-foreground-muted hover:border-white/20 hover:text-foreground'
                  }`}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      <StepNav onBack={onBack} onNext={onNext} isLoading={isLoading} />
    </div>
  )
}
