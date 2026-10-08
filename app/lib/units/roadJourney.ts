import type { UnitEntity, BuildingEntity } from '../../types/entities'
import type { GameContextLike } from '../../types/context'

export type RoadJourney = { targetLabel: string }
type TravelController = { start(unit: UnitEntity, town: BuildingEntity): boolean; cancel(unit: UnitEntity): void }
const controllers = new WeakMap<GameContextLike, TravelController>()
const internalOrders = new WeakSet<UnitEntity>()
export function registerRoadTravel(context: GameContextLike, controller?: TravelController): void {
  if (controller) controllers.set(context, controller)
  else controllers.delete(context)
}
export function beginRoadJourney(unit: UnitEntity, town: BuildingEntity): boolean {
  return Boolean(unit.context && controllers.get(unit.context)?.start(unit, town))
}
export function cancelRoadJourney(unit: UnitEntity): void {
  if (internalOrders.has(unit)) return
  if (unit.context) controllers.get(unit.context)?.cancel(unit)
  delete unit.roadJourney
}
export function withRoadJourneyOrder(unit: UnitEntity, run: () => void): void {
  internalOrders.add(unit)
  try {
    run()
  } finally {
    internalOrders.delete(unit)
  }
}
