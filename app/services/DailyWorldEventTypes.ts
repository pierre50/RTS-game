export type DailyWorldEvent = {
  day: number
  previousDay: number
}

export interface DailyWorldEventHandler {
  handleDailyWorldEvent(event: DailyWorldEvent): void
  destroy?(): void
}
