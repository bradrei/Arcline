'use client'

import { useState } from 'react'
import { useArclineStore } from '@/store/arclineStore'
import {
  checkSessionInjury,
  logManualSession,
  type ManualSessionInput,
} from '@/lib/sessions/actions'
import type { SessionType } from '@/types'

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'swim', label: 'Swim' },
  { value: 'bike', label: 'Bike' },
  { value: 'run', label: 'Run' },
  { value: 'brick', label: 'Brick' },
  { value: 'strength', label: 'Strength' },
  { value: 'open_water', label: 'Open Water' },
  { value: 'race', label: 'Race' },
  { value: 'rest', label: 'Rest' },
]

const PACE_CONFIG: Partial<Record<SessionType, { label: string; placeholder: string }>> = {
  run: { label: 'Avg pace', placeholder: 'min/km e.g. 5:32' },
  brick: { label: 'Avg pace', placeholder: 'min/km e.g. 5:32' },
  race: { label: 'Avg pace', placeholder: 'min/km e.g. 5:32' },
  bike: { label: 'Speed', placeholder: 'km/h e.g. 32.5' },
  swim: { label: 'Avg pace', placeholder: 'min/100m e.g. 1:45' },
  open_water: { label: 'Avg pace', placeholder: 'min/100m e.g. 1:45' },
}

const RPE_LABELS: Record<number, string> = {
  1: 'Effortless',
  3: 'Easy',
  5: 'Moderate',
  7: 'Hard',
  10: 'Absolute limit',
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

const FIELD = 'rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40 w-full'

export function ManualLogForm() {
  const setInjuryFlagged = useArclineStore(s => s.setInjuryFlagged)
  const triggerSessionComplete = useArclineStore(s => s.triggerSessionComplete)
  const setAdaptationPending = useArclineStore(s => s.setAdaptationPending)

  const [sessionType, setSessionType] = useState<SessionType>('run')
  const [sessionDate, setSessionDate] = useState(today())
  const [durationMin, setDurationMin] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [avgHr, setAvgHr] = useState('')
  const [maxHr, setMaxHr] = useState('')
  const [rpe, setRpe] = useState(5)
  const [avgPace, setAvgPace] = useState('')
  const [powerWatts, setPowerWatts] = useState('')
  const [notes, setNotes] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function buildInput(): ManualSessionInput {
    return {
      session_date: sessionDate,
      session_type: sessionType,
      duration_min: Number(durationMin) || 0,
      distance_km: distanceKm ? Number(distanceKm) : null,
      avg_hr: avgHr ? Number(avgHr) : null,
      max_hr: maxHr ? Number(maxHr) : null,
      rpe: rpe,
      avg_pace: avgPace || null,
      power_watts: powerWatts ? Number(powerWatts) : null,
      notes: notes || null,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!durationMin || Number(durationMin) <= 0) {
      setError('Please enter a duration.')
      return
    }

    setIsLoading(true)
    const data = buildInput()

    // HC2 check on notes
    if (notes.trim()) {
      const { injured, triggerText } = await checkSessionInjury(notes)
      if (injured) {
        setInjuryFlagged(true, triggerText, 'session_log', () => doSave(data))
        setIsLoading(false)
        return
      }
    }

    await doSave(data)
  }

  async function doSave(data: ManualSessionInput) {
    setIsLoading(true)
    const result = await logManualSession(data)
    setIsLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      triggerSessionComplete({
        duration_min: data.duration_min,
        distance_km: data.distance_km,
        rpe: data.rpe,
      })
      setAdaptationPending(true)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal/10">
          <span className="text-2xl text-brand-teal">✓</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground">Session logged</h3>
        <button
          onClick={() => {
            setSuccess(false)
            setDurationMin('')
            setDistanceKm('')
            setAvgHr('')
            setMaxHr('')
            setRpe(5)
            setAvgPace('')
            setPowerWatts('')
            setNotes('')
          }}
          className="text-sm text-brand-teal hover:underline"
        >
          Log another session
        </button>
      </div>
    )
  }

  const paceConfig = PACE_CONFIG[sessionType]

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Row: date + type */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">Date</label>
            <input
              type="date"
              value={sessionDate}
              max={today()}
              onChange={e => setSessionDate(e.target.value)}
              className={FIELD + ' cursor-pointer'}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">Type</label>
            <select
              value={sessionType}
              onChange={e => setSessionType(e.target.value as SessionType)}
              className={FIELD + ' cursor-pointer appearance-none'}
            >
              {SESSION_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row: duration + distance */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">Duration (min)</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={durationMin}
              onChange={e => setDurationMin(e.target.value)}
              placeholder="e.g. 45"
              className={FIELD}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">Distance (km)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={distanceKm}
              onChange={e => setDistanceKm(e.target.value)}
              placeholder="optional"
              className={FIELD}
            />
          </div>
        </div>

        {/* Row: avg HR + max HR */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">Avg HR (bpm)</label>
            <input
              type="number"
              inputMode="numeric"
              min={30}
              max={250}
              value={avgHr}
              onChange={e => setAvgHr(e.target.value)}
              placeholder="optional"
              className={FIELD}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">Max HR (bpm)</label>
            <input
              type="number"
              inputMode="numeric"
              min={30}
              max={250}
              value={maxHr}
              onChange={e => setMaxHr(e.target.value)}
              placeholder="optional"
              className={FIELD}
            />
          </div>
        </div>

        {/* RPE slider */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-medium text-foreground-muted">RPE</label>
            <span className="text-sm font-bold text-foreground">
              {rpe}
              <span className="ml-1.5 font-normal text-foreground-muted text-xs">
                {RPE_LABELS[rpe] ?? ''}
              </span>
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={rpe}
            onChange={e => setRpe(Number(e.target.value))}
            className="w-full accent-brand-teal cursor-pointer"
          />
          <div className="flex justify-between text-xs text-foreground-muted">
            <span>1 = effortless</span>
            <span>10 = absolute limit</span>
          </div>
        </div>

        {/* Pace */}
        {paceConfig && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">{paceConfig.label}</label>
            <input
              type="text"
              value={avgPace}
              onChange={e => setAvgPace(e.target.value)}
              placeholder={paceConfig.placeholder}
              className={FIELD}
            />
          </div>
        )}

        {/* Power — bike sessions only */}
        {sessionType === 'bike' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">Power (watts)</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={powerWatts}
              onChange={e => setPowerWatts(e.target.value)}
              placeholder="optional"
              className={FIELD}
            />
          </div>
        )}

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground-muted">Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How did it feel? Any niggles?"
            className={FIELD + ' resize-none'}
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-xl bg-brand-teal px-6 py-3.5 text-sm font-semibold text-background transition hover:bg-brand-teal-dim disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? 'Saving…' : 'Save session'}
        </button>
      </form>
  )
}
