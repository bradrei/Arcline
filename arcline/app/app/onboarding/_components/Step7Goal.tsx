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

export function Step7Goal({ data, onChange, onNext, onBack, isLoading, error }: Props) {
  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-foreground">What are you training for?</h2>
      <p className="mb-8 text-foreground-muted">
        Every adaptation keeps this as the anchor. Be specific.
      </p>

      {/* Goal type toggle */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        {(
          [
            { value: 'event_date', label: 'Training for an event' },
            { value: 'pace_ability', label: 'Building to a fitness goal' },
          ] as const
        ).map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ goal_type: value })}
            className={`flex-1 rounded-xl px-4 py-3.5 text-sm font-medium transition cursor-pointer ${
              data.goal_type === value
                ? 'bg-brand-teal text-background'
                : 'border border-white/10 text-foreground-muted hover:border-white/20 hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Event date fields */}
      {data.goal_type === 'event_date' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">Event name</label>
            <input
              type="text"
              value={data.goal_description}
              onChange={e => onChange({ goal_description: e.target.value })}
              placeholder="e.g. Ironman 70.3 Port Macquarie"
              className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">Race date</label>
            <input
              type="date"
              value={data.goal_date}
              onChange={e => onChange({ goal_date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Fitness goal field */}
      {data.goal_type === 'pace_ability' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground-muted">Describe your goal</label>
          <textarea
            rows={3}
            value={data.goal_description}
            onChange={e => onChange({ goal_description: e.target.value })}
            placeholder="e.g. Complete my first Olympic triathlon, improve my run split to under 50 minutes for 10k."
            className="resize-none rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40"
          />
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel={isLoading ? 'Building your plan…' : 'Build my plan'}
        isLoading={isLoading}
      />
    </div>
  )
}
