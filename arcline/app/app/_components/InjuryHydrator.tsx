'use client'

import { useEffect } from 'react'
import { useArclineStore } from '@/store/arclineStore'
import type { InjurySource } from '@/types'

interface Props {
  triggerText: string
  source: InjurySource
}

export function InjuryHydrator({ triggerText, source }: Props) {
  const setInjuryFlagged = useArclineStore(s => s.setInjuryFlagged)

  useEffect(() => {
    setInjuryFlagged(true, triggerText, source)
    // Intentionally runs once on mount — server rendered the flag, client needs to show the screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
