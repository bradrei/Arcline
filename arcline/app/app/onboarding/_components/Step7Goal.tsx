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

const RACE_DISTANCES: { value: OnboardingFormData['race_distance']; label: string }[] = [
  { value: '', label: 'Pick a distance…' },
  { value: 'sprint', label: 'Sprint triathlon' },
  { value: 'olympic', label: 'Olympic triathlon' },
  { value: '70.3', label: '70.3 (Half Ironman)' },
  { value: 'ironman', label: 'Ironman (full)' },
  { value: 'standalone_run', label: 'Standalone running race' },
  { value: 'other', label: 'Other' },
]

const FIELD =
  'rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40'

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
              className={FIELD}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">Race date</label>
            <input
              type="date"
              value={data.goal_date}
              onChange={e => onChange({ goal_date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className={FIELD + ' cursor-pointer'}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">Race distance</label>
            <select
              value={data.race_distance}
              onChange={e =>
                onChange({ race_distance: e.target.value as OnboardingFormData['race_distance'] })
              }
              className={FIELD + ' cursor-pointer appearance-none'}
            >
              {RACE_DISTANCES.map(d => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* Goal mode toggle */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground-muted">Goal</span>
            <div className="flex gap-2">
              {(['finish', 'time'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChange({ goal_mode: m })}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition cursor-pointer ${
                    data.goal_mode === m
                      ? 'bg-brand-teal text-background'
                      : 'border border-white/10 text-foreground-muted hover:border-white/20 hover:text-foreground'
                  }`}
                >
                  {m === 'finish' ? 'Just finish' : 'Target time'}
                </button>
              ))}
            </div>
          </div>

          {data.goal_mode === 'time' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground-muted">Target finish time</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="hh"
                    value={data.goal_time_hh}
                    onChange={e => onChange({ goal_time_hh: e.target.value })}
                    className={FIELD + ' w-20'}
                  />
                  <span className="text-foreground-muted">:</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    placeholder="mm"
                    value={data.goal_time_mm}
                    onChange={e => onChange({ goal_time_mm: e.target.value })}
                    className={FIELD + ' w-20'}
                  />
                  <span className="text-foreground-muted">:</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    placeholder="ss"
                    value={data.goal_time_ss}
                    onChange={e => onChange({ goal_time_ss: e.target.value })}
                    className={FIELD + ' w-20'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground-muted">Swim pace</label>
                  <input
                    type="text"
                    placeholder="1:50/100m"
                    value={data.swim_pace_per_100m}
                    onChange={e => onChange({ swim_pace_per_100m: e.target.value })}
                    className={FIELD}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground-muted">Bike speed</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder="32 km/h"
                    value={data.bike_kmh}
                    onChange={e => onChange({ bike_kmh: e.target.value })}
                    className={FIELD}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground-muted">Run pace</label>
                  <input
                    type="text"
                    placeholder="5:15/km"
                    value={data.run_pace_per_km}
                    onChange={e => onChange({ run_pace_per_km: e.target.value })}
                    className={FIELD}
                  />
                </div>
              </div>
            </>
          )}
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
            className={FIELD + ' resize-none'}
          />
        </div>
      )}

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
