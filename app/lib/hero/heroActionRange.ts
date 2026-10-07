import { canReachActionTarget, usesUnitContactAction } from '../actions/contactActions'
import { CELL_HEIGHT, FAMILY_TYPES } from '../constants'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import { getBuildingContactDistance } from '../grid/cells'
import { instancesDistance } from '../maths'
import { instanceContactInstance } from '../grid/movement'
import { getRoundedIsoFootprintPoints, getRoundedIsoShapePoints } from '../graphics/isoFootprint'
import { closestPointOnSegment, distanceToPolygon, pointIsInsidePolygon } from '../geometry/polygon'
import { getEntitySpaceGrid, sameMapSpace } from '../mapSpaces'
import { isHeroControlled } from '../units/unitControl'

const HERO_FOOTPRINT_INTERACTION_BASE_MARGIN = CELL_HEIGHT * 1.5
const HERO_FOOTPRINT_INTERACTION_MAX_MARGIN = CELL_HEIGHT * 2

type Point = { x: number; y: number }

function getTargetFootprintPoints(target: RuntimeEntity): Point[] | null {
  if (![FAMILY_TYPES.building, FAMILY_TYPES.resource].includes(target.family ?? '')) return null
  if (target.interactionFootprintFactor == null)
    return getRoundedIsoFootprintPoints(target, getEntitySpaceGrid(target, target.context?.map))
  const factor = target.interactionFootprintFactor
  return getRoundedIsoShapePoints({ x: target.x, y: target.y, factor: Math.max(1, factor) })
}

function getTargetFootprintInteractionMargin(target: RuntimeEntity): number {
  const factor = Math.max(1, target.interactionFootprintFactor ?? target.size ?? 1)
  return Math.min(HERO_FOOTPRINT_INTERACTION_MAX_MARGIN, HERO_FOOTPRINT_INTERACTION_BASE_MARGIN + (factor - 1) * 8)
}

function isHeroNearTargetFootprint(unit: UnitEntity, target: RuntimeEntity): boolean {
  const points = getTargetFootprintPoints(target)
  if (!points) return false
  return distanceToPolygon(points, unit) <= getTargetFootprintInteractionMargin(target)
}

export function getHeroInteractionTargetPoint(unit: UnitEntity, target: RuntimeEntity): Point {
  const points = getTargetFootprintPoints(target)
  if (!points?.length) return target
  if (pointIsInsidePolygon(points, unit)) return { x: unit.x, y: unit.y }

  let closestPoint = points[0]
  let closestDistance = Infinity
  for (let index = 0; index < points.length; index++) {
    const point = closestPointOnSegment(unit, points[index], points[(index + 1) % points.length])
    const distance = Math.hypot(unit.x - point.x, unit.y - point.y)
    if (distance < closestDistance) {
      closestPoint = point
      closestDistance = distance
    }
  }
  return closestPoint
}

export function isHeroActionInRange(
  unit: UnitEntity,
  action: string | null | undefined,
  target: RuntimeEntity | null | undefined
): boolean {
  if (!target || !isHeroControlled(unit) || target.isDestroyed || !sameMapSpace(unit, target)) return false
  if (usesUnitContactAction(unit, action)) return canReachActionTarget(unit, target, action)
  return isHeroNearTargetFootprint(unit, target)
}

export function isHeroInteractionTargetReachable(
  unit: UnitEntity,
  action: string | null | undefined,
  target: RuntimeEntity | null | undefined
): boolean {
  if (!target || target === unit || target.isDestroyed || !sameMapSpace(unit, target)) return false
  if (usesUnitContactAction(unit, action)) return canReachActionTarget(unit, target, action)
  if (isHeroActionInRange(unit, action, target)) return true
  return instanceContactInstance(unit, target)
}

/**
 * Keep an open interaction within half a tile beyond its normal opening range. `openingRadius`
 * widens that range for sessions opened from afar, such as a charged group communication.
 */
export function isHeroInteractionSessionInRange(
  hero: UnitEntity | null | undefined,
  target: RuntimeEntity,
  openingRadius?: number
): boolean {
  if (!hero || hero.isDead || hero.isDestroyed || target.isDestroyed || !sameMapSpace(hero, target)) return false
  if (target === hero) return true
  if (isHeroInteractionTargetReachable(hero, null, target)) return true
  if (
    openingRadius !== undefined &&
    Math.hypot((target.i ?? 0) - (hero.i ?? 0), (target.j ?? 0) - (hero.j ?? 0)) <= openingRadius + 0.5
  )
    return true
  const points = getTargetFootprintPoints(target)
  if (points && distanceToPolygon(points, hero) <= getTargetFootprintInteractionMargin(target) + CELL_HEIGHT / 2) {
    return true
  }
  return instancesDistance(hero, target) < getBuildingContactDistance(target.size ?? 1) + 1.5
}
