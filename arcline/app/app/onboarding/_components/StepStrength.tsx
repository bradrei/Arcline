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
  value: 'none' | 'light' | 'moderate' | 'serious'
  title: string
  body: string
}[] = [
  { value: 'none', title: 'None', body: 'Just swim, bike, run.' },
  {
    value: 'light',
    title: 'Light',
    body: '1 short session per week, focused on injury prevention.',
  },
  {
    value: 'moderate',
    title: 'Moderate',
    body: '2 sessions per week, balanced with triathlon volume.',
  },
  {
    value: 'serious',
    title: 'Serious',
    body: '2-3 sessions per week including plyometrics and mobility work.',
  },
]

export function StepStrength({ data, onChange, onNext, onBack, isLoading, error }: Props) {
  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-foreground">How do you want to approach strength work?</h2>
      <p className="mb-8 text-foreground-muted">
        Pick what you can sustain. Your plan adjusts everything else around it.
      </p>

      <div className="flex flex-col gap-3">
        {OPTIONS.map(opt => {
          const selected = data.strength_preference === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ strength_preference: opt.value })}
              className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition cursor-pointer ${
                selected
                  ? 'border-brand-teal bg-brand-teal/5'
                  : 'border-white/10 bg-surface hover:border-white/20'
              }`}
            >
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{opt.title}</h3>
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
        nextLabel="Next"
        isLoading={isLoading}
      />
    </div>
  )
}
