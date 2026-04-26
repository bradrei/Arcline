import { createClient } from '@/lib/supabase/server'
import { AppNav } from './_components/AppNav'
import { InjuryHydrator } from './_components/InjuryHydrator'
import { AdaptationPoller } from './_components/AdaptationPoller'
import { AdaptationToast } from '@/components/gamification/AdaptationToast'
import { SessionCompleteAnimation } from '@/components/gamification/SessionCompleteAnimation'
import type { InjurySource } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let injuryFlag: { trigger_text: string; trigger_source: string } | null = null
  if (user) {
    const { data } = await supabase
      .from('injury_flags')
      .select('trigger_text, trigger_source')
      .eq('user_id', user.id)
      .eq('referral_confirmed', false)
      .eq('resolved', false)
      .order('detected_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    injuryFlag = data
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {injuryFlag && (
        <InjuryHydrator
          triggerText={injuryFlag.trigger_text}
          source={(injuryFlag.trigger_source as InjurySource) ?? 'session_log'}
        />
      )}
      <AdaptationPoller />
      <AdaptationToast />
      <SessionCompleteAnimation />
      {children}
      <AppNav />
    </div>
  )
}
