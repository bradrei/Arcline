import type { PlanWeek } from '@/types'
import { AnimatedSessionCards } from './AnimatedSessionCards'

interface Props {
  week: PlanWeek
}

export function PlanWeekView({ week }: Props) {
  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2">
      <AnimatedSessionCards sessions={week.sessions} />
    </div>
  )
}
