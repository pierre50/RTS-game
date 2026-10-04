import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'

export const OUTPOST_PATROL_LIMIT = 2
export type IdlePatrolVisit = {
  destination?: UnitEntity['dest']
  phase: 'travel' | 'pause' | 'exit'
  until: number
}

export function nextIdlePatrolTime(context: GameContextLike): number {
  return context.scheduler.elapsedMs + context.map.randomRange(5000, 25000)
}

export function beginIdlePatrolVisit(context: GameContextLike, unit: UnitEntity): IdlePatrolVisit {
  return { destination: unit.dest, phase: 'travel', until: context.scheduler.elapsedMs + 90000 }
}

/** Start the quiet period only once the unit has actually reached its destination. */
export function settleIdlePatrolVisit(context: GameContextLike, visit: IdlePatrolVisit): void {
  visit.phase = 'pause'
  visit.until = context.scheduler.elapsedMs + context.map.randomRange(10000, 25000)
}
