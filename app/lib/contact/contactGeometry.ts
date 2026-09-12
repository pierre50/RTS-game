import type { RuntimeEntity } from '../../types/entities'
import { CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES } from '../constants'
import { getRoundedIsoFootprintPoints } from '../graphics/isoFootprint'
import { getEntitySpaceGrid, sameMapSpace } from '../mapSpaces'
import { closestPointOnSegment, pointIsInsidePolygon, type PolygonPoint } from '../geometry/polygon'
import { getContactScale, resolveContactActionProfile, resolveContactBodyProfile } from './contactProfiles'
import type { ContactActor, ContactApproachSample, ContactOptions, ContactShape } from './contactTypes'

const BODY_CIRCLE = Array.from({ length: 16 }, (_, index) => {
  const angle = (index * Math.PI * 2) / 16
  return { x: Math.cos(angle), y: Math.sin(angle) }
})
const SWEEP_STEPS = 12
const GROUND_Y_SCALE = CELL_HEIGHT / CELL_WIDTH

export function getContactTargetShape(target: RuntimeEntity): ContactShape {
  if (target.family === FAMILY_TYPES.building || target.family === FAMILY_TYPES.resource) {
    return getRoundedIsoFootprintPoints(target, getEntitySpaceGrid(target, target.context?.map))
  }
  const body = resolveContactBodyProfile(target)
  const radius = body.radius * getContactScale(target)
  return BODY_CIRCLE.map(point => ({
    x: target.x + point.x * radius,
    y: target.y + point.y * radius * body.verticalScale,
  }))
}

export function getContactActionShape(actor: ContactActor, tool?: string, degree = actor.degree ?? 0): ContactShape {
  const profile = resolveContactActionProfile(actor, tool)
  const scale = getContactScale(actor)
  const reach = (profile.reach + profile.width / 2) * scale
  const innerRadius = Math.max(0, profile.handOffset - profile.width / 2) * scale
  const aim = ((degree - 180) * Math.PI) / 180
  // Invert the shared aim projection to build a sweep in the isometric ground plane.
  const heading = Math.atan2(Math.sin(aim) / GROUND_Y_SCALE ** 2, Math.cos(aim))
  const outer: PolygonPoint[] = []
  const inner: PolygonPoint[] = []
  for (let step = 0; step <= SWEEP_STEPS; step++) {
    const angle = heading + ((-profile.halfAngle + (2 * profile.halfAngle * step) / SWEEP_STEPS) * Math.PI) / 180
    const dx = Math.cos(angle)
    const dy = Math.sin(angle) * GROUND_Y_SCALE
    outer.push({ x: actor.x + dx * reach, y: actor.y + dy * reach })
    inner.push({ x: actor.x + dx * innerRadius, y: actor.y + dy * innerRadius })
  }
  return outer.concat(inner.reverse())
}
function cross(a: PolygonPoint, b: PolygonPoint, c: PolygonPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function segmentsIntersect(a: PolygonPoint, b: PolygonPoint, c: PolygonPoint, d: PolygonPoint): boolean {
  if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x)) return false
  if (Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) return false
  return cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0
}

function contactShapesIntersect(a: ContactShape, b: ContactShape): boolean {
  const firstA = a[0]
  const firstB = b[0]
  if (!firstA || !firstB) return false
  if (pointIsInsidePolygon(a, firstB) || pointIsInsidePolygon(b, firstA)) return true
  return a.some((point, index) =>
    b.some((other, otherIndex) =>
      segmentsIntersect(point, a[(index + 1) % a.length] ?? point, other, b[(otherIndex + 1) % b.length] ?? other)
    )
  )
}

function isEligibleContact(actor: ContactActor, target: RuntimeEntity, options: ContactOptions): boolean {
  return (
    sameMapSpace(actor, target) &&
    !actor.isDead &&
    !actor.isDestroyed &&
    !target.isDestroyed &&
    (options.allowDeadTarget === true || !target.isDead)
  )
}

// One short-lived strike per impact: share its action polygon across candidate targets.
export function createContactStrike(actor: ContactActor, tool?: string, options: ContactOptions = {}) {
  const shape = getContactActionShape(actor, tool, options.degree)
  return {
    shape,
    touches(target: RuntimeEntity): boolean {
      return isEligibleContact(actor, target, options) && contactShapesIntersect(shape, getContactTargetShape(target))
    },
  }
}

export function isContactTouching(
  actor: ContactActor,
  target: RuntimeEntity,
  tool?: string,
  options: ContactOptions = {}
): boolean {
  if (!isEligibleContact(actor, target, options)) return false
  return createContactStrike(actor, tool, options).touches(target)
}

function closestContactPoint(actor: ContactActor, target: RuntimeEntity, shape: ContactShape): PolygonPoint {
  if (pointIsInsidePolygon(shape, actor)) return target
  let closest: PolygonPoint = target
  let minimum = Infinity
  for (let index = 0; index < shape.length; index++) {
    const start = shape[index]
    const end = shape[(index + 1) % shape.length]
    if (!start || !end) continue
    const point = closestPointOnSegment(actor, start, end)
    const distanceSquared = (point.x - actor.x) ** 2 + (point.y - actor.y) ** 2
    if (distanceSquared < minimum) {
      closest = point
      minimum = distanceSquared
    }
  }
  return closest
}

function aimAtPoint(actor: ContactActor, point: PolygonPoint): number {
  return Math.round((Math.atan2((point.y - actor.y) * GROUND_Y_SCALE, point.x - actor.x) * 180) / Math.PI + 180)
}

export function getContactAimDegree(actor: ContactActor, target: RuntimeEntity): number {
  return aimAtPoint(actor, closestContactPoint(actor, target, getContactTargetShape(target)))
}

// A sample belongs to one position; rebuild after movement, never cache world-space shapes globally.
export function sampleContactApproach(
  actor: ContactActor,
  target: RuntimeEntity,
  tool?: string,
  options: ContactOptions = {}
): ContactApproachSample {
  const targetShape = getContactTargetShape(target)
  const point = closestContactPoint(actor, target, targetShape)
  const degree = aimAtPoint(actor, point)
  return {
    point,
    degree,
    distance: Math.hypot(point.x - actor.x, point.y - actor.y),
    reachable:
      isEligibleContact(actor, target, options) &&
      contactShapesIntersect(getContactActionShape(actor, tool, degree), targetShape),
  }
}

export function canReachContact(
  actor: ContactActor,
  target: RuntimeEntity,
  tool?: string,
  options: ContactOptions = {}
): boolean {
  if (!isEligibleContact(actor, target, options)) return false
  return sampleContactApproach(actor, target, tool, options).reachable
}
