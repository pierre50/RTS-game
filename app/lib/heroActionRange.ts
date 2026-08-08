import { ACTION_TYPES, CELL_HEIGHT, FAMILY_TYPES } from '../constants'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import { getBuildingContactDistance } from './grid/cells'
import { instanceContactInstance } from './grid/movement'
import { getRoundedIsoShapePoints } from './graphics/selection'
import { instancesDistance } from './maths'
import { isHeroControlled } from './unitControl'

const HERO_FOOD_CONTACT_EXTRA_RANGE = 1.5
const HERO_FOOTPRINT_INTERACTION_MARGIN = CELL_HEIGHT

type Point = { x: number; y: number }

export function isHeroControlledUnit(unit: UnitEntity): boolean {
  return isHeroControlled(unit)
}

export function getHeroActionDistance(action: string | null | undefined, target: RuntimeEntity): number | null {
  if (!action) return null
  if (action !== ACTION_TYPES.takemeat) return null

  return getBuildingContactDistance(target.size ?? 1) + HERO_FOOD_CONTACT_EXTRA_RANGE
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const segmentX = b.x - a.x
  const segmentY = b.y - a.y
  const segmentLengthSq = segmentX * segmentX + segmentY * segmentY
  if (segmentLengthSq <= 0) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * segmentX + (point.y - a.y) * segmentY) / segmentLengthSq))
  return Math.hypot(point.x - (a.x + segmentX * t), point.y - (a.y + segmentY * t))
}

function pointIsInsidePolygon(points: Point[], point: Point): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]
    const b = points[j]
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x)
    const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)
    const lenSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    if (Math.abs(cross) < 0.001 && dot >= 0 && dot <= lenSq) return true
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

function distanceToPolygon(points: Point[], point: Point): number {
  if (!points.length) return Infinity
  if (pointIsInsidePolygon(points, point)) return 0
  let closest = Infinity
  for (let index = 0; index < points.length; index++) {
    closest = Math.min(closest, distanceToSegment(point, points[index], points[(index + 1) % points.length]))
  }
  return closest
}

function isHeroNearTargetFootprint(unit: UnitEntity, target: RuntimeEntity): boolean {
  if (![FAMILY_TYPES.building, FAMILY_TYPES.resource].includes(target.family ?? '')) return false
  const points = getRoundedIsoShapePoints({ x: target.x, y: target.y, factor: Math.max(1, target.size ?? 1) })
  return distanceToPolygon(points, unit) <= HERO_FOOTPRINT_INTERACTION_MARGIN
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
