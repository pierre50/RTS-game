import { ACTION_TYPES, CELL_HEIGHT, FAMILY_TYPES } from '../constants'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import { getBuildingContactDistance } from './grid/cells'
import { instanceContactInstance } from './grid/movement'
import { getRoundedIsoShapePoints } from './graphics/selection'
import { instancesDistance } from './maths'
import { isHeroControlled } from './unitControl'

const HERO_FOOD_CONTACT_EXTRA_RANGE = 1.5
const HERO_FOOTPRINT_INTERACTION_BASE_MARGIN = CELL_HEIGHT * 1.5
const HERO_FOOTPRINT_INTERACTION_MAX_MARGIN = CELL_HEIGHT * 2

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

function closestPointOnSegment(point: Point, a: Point, b: Point): Point {
  const segmentX = b.x - a.x
  const segmentY = b.y - a.y
  const segmentLengthSq = segmentX * segmentX + segmentY * segmentY
  if (segmentLengthSq <= 0) return a
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * segmentX + (point.y - a.y) * segmentY) / segmentLengthSq))
  return {
    x: a.x + segmentX * t,
    y: a.y + segmentY * t,
  }
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
