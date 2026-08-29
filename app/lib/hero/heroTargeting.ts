import { CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES } from '../constants'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import { getCellsInCellRadius } from '../grid/cells'
import { findInstancesInSight } from '../grid/visibility'
import { getHeroInteractionTargetPoint } from './heroActionRange'
import { angleDelta } from '../maths'
import { getEntitySpaceGrid } from '../mapSpaces'

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

export function getHeroAimDelta(hero: UnitEntity, target: Point): number {
  return angleDelta(getHeroAimDegree(hero, target), hero.degree ?? 0)
}

export function isMountedAttackAimBlocked(hero: UnitEntity, point: Point): boolean {
  if (!hero.mountedOnHorse) return false
  return angleDelta(getHeroAimDegree(hero, point), hero.degree ?? 0) > MOUNTED_ATTACK_HALF_ANGLE
}

export function getDirectionalTarget<T extends RuntimeEntity>(
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

export function getDirectionalTargets<T extends RuntimeEntity>(
  hero: UnitEntity,
  candidates: T[],
  halfAngle = CLICK_DIRECTION_HALF_ANGLE
): T[] {
  return candidates
    .map(target => {
      const aimPoint = getHeroInteractionTargetPoint(hero, target)
      const targetHalfAngle = [FAMILY_TYPES.building, FAMILY_TYPES.resource].includes(target.family ?? '')
        ? LARGE_FOOTPRINT_DIRECTION_HALF_ANGLE
        : halfAngle
      return {
        target,
        angle: getHeroAimDelta(hero, aimPoint),
        dist: Math.hypot(aimPoint.x - hero.x, aimPoint.y - hero.y),
        halfAngle: targetHalfAngle,
      }
    })
    .filter(candidate => candidate.angle <= candidate.halfAngle)
    .map(candidate => ({
      ...candidate,
      score:
        candidate.dist + (candidate.angle / Math.max(candidate.halfAngle, 1)) * DIRECTIONAL_TARGET_MAX_ANGLE_PENALTY,
    }))
    .sort((a, b) => a.score - b.score || a.dist - b.dist || a.angle - b.angle)
    .map(candidate => candidate.target)
}
