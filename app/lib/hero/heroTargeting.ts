import { CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES } from '../constants'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import { getCellsInCellRadius } from '../grid/cells'
import { getInstanceScreenBounds } from '../grid/screenBounds'
import { findInstancesInSight } from '../grid/visibility'
import { getHeroInteractionTargetPoint } from './heroActionRange'
import { angleDelta } from '../maths'
import { distanceToPolygon } from '../geometry/polygon'
import { getContactTargetShape } from '../contact/contactGeometry'
import { getEntitySpaceGrid, sameMapSpace } from '../mapSpaces'

const CURSOR_TARGET_TOLERANCE = 6
const CLICK_DIRECTION_HALF_ANGLE = 25
export const CLICK_TARGET_SEARCH_RANGE = 15
const LARGE_FOOTPRINT_DIRECTION_HALF_ANGLE = 45
const DIRECTIONAL_TARGET_MAX_ANGLE_PENALTY = CELL_WIDTH
export const MOUNTED_ATTACK_HALF_ANGLE = 45
const HERO_AIM_Y_SCALE = CELL_HEIGHT / CELL_WIDTH

export function getHeroAimDegree(hero: Point, destination: Point): number {
  const dx = destination.x - hero.x
  const dy = (destination.y - hero.y) * HERO_AIM_Y_SCALE
  return Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 180)
}

function getHeroAimDelta(hero: UnitEntity, target: Point, aimPoint?: Point | null): number {
  if (Math.hypot(target.x - hero.x, target.y - hero.y) < 0.01) return 0
  const degree =
    aimPoint && Math.hypot(aimPoint.x - hero.x, aimPoint.y - hero.y) > 1
      ? getHeroAimDegree(hero, aimPoint)
      : (hero.degree ?? 0)
  return angleDelta(getHeroAimDegree(hero, target), degree)
}

export function isMountedAttackAimBlocked(hero: UnitEntity, point: Point): boolean {
  if (!hero.mountedOnHorse) return false
  return angleDelta(getHeroAimDegree(hero, point), hero.degree ?? 0) > MOUNTED_ATTACK_HALF_ANGLE
}

function getDirectionalTarget<T extends RuntimeEntity>(
  hero: UnitEntity,
  candidates: T[],
  halfAngle = CLICK_DIRECTION_HALF_ANGLE
): T | null {
  return getDirectionalTargets(hero, candidates, halfAngle)[0] ?? null
}

export function findFacingEntity(
  hero: UnitEntity,
  matches: (target: RuntimeEntity) => boolean,
  range = CLICK_TARGET_SEARCH_RANGE
): RuntimeEntity | null {
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(hero, matches, range)
  const seen = new Set<RuntimeEntity>(candidates)
  const grid = getEntitySpaceGrid(hero, hero.context?.map)
  if (grid) {
    const centerI = hero.i ?? 0
    const centerJ = hero.j ?? 0
    for (const cell of getCellsInCellRadius(centerI, centerJ, grid, range)) {
      for (const corpse of cell.corpses ?? []) {
        if (!seen.has(corpse) && matches(corpse)) {
          candidates.push(corpse)
          seen.add(corpse)
        }
      }
    }
  }
  return getDirectionalTarget(hero, candidates)
}

function cursorDistanceToTarget(target: RuntimeEntity, cursor: Point): number {
  const sprite = target.sprite
  // A roof or scaffold can be under the pointer even though its ground footprint is not.
  if (sprite && sprite.visible !== false) {
    const bounds = getInstanceScreenBounds(
      { x: target.x, y: target.y, sprite },
      { x: target.x + (sprite.x ?? 0), y: target.y + (sprite.y ?? 0) }
    )
    if (
      bounds &&
      cursor.x >= bounds.minX &&
      cursor.x <= bounds.minX + bounds.width &&
      cursor.y >= bounds.minY &&
      cursor.y <= bounds.minY + bounds.height
    )
      return 0
  }
  return distanceToPolygon(getContactTargetShape(target), cursor)
}

export function getDirectionalTargets<T extends RuntimeEntity>(
  hero: UnitEntity,
  candidates: T[],
  halfAngle = CLICK_DIRECTION_HALF_ANGLE,
  cursor: Point | null | undefined = hero.context?.controls?.getWorldPointUnderCursor?.()
): T[] {
  return candidates
    .filter(target => target !== hero && !target.isDestroyed && sameMapSpace(hero, target))
    .map(target => {
      const aimPoint = getHeroInteractionTargetPoint(hero, target)
      const targetHalfAngle = [FAMILY_TYPES.building, FAMILY_TYPES.resource].includes(target.family ?? '')
        ? LARGE_FOOTPRINT_DIRECTION_HALF_ANGLE
        : halfAngle
      return {
        target,
        angle: getHeroAimDelta(hero, aimPoint, cursor),
        cursorDistance: cursor ? cursorDistanceToTarget(target, cursor) : Infinity,
        dist: Math.hypot(aimPoint.x - hero.x, aimPoint.y - hero.y),
        halfAngle: targetHalfAngle,
      }
    })
    .filter(candidate => candidate.cursorDistance <= CURSOR_TARGET_TOLERANCE || candidate.angle <= candidate.halfAngle)
    .map(candidate => ({
      ...candidate,
      score:
        candidate.dist + (candidate.angle / Math.max(candidate.halfAngle, 1)) * DIRECTIONAL_TARGET_MAX_ANGLE_PENALTY,
    }))
    .sort(
      (a, b) =>
        Number(b.cursorDistance <= CURSOR_TARGET_TOLERANCE) - Number(a.cursorDistance <= CURSOR_TARGET_TOLERANCE) ||
        (a.cursorDistance <= CURSOR_TARGET_TOLERANCE && b.cursorDistance <= CURSOR_TARGET_TOLERANCE
          ? a.cursorDistance - b.cursorDistance
          : 0) ||
        a.score - b.score ||
        a.dist - b.dist ||
        a.angle - b.angle
    )
    .map(candidate => candidate.target)
}
