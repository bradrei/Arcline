'use client'

import { useRef, useState } from 'react'
import { useArclineStore } from '@/store/arclineStore'
import {
  checkSessionInjury,
  confirmSession,
  extractScreenshot,
  type ExtractedSession,
} from '@/lib/sessions/actions'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const FIELD = 'rounded-xl border border-white/10 bg-surface px-4 py-3 text-foreground placeholder:text-foreground-muted outline-none transition focus:border-brand-teal/60 focus:ring-1 focus:ring-brand-teal/40 w-full'

function today(): string {
  return new Date().toISOString().split('T')[0]
}

interface ConfirmFormState {
  session_type: string
  session_date: string
  duration_min: string
  distance_km: string
  avg_hr: string
  max_hr: string
  avg_pace: string
  notes: string
}

function extractedToFormState(e: ExtractedSession): ConfirmFormState {
  return {
    session_type: e.session_type ?? 'other',
    session_date: today(),
    duration_min: e.duration_min != null ? String(e.duration_min) : '',
    distance_km: e.distance_km != null ? String(e.distance_km) : '',
    avg_hr: e.avg_hr != null ? String(e.avg_hr) : '',
    max_hr: e.max_hr != null ? String(e.max_hr) : '',
    avg_pace: e.avg_pace ?? '',
    notes: e.notes ?? '',
  }
}

export function ScreenshotLogForm() {
  const setInjuryFlagged = useArclineStore(s => s.setInjuryFlagged)
  const triggerSessionComplete = useArclineStore(s => s.triggerSessionComplete)
  const setAdaptationPending = useArclineStore(s => s.setAdaptationPending)

  const fileRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ExtractedSession | null>(null)
  const [confirmForm, setConfirmForm] = useState<ConfirmFormState | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function validateFile(file: File): string | null {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      return 'Only JPEG and PNG files are supported.'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File must be under 10MB.'
    }
    return null
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateFile(file)
    if (err) setFileError(err)
  }

  async function handleExtract() {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    const err = validateFile(file)
    if (err) {
      setFileError(err)
      return
    }

    setIsExtracting(true)
    setExtractError(null)

    const formData = new FormData()
    formData.append('screenshot', file)

    const result = await extractScreenshot(formData)
    setIsExtracting(false)

    if (result.error) {
      setExtractError(result.error)
      return
    }

    if (result.data) {
      setExtracted(result.data)
      setConfirmForm(extractedToFormState(result.data))
    }
  }

  function updateConfirm(patch: Partial<ConfirmFormState>) {
    setConfirmForm(prev => (prev ? { ...prev, ...patch } : prev))
  }

  async function handleConfirmSave(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmForm) return
    setSaveError(null)

    // HC2 check on extracted notes
    if (confirmForm.notes.trim()) {
      const { injured, triggerText } = await checkSessionInjury(confirmForm.notes)
      if (injured) {
        setInjuryFlagged(true, triggerText, 'screenshot', () => doConfirmSave())
        return
      }
    }

    await doConfirmSave()
  }

  async function doConfirmSave() {
    if (!confirmForm) return
    setIsSaving(true)

    const result = await confirmSession({
      session_date: confirmForm.session_date,
      session_type: confirmForm.session_type,
      duration_min: Number(confirmForm.duration_min) || 0,
      distance_km: confirmForm.distance_km ? Number(confirmForm.distance_km) : null,
      avg_hr: confirmForm.avg_hr ? Number(confirmForm.avg_hr) : null,
      max_hr: confirmForm.max_hr ? Number(confirmForm.max_hr) : null,
      rpe: null,
      avg_pace: confirmForm.avg_pace || null,
      power_watts: null,
      notes: confirmForm.notes || null,
    })

    setIsSaving(false)
    if (result.error) {
      setSaveError(result.error)
    } else {
      setSuccess(true)
      triggerSessionComplete({
        duration_min: Number(confirmForm?.duration_min ?? 0),
        distance_km: confirmForm?.distance_km ? Number(confirmForm.distance_km) : null,
        rpe: null,
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
            setExtracted(null)
            setConfirmForm(null)
            if (fileRef.current) fileRef.current.value = ''
          }}
          className="text-sm text-brand-teal hover:underline"
        >
          Log another session
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Step 1: Upload */}
      {!confirmForm && (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-foreground-muted">
            Upload a screenshot from Garmin, Wahoo, Strava, or any training app.
          </p>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground-muted">Screenshot (JPEG or PNG, max 10MB)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleFileChange}
              className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-brand-teal/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand-teal cursor-pointer"
            />
            {fileError && <p className="text-sm text-red-400">{fileError}</p>}
          </div>

          {extractError && <p className="text-sm text-red-400">{extractError}</p>}

          <button
            type="button"
            onClick={handleExtract}
            disabled={isExtracting || !!fileError}
            className="rounded-xl bg-brand-teal px-6 py-3.5 text-sm font-semibold text-background transition hover:bg-brand-teal-dim disabled:opacity-50 cursor-pointer"
          >
            {isExtracting ? 'Extracting…' : 'Upload & Extract'}
          </button>
        </div>
      )}

      {/* Step 2: Confirm extracted data */}
      {confirmForm && (
        <form onSubmit={handleConfirmSave} className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Review & confirm</h3>
            <button
              type="button"
              onClick={() => { setConfirmForm(null); setExtracted(null) }}
              className="text-xs text-foreground-muted hover:text-foreground"
            >
              Start over
            </button>
          </div>

          {extracted?.confidence === 'low' && (
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3">
              <p className="text-sm text-yellow-400">
                Some fields couldn&apos;t be read clearly. Please check before saving.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground-muted">Date</label>
              <input
                type="date"
                value={confirmForm.session_date}
                max={today()}
                onChange={e => updateConfirm({ session_date: e.target.value })}
                className={FIELD + ' cursor-pointer'}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground-muted">Type</label>
              <input
                type="text"
                value={confirmForm.session_type}
                onChange={e => updateConfirm({ session_type: e.target.value })}
                className={FIELD}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground-muted">Duration (min)</label>
              <input
                type="number"
                value={confirmForm.duration_min}
                onChange={e => updateConfirm({ duration_min: e.target.value })}
                className={FIELD}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground-muted">Distance (km)</label>
              <input
                type="number"
                step="0.01"
                value={confirmForm.distance_km}
                onChange={e => updateConfirm({ distance_km: e.target.value })}
                className={FIELD}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground-muted">Avg HR</label>
              <input
                type="number"
                value={confirmForm.avg_hr}
                onChange={e => updateConfirm({ avg_hr: e.target.value })}
                className={FIELD}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground-muted">Max HR</label>
              <input
                type="number"
                value={confirmForm.max_hr}
                onChange={e => updateConfirm({ max_hr: e.target.value })}
                className={FIELD}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">Avg pace</label>
            <input
              type="text"
              value={confirmForm.avg_pace}
              onChange={e => updateConfirm({ avg_pace: e.target.value })}
              placeholder="e.g. 5:32"
              className={FIELD}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground-muted">Notes</label>
            <textarea
              rows={3}
              value={confirmForm.notes}
              onChange={e => updateConfirm({ notes: e.target.value })}
              className={FIELD + ' resize-none'}
            />
          </div>

          {saveError && <p className="text-sm text-red-400">{saveError}</p>}

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-brand-teal px-6 py-3.5 text-sm font-semibold text-background transition hover:bg-brand-teal-dim disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Saving…' : 'Confirm & save'}
          </button>
        </form>
      )}
    </>
  )
}
