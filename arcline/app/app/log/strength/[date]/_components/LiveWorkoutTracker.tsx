'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useArclineStore } from '@/store/arclineStore'
import { finishStrengthSession, type SetEntry } from '@/lib/strength/actions'
import type { StrengthExercise } from '@/types'



interface Props {
  sessionDate: string
  focus: string | null
  summary: string | null
  durationMin: number
  exercises: StrengthExercise[]
}

interface SetRowState {
  weight: string
  reps: string
  logged: boolean
}

export function LiveWorkoutTracker({
  sessionDate,
  focus,
  summary,
  durationMin,
  exercises,
}: Props) {
  const router = useRouter()
  const triggerSessionComplete = useArclineStore(s => s.triggerSessionComplete)
  const setAdaptationPending = useArclineStore(s => s.setAdaptationPending)
  const setInjuryFlagged = useArclineStore(s => s.setInjuryFlagged)

  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [sets, setSets] = useState<SetRowState[][]>(() =>
    exercises.map(ex => Array.from({ length: ex.sets }, () => ({ weight: '', reps: '', logged: false }))),
  )
  const [restSecondsLeft, setRestSecondsLeft] = useState(0)
  const [restActive, setRestActive] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const restTickerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentExercise = exercises[exerciseIndex]
  const currentSetSlots = sets[exerciseIndex]
  const currentSetIndex = currentSetSlots.findIndex(s => !s.logged)
  const allSetsForCurrentLogged = currentSetIndex === -1
  const isFinalExercise = exerciseIndex === exercises.length - 1
  const allDone = sets.every(slots => slots.every(s => s.logged))

  // Rest timer tick
  useEffect(() => {
    if (!restActive) return
    restTickerRef.current = setInterval(() => {
      setRestSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(restTickerRef.current!)
          setRestActive(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (restTickerRef.current) clearInterval(restTickerRef.current)
    }
  }, [restActive])

  function logSet() {
    if (currentSetIndex === -1) return
    setError(null)
    setSets(prev => {
      const next = prev.map(slots => slots.slice())
      next[exerciseIndex][currentSetIndex] = {
        weight: prev[exerciseIndex][currentSetIndex].weight,
        reps: prev[exerciseIndex][currentSetIndex].reps,
        logged: true,
      }
      return next
    })
    if (currentExercise.rest_seconds && currentSetIndex < currentSetSlots.length - 1) {
      setRestSecondsLeft(currentExercise.rest_seconds)
      setRestActive(true)
    }
  }

  function skipRest() {
    setRestActive(false)
    setRestSecondsLeft(0)
  }

  function updateCurrentSet(field: 'weight' | 'reps', value: string) {
    if (currentSetIndex === -1) return
    setSets(prev => {
      const next = prev.map(slots => slots.slice())
      next[exerciseIndex][currentSetIndex] = {
        ...next[exerciseIndex][currentSetIndex],
        [field]: value,
      }
      return next
    })
  }

  function nextExercise() {
    if (!allSetsForCurrentLogged) return
    if (isFinalExercise) return
    setExerciseIndex(i => i + 1)
    skipRest()
  }

  async function finishSession() {
    setError(null)
    setSubmitting(true)

    const flatSets: SetEntry[] = []
    sets.forEach((slots, exIdx) => {
      slots.forEach((slot, setIdx) => {
        if (!slot.logged) return
        flatSets.push({
          exercise_index: exIdx,
          exercise_name: exercises[exIdx].name,
          set_number: setIdx + 1,
          weight_kg: slot.weight ? Number(slot.weight) : null,
          reps_completed: slot.reps ? Number(slot.reps) : null,
        })
      })
    })

    try {
      const result = await finishStrengthSession({
        session_date: sessionDate,
        duration_min: durationMin,
        notes: notes.trim() || null,
        exercises,
        sets: flatSets,
      })
      if (result.injured) {
        setInjuryFlagged(true, result.triggerText ?? notes, 'session_log')
        router.push('/app/dashboard')
        return
      }
      if (result.error) {
        setError(result.error)
        setSubmitting(false)
        return
      }
      triggerSessionComplete({
        duration_min: durationMin,
        distance_km: null,
        rpe: null,
      })
      setAdaptationPending(true)
      router.push('/app/dashboard')
    } catch {
      setError("Couldn't save the session. Try again.")
      setSubmitting(false)
    }
  }

  const progress = useMemo(() => {
    const total = exercises.reduce((s, ex) => s + ex.sets, 0)
    const done = sets.flat().filter(s => s.logged).length
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
  }, [sets, exercises])

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-foreground-muted">
          Strength · {sessionDate}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          Exercise {exerciseIndex + 1} of {exercises.length}
        </h1>
        {focus && <p className="mt-1 text-sm text-foreground-muted">{focus}</p>}
        {summary && <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{summary}</p>}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full bg-brand-teal"
            animate={{ width: `${progress.pct}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          />
        </div>
        <p className="mt-1 text-xs text-foreground-muted">
          {progress.done} of {progress.total} sets logged
        </p>
      </header>

      {/* Current exercise */}
      <section className="rounded-2xl border border-white/10 bg-surface p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{currentExercise.name}</h2>
          <p className="text-sm text-foreground-muted">
            {currentExercise.sets} × {currentExercise.reps}
          </p>
        </div>
        {currentExercise.description && (
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
            {currentExercise.description}
          </p>
        )}
        {currentExercise.cue && (
          <p className="mt-2 text-sm italic text-brand-teal">Cue: {currentExercise.cue}</p>
        )}

        {/* Set rows */}
        <div className="mt-4 flex flex-col gap-2">
          {currentSetSlots.map((slot, i) => {
            const isCurrent = i === currentSetIndex
            return (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  slot.logged
                    ? 'border-brand-teal/30 bg-brand-teal/5'
                    : isCurrent
                      ? 'border-foreground/20 bg-background'
                      : 'border-white/5 bg-background/40 opacity-60'
                }`}
              >
                <span className="w-12 text-xs font-semibold text-foreground-muted">Set {i + 1}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  placeholder="kg"
                  value={slot.weight}
                  onChange={e => isCurrent && updateCurrentSet('weight', e.target.value)}
                  disabled={!isCurrent}
                  className="w-20 rounded-md border border-white/10 bg-background px-2 py-1.5 text-sm text-foreground outline-none disabled:opacity-50 focus:border-brand-teal/60"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="reps"
                  value={slot.reps}
                  onChange={e => isCurrent && updateCurrentSet('reps', e.target.value)}
                  disabled={!isCurrent}
                  className="w-20 rounded-md border border-white/10 bg-background px-2 py-1.5 text-sm text-foreground outline-none disabled:opacity-50 focus:border-brand-teal/60"
                />
                {slot.logged && <span className="ml-auto text-xs font-bold text-brand-teal">✓</span>}
              </div>
            )
          })}
        </div>

        {/* Action: log set / next exercise / rest timer */}
        <div className="mt-4 flex flex-col gap-2">
          {!allSetsForCurrentLogged && (
            <button
              type="button"
              onClick={logSet}
              className="rounded-xl bg-brand-teal px-4 py-3 text-sm font-semibold text-background transition hover:bg-brand-teal-dim"
            >
              Log set
            </button>
          )}
          {restActive && (
            <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
              <p className="text-sm text-amber-300">Rest: {restSecondsLeft}s</p>
              <button
                type="button"
                onClick={skipRest}
                className="text-xs font-semibold text-amber-300 underline"
              >
                Skip
              </button>
            </div>
          )}
          {allSetsForCurrentLogged && !isFinalExercise && (
            <button
              type="button"
              onClick={nextExercise}
              className="rounded-xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-3 text-sm font-semibold text-brand-teal transition hover:bg-brand-teal/20"
            >
              Next exercise →
            </button>
          )}
        </div>
      </section>

      {/* Notes + finish */}
      {allDone && (
        <section className="flex flex-col gap-3">
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How did this session feel? Any niggles?"
            className="w-full resize-none rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-brand-teal/60"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="button"
            onClick={finishSession}
            disabled={submitting}
            className="rounded-xl bg-brand-teal px-6 py-3.5 text-sm font-semibold text-background transition hover:bg-brand-teal-dim disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Finish session'}
          </button>
        </section>
      )}
    </div>
  )
}
