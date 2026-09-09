import { canReachActionTarget, usesUnitContactAction } from '../actions/contactActions'
import { CELL_HEIGHT, FAMILY_TYPES } from '../constants'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import { instanceContactInstance } from '../grid/movement'
import { getRoundedIsoShapePoints } from '../graphics/selection'
import { closestPointOnSegment, distanceToPolygon, pointIsInsidePolygon } from '../geometry/polygon'
import { isHeroControlled } from '../units/unitControl'

const HERO_FOOTPRINT_INTERACTION_BASE_MARGIN = CELL_HEIGHT * 1.5
const HERO_FOOTPRINT_INTERACTION_MAX_MARGIN = CELL_HEIGHT * 2

type Point = { x: number; y: number }

function getTargetFootprintPoints(target: RuntimeEntity): Point[] | null {
  if (![FAMILY_TYPES.building, FAMILY_TYPES.resource].includes(target.family ?? '')) return null
  const factor = target.selectionFactor ?? target.size ?? 1
  return getRoundedIsoShapePoints({ x: target.x, y: target.y, factor: Math.max(1, factor) })
}

function getTargetFootprintInteractionMargin(target: RuntimeEntity): number {
  const factor = Math.max(1, target.selectionFactor ?? target.size ?? 1)
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
  if (pointIsInsidePolygon(points, unit)) return target

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
  if (!target || !isHeroControlled(unit) || target.isDestroyed) return false
  if (usesUnitContactAction(unit, action)) return canReachActionTarget(unit, target, action)
  return isHeroNearTargetFootprint(unit, target)
}

export function isHeroInteractionTargetReachable(
  unit: UnitEntity,
  action: string | null | undefined,
  target: RuntimeEntity | null | undefined
): boolean {
  if (!target || target === unit || target.isDestroyed) return false
  if (usesUnitContactAction(unit, action)) return canReachActionTarget(unit, target, action)
  if (isHeroActionInRange(unit, action, target)) return true
  return instanceContactInstance(unit, target)
}
