import { ACTION_TYPES, CELL_HEIGHT, FAMILY_TYPES } from '../constants'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import { getBuildingContactDistance } from '../grid/cells'
import { instanceContactInstance } from '../grid/movement'
import { getRoundedIsoShapePoints } from '../graphics/selection'
import { closestPointOnSegment, distanceToPolygon, pointIsInsidePolygon } from '../geometry/polygon'
import { instancesDistance } from '../maths'
import { isHeroControlled } from '../units/unitControl'

const HERO_FOOD_CONTACT_EXTRA_RANGE = 1.5
const HERO_FOOTPRINT_INTERACTION_BASE_MARGIN = CELL_HEIGHT * 1.5
const HERO_FOOTPRINT_INTERACTION_MAX_MARGIN = CELL_HEIGHT * 2

type Point = { x: number; y: number }

function getHeroActionDistance(action: string | null | undefined, target: RuntimeEntity): number | null {
  if (!action) return null
  if (action !== ACTION_TYPES.takemeat) return null

  return getBuildingContactDistance(target.size ?? 1) + HERO_FOOD_CONTACT_EXTRA_RANGE
}

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
  if (isHeroNearTargetFootprint(unit, target)) return true
  const actionDistance = getHeroActionDistance(action, target)
  return actionDistance !== null && instancesDistance(unit, target) <= actionDistance
}

export function isHeroInteractionTargetReachable(
  unit: UnitEntity,
  action: string | null | undefined,
  target: RuntimeEntity | null | undefined
): boolean {
  if (!target || target === unit || target.isDestroyed) return false
  if (isHeroActionInRange(unit, action, target)) return true
  return instanceContactInstance(unit, target)
}
