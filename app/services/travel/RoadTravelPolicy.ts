import { getEntitySpaceId } from '../../lib/mapSpaces'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { RoadPoint } from './RoadRoute'
import { planRoadRoute, planTownApproach } from './RoadRoute'

export function isRoadTravelObserved(
  context: GameContextLike,
  point: RoadPoint,
  inCamera: (point: RoadPoint) => boolean
): boolean {
  const hero = context.controls?.heroUnit
  if (hero) return getEntitySpaceId(hero) === 'outside' && Math.hypot(hero.i - point.i, hero.j - point.j) <= 94
  return inCamera(point)
}

export function* planRoadJourney(
  context: GameContextLike,
  unit: UnitEntity,
  town: BuildingEntity
): Generator<void, RoadPoint[] | null> {
  const route = yield* planRoadRoute(unit, town, context.map)
  if (route) return route
  return yield* planTownApproach(unit, town, context.map)
}
