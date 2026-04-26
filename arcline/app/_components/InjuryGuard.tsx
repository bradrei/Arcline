'use client'

import { useArclineStore } from '@/store/arclineStore'
import { InjuryReferralScreen } from '@/components/InjuryReferralScreen'

export function InjuryGuard() {
  const injuryFlagged = useArclineStore(s => s.injuryFlagged)
  const injuryTriggerText = useArclineStore(s => s.injuryTriggerText)
  const injurySource = useArclineStore(s => s.injurySource)
  const injuryOnResolve = useArclineStore(s => s.injuryOnResolve)
  const setInjuryFlagged = useArclineStore(s => s.setInjuryFlagged)

  if (!injuryFlagged) return null

  return (
    <InjuryReferralScreen
      triggerText={injuryTriggerText}
      source={injurySource ?? 'session_log'}
      onDismiss={() => {
        setInjuryFlagged(false)
        injuryOnResolve?.()
      }}
    />
  )
}
