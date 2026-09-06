import type { DailyWorldReport } from './DailyWorldReport'

export type DailyWorldEvent = {
  day: number
  previousDay: number
  report?: DailyWorldReport
}

export interface DailyWorldEventHandler {
  handleDailyWorldEvent(event: DailyWorldEvent): void
  destroy?(): void
}
