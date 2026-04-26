'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useArclineStore } from '@/store/arclineStore'

// Polls the adaptations table for up to 16 seconds after a session save,
// then calls triggerAdaptationToast with the real AI coaching reasoning.
export function AdaptationPoller() {
  const adaptationPending = useArclineStore(s => s.adaptationPending)
  const adaptationPendingSince = useArclineStore(s => s.adaptationPendingSince)
  const setAdaptationPending = useArclineStore(s => s.setAdaptationPending)
  const triggerAdaptationToast = useArclineStore(s => s.triggerAdaptationToast)

  useEffect(() => {
    if (!adaptationPending || !adaptationPendingSince) return

    const supabase = createClient()
    const sinceIso = new Date(adaptationPendingSince).toISOString()
    let attempts = 0
    const maxAttempts = 8
    let timer: ReturnType<typeof setTimeout>

    async function poll() {
      attempts++
      const { data } = await supabase
        .from('adaptations')
        .select('ai_reasoning')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data?.ai_reasoning) {
        triggerAdaptationToast(data.ai_reasoning)
        setAdaptationPending(false)
      } else if (attempts < maxAttempts) {
        timer = setTimeout(poll, 2000)
      } else {
        // Adaptation took too long — show generic message
        triggerAdaptationToast('Your plan has been updated based on today\'s session.')
        setAdaptationPending(false)
      }
    }

    // First poll after 3 seconds — adaptation typically takes 5–10 seconds
    timer = setTimeout(poll, 3000)
    return () => clearTimeout(timer)
  }, [adaptationPending, adaptationPendingSince, setAdaptationPending, triggerAdaptationToast])

  return null
}
