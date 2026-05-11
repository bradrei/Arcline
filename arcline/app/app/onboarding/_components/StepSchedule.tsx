import type { OnboardingFormData } from './OnboardingFlow'
import type { WeekdayName } from '@/types'
import { StepNav } from './StepNav'

interface Props {
  data: OnboardingFormData
  onChange: (u: Partial<OnboardingFormData>) => void
  onNext: () => void
  onBack: () => void
  isLoading: boolean
  error: string | null
}

const WEEKDAYS: { key: WeekdayName; short: string }[] = [
  { key: 'monday', short: 'Mon' },
  { key: 'tuesday', short: 'Tue' },
  { key: 'wednesday', short: 'Wed' },
  { key: 'thursday', short: 'Thu' },
  { key: 'friday', short: 'Fri' },
  { key: 'saturday', short: 'Sat' },
  { key: 'sunday', short: 'Sun' },
]

const DISCIPLINES: { key: keyof OnboardingFormData['discipline_frequency']; label: string; color: string }[] = [
  { key: 'swim', label: 'Swim', color: 'text-blue-400' },
  { key: 'bike', label: 'Bike', color: 'text-yellow-400' },
  { key: 'run', label: 'Run', color: 'text-green-400' },
  { key: 'strength', label: 'Strength', color: 'text-orange-400' },
]

function Stepper({
  value,
  onChange,
  min = 0,
  max = 7,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-foreground-muted transition hover:border-white/20 hover:text-foreground disabled:opacity-30"
      >
        −
      </button>
      <span className="w-8 text-center text-base font-semibold text-foreground">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-foreground-muted transition hover:border-white/20 hover:text-foreground disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}

export function StepSchedule({ data, onChange, onNext, onBack, isLoading, error }: Props) {
  const availability = data.weekday_availability
  const frequency = data.discipline_frequency

  function toggleSlot(day: WeekdayName, slot: 'am' | 'pm') {
    const next = {
      ...availability,
      [day]: { ...availability[day], [slot]: !availability[day][slot] },
    }
    onChange({ weekday_availability: next })
  }

  function setFrequency(key: keyof OnboardingFormData['discipline_frequency'], value: number) {
    onChange({ discipline_frequency: { ...frequency, [key]: value } })
  }

  const totalSessions =
    frequency.swim + frequency.bike + frequency.run + frequency.strength
  const slotsAvailable = WEEKDAYS.reduce(
    (count, { key }) => count + (availability[key].am ? 1 : 0) + (availability[key].pm ? 1 : 0),
    0,
  )

  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold text-foreground">When can you actually train?</h2>
      <p className="mb-6 text-foreground-muted">
        Tap the AM/PM slots you&apos;re free each weekday. Then dial in how many sessions of each
        discipline you want per week — the coach uses both to plan around your real schedule.
      </p>

      {/* Weekday availability grid */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-surface">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-white/5 px-4 py-2 text-xs uppercase tracking-wider text-foreground-muted">
          <span>Day</span>
          <span className="w-14 text-center">AM</span>
          <span className="w-14 text-center">PM</span>
        </div>
        {WEEKDAYS.map(({ key, short }) => {
          const slot = availability[key]
          return (
            <div
              key={key}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-white/5 px-4 py-2.5 last:border-b-0"
            >
              <span className="text-sm font-medium text-foreground">{short}</span>
              <button
                type="button"
                onClick={() => toggleSlot(key, 'am')}
                aria-pressed={slot.am}
                className={`flex h-9 w-14 items-center justify-center rounded-lg border text-xs font-semibold transition ${
                  slot.am
                    ? 'border-brand-teal bg-brand-teal/15 text-brand-teal'
                    : 'border-white/10 text-foreground-muted hover:border-white/20'
                }`}
              >
                {slot.am ? '✓' : '—'}
              </button>
              <button
                type="button"
                onClick={() => toggleSlot(key, 'pm')}
                aria-pressed={slot.pm}
                className={`flex h-9 w-14 items-center justify-center rounded-lg border text-xs font-semibold transition ${
                  slot.pm
                    ? 'border-brand-teal bg-brand-teal/15 text-brand-teal'
                    : 'border-white/10 text-foreground-muted hover:border-white/20'
                }`}
              >
                {slot.pm ? '✓' : '—'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Discipline frequency */}
      <h3 className="mb-2 text-sm font-semibold text-foreground">Discipline mix (sessions per week)</h3>
      <p className="mb-3 text-xs text-foreground-muted">
        Rough targets — the coach balances against your hours and recovery.
      </p>
      <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-white/10 bg-surface p-4">
        {DISCIPLINES.map(({ key, label, color }) => (
          <div key={key} className="flex items-center justify-between">
            <span className={`text-sm font-medium ${color}`}>{label}</span>
            <Stepper
              value={frequency[key] ?? 0}
              onChange={v => setFrequency(key, v)}
            />
          </div>
        ))}
      </div>

      {totalSessions > slotsAvailable && (
        <p className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
          You picked {totalSessions} sessions across {slotsAvailable} available slots. The coach will
          fit what makes sense and may double up some slots (e.g. brick sessions). If that&apos;s too
          much, dial back here.
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <StepNav onBack={onBack} onNext={onNext} nextLabel="Next" isLoading={isLoading} />
    </div>
  )
}
