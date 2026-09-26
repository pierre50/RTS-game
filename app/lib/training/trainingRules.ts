/** Calendar rules; placement, payment and UI remain the responsibility of each adapter. */
export function getTrainingDurationDays(config: { trainingDays?: number }, override?: number): number {
  return Math.max(0, Math.ceil(override ?? config.trainingDays ?? 1))
}

export function isTrainingComplete(day: number, completeDay: number | null | undefined): boolean {
  return completeDay != null && day >= completeDay
}

export function getTrainingProgress(
  day: number,
  startedDay: number | null | undefined,
  completeDay: number | null | undefined
): number {
  if (startedDay == null || completeDay == null) return 0
  if (isTrainingComplete(day, completeDay)) return 100
  return Math.min(100, Math.floor((Math.max(0, day - startedDay) / Math.max(1, completeDay - startedDay)) * 100))
}
