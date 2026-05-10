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

const OPTIONS: {
  value: 'import' | 'benchmark' | 'fresh'
  title: string
  body: string
  icon: string
}[] = [
  {
    value: 'import',
    title: 'Import from Strava',
    body: 'Pulls your last 90 days. Best if you have a recent training history.',
    icon: '↻',
  },
  {
    value: 'benchmark',
    title: 'Run a 5-day benchmark',
    body: '20-min run TT, 20-min bike TT, 400m swim TT. Calibrates your zones from the data you produce.',
    icon: '⚡',
  },
  {
    value: 'fresh',
    title: 'Start fresh',
    body: 'No data, conservative defaults. You can switch later from settings.',
    icon: '○',
  },
]

export function Step8Calibration({ data, onChange, onNext, onBack, isLoading, error }: Props) {
  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-foreground">How should we calibrate your starting fitness?</h2>
      <p className="mb-8 text-foreground-muted">
        Pick whichever fits where you are right now. The plan adapts to whatever you bring.
      </p>

      <div className="flex flex-col gap-3">
        {OPTIONS.map(opt => {
          const selected = data.calibration_choice === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ calibration_choice: opt.value })}
              className={`flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition cursor-pointer ${
                selected
                  ? 'border-brand-teal bg-brand-teal/5'
                  : 'border-white/10 bg-surface hover:border-white/20'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${
                  selected ? 'bg-brand-teal/20 text-brand-teal' : 'bg-white/5 text-foreground-muted'
                }`}
              >
                {opt.icon}
              </span>
              <div className="flex-1">
                <h3 className={`font-semibold ${selected ? 'text-foreground' : 'text-foreground'}`}>
                  {opt.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground-muted">{opt.body}</p>
              </div>
              <span
                className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected ? 'border-brand-teal bg-brand-teal' : 'border-white/20'
                }`}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-background" />}
              </span>
            </button>
          )
        })}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel={
          isLoading
            ? 'Setting up…'
            : data.calibration_choice === 'benchmark'
              ? 'Start benchmark'
              : data.calibration_choice === 'import'
                ? 'Continue to import'
                : 'Build my plan'
        }
        isLoading={isLoading}
      />
    </div>
  )
}
