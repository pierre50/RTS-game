import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import { sameBuilding } from './identity'
import { isBuildingInteriorSupported, getBuildingInteriorPortalId } from './interiors'

export const ENEMY_BUILDING_INTERIOR_ENTRY_HEALTH_RATIO = 0.2
const BUILDING_ASSAULT_OUTSIDE_ENEMY_RADIUS = 8

function isEnemyOwner(source: PlayerLike | null | undefined, target: PlayerLike | null | undefined): boolean {
  if (!source || !target) return false
  return Boolean(source.isEnemy?.(target) || target.isEnemy?.(source))
}

export function getBuildingHealthRatio(building: Pick<BuildingEntity, 'hitPoints' | 'totalHitPoints'>): number {
  const totalHitPoints = Number(building.totalHitPoints)
  if (!Number.isFinite(totalHitPoints) || totalHitPoints <= 0) return 1
  const hitPoints = Number(building.hitPoints)
  if (!Number.isFinite(hitPoints)) return 1
  return Math.max(0, Math.min(1, hitPoints / totalHitPoints))
}

export function isEnemyBuildingInteriorDefended(
  hero: UnitEntity | null | undefined,
  building: BuildingEntity | null | undefined
): boolean {
  if (!hero?.owner || !building?.owner) return false
  if (!isEnemyOwner(hero.owner, building.owner)) return false
  return getBuildingHealthRatio(building) > ENEMY_BUILDING_INTERIOR_ENTRY_HEALTH_RATIO
}

export function canUnitEnterBuildingInterior(
  unit: UnitEntity | null | undefined,
  building: BuildingEntity | null | undefined
): boolean {
  return !isEnemyBuildingInteriorDefended(unit, building)
}

function isHostileUnit(source: UnitEntity | null | undefined, unit: UnitEntity | null | undefined): boolean {
  if (!source?.owner || !unit?.owner) return false
  if (unit === source || unit.isDead || unit.isDestroyed || (unit.hitPoints ?? 1) <= 0) return false
  return isEnemyOwner(source.owner, unit.owner)
}

function isUnitShelteredInsideBuilding(unit: UnitEntity, building: BuildingEntity): boolean {
  const state = unit.shelterState
  return Boolean(state?.location === 'shelter' && state.status === 'inside' && sameBuilding(state.shelter, building))
}

function isUnitInBuildingInteriorSpace(unit: UnitEntity, building: BuildingEntity): boolean {
  if (!unit.spaceId) return false
  return unit.spaceId === `interior:${getBuildingInteriorPortalId(building)}`
}

export function hasEnemyInsideBuildingInterior(
  source: UnitEntity | null | undefined,
  building: BuildingEntity | null | undefined
): boolean {
  if (!source || !building) return false
  const players = source.context?.players?.length
    ? source.context.players
    : building.owner
      ? [building.owner]
      : []
  for (const player of players) {
    for (const unit of player.units ?? []) {
      if (!isHostileUnit(source, unit)) continue
      if (isUnitShelteredInsideBuilding(unit, building) || isUnitInBuildingInteriorSpace(unit, building)) return true
    }
  }
  return false
}

export function hasOutsideEnemyNearBuildingAssault(
  source: UnitEntity | null | undefined,
  building: BuildingEntity | null | undefined,
  radius = BUILDING_ASSAULT_OUTSIDE_ENEMY_RADIUS
): boolean {
  if (!source || !building) return false
  const players = source.context?.players?.length ? source.context.players : []
  for (const player of players) {
    for (const unit of player.units ?? []) {
      if (!isHostileUnit(source, unit)) continue
      if (isUnitShelteredInsideBuilding(unit, building) || isUnitInBuildingInteriorSpace(unit, building)) continue
      if (unit.spaceId && source.spaceId && unit.spaceId !== source.spaceId) continue
      const distance = Math.abs((unit.i ?? 0) - source.i) + Math.abs((unit.j ?? 0) - source.j)
      if (distance <= radius) return true
    }
  }
  return false
}

export function shouldAttackBuildingForInteriorAccess(
  source: UnitEntity | null | undefined,
  building: BuildingEntity | null | undefined
): boolean {
  if (!source || !building || building.isDead || building.isDestroyed || (building.hitPoints ?? 0) <= 0) return false
  if (!isBuildingInteriorSupported(building)) return false
  if (!isEnemyBuildingInteriorDefended(source, building)) return false
  if (!hasEnemyInsideBuildingInterior(source, building)) return false
  return !hasOutsideEnemyNearBuildingAssault(source, building)
}

export function canUnitEnterBuildingInteriorForAssault(
  source: UnitEntity | null | undefined,
  building: BuildingEntity | null | undefined
): boolean {
  if (!source || !building || building.isDead || building.isDestroyed || (building.hitPoints ?? 0) <= 0) return false
  if (!isBuildingInteriorSupported(building)) return false
  if (isEnemyBuildingInteriorDefended(source, building)) return false
  if (!hasEnemyInsideBuildingInterior(source, building)) return false
  return !hasOutsideEnemyNearBuildingAssault(source, building)
}

export function getBuildingInteriorAssaultMinimumHitPoints(
  source: UnitEntity | null | undefined,
  building: BuildingEntity | null | undefined
): number | null {
  if (!building) return null
  if (!shouldAttackBuildingForInteriorAccess(source, building)) return null
  const totalHitPoints = Number(building.totalHitPoints)
  if (!Number.isFinite(totalHitPoints) || totalHitPoints <= 0) return null
  return totalHitPoints * ENEMY_BUILDING_INTERIOR_ENTRY_HEALTH_RATIO
}
