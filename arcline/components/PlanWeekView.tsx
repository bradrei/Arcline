import type { Adaptation, PlanWeek } from '@/types'
import { AnimatedSessionCards } from './AnimatedSessionCards'

interface Props {
  week: PlanWeek
  adaptedDates?: Set<string>
  adaptations?: Adaptation[]
}

export function PlanWeekView({ week, adaptedDates, adaptations }: Props) {
  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2">
      <AnimatedSessionCards
        sessions={week.sessions}
        adaptedDates={adaptedDates}
        adaptations={adaptations}
      />
    </div>
  )
}
