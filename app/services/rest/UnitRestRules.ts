import { ACTION_TYPES, BUILDING_TYPES, UNIT_TYPES } from '../../constants'
import { getFreeLandCellAroundInstance } from '../../lib'
import { hasBuildingShelterCapacity } from '../../lib/buildings/buildingOccupancy'
import { getBuildingInteriorEntryCell, isBuildingInteriorSupported } from '../../lib/buildings/interiors'
import {
  canUnitUseCellAsIdleDestination,
  createNonReservedPassageCellCondition,
  createReservedPassageCellLookup,
} from '../../lib/buildings/passageCells'
import { getCellsAroundPoint } from '../../lib/grid/cells'
import { isHeroControlled } from '../../lib/units/unitControl'
import { isVillagerSleepTime } from '../../lib/units/villagerSchedule'
import { getEntityCell, getEntitySpaceGrid, sameMapSpace } from '../../lib/mapSpaces'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

export const REST_CHECK_INTERVAL_MS = 1000
const CRITICAL_SHELTER_HITPOINT_RATIO = 0.25
export const REST_ORDER_GRACE_MS = 2500
export const REST_MAX_RETRIES = 3
const REST_WAKE_LOCK_MS = 12000
const REST_OUTSIDE_SEARCH_RADIUS = 4
const DEFAULT_UNIT_SIGHT = 7

const SHELTER_TYPES = new Set<string>(
  [BUILDING_TYPES.house, BUILDING_TYPES.townCenter].filter((type): type is string => typeof type === 'string')
)

export type UnitRestSite = {
  location: 'shelter' | 'outside'
  shelter: BuildingEntity | null
  targetCell: RuntimeCell
}

type UnitRestDelayOptions = {
  durationMs?: number
  requireRestCapable?: boolean
  requireSleepTime?: boolean
  target?: RuntimeEntity | null
}

function distance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j)
}

function hitPointRatio(entity: Pick<RuntimeEntity, 'hitPoints' | 'totalHitPoints'>): number {
  const total = entity.totalHitPoints ?? 0
  if (total <= 0) return 1
  return Math.max(0, Math.min(1, (entity.hitPoints ?? total) / total))
}

export function isSleepTime(context: GameContextLike): boolean {
  return isVillagerSleepTime(context)
}

export function isUsableShelter(
  building: BuildingEntity | null | undefined,
  owner: UnitEntity['owner']
): building is BuildingEntity {
  return Boolean(
    building &&
      building.owner === owner &&
      SHELTER_TYPES.has(building.type) &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed
  )
}

export function isShelterUnsafe(building: BuildingEntity | null | undefined): boolean {
  return Boolean(
    !building ||
      !isUsableShelter(building, building.owner) ||
      hitPointRatio(building) <= CRITICAL_SHELTER_HITPOINT_RATIO
  )
}

export function getShelterEntryCell(unit: UnitEntity, shelter: BuildingEntity): RuntimeCell | null {
  const map = unit.context?.map
  if (!map) return null
  if (!sameMapSpace(unit, shelter)) return null
  const grid = getEntitySpaceGrid(shelter, map) ?? map.grid
  if (isBuildingInteriorSupported(shelter)) {
    const entryCell = getBuildingInteriorEntryCell(shelter, grid)
    if (entryCell && !entryCell.terrainHidden && entryCell.category !== 'Water' && !entryCell.border) return entryCell
  }
  return getFreeLandCellAroundInstance(
    shelter,
    grid,
    (items: RuntimeCell[]) => {
      let best: RuntimeCell | null = null
      let bestDistance = Infinity
      for (const cell of items) {
        const dist = Math.abs(cell.i - unit.i) + Math.abs(cell.j - unit.j)
        if (dist < bestDistance) {
          best = cell
          bestDistance = dist
        }
      }
      return best ?? items[0]
    },
    createNonReservedPassageCellCondition(unit.context)
  )
}

function getShelterScore(unit: UnitEntity, building: BuildingEntity): number {
  return distance(unit, building)
}

function isVisibleToUnit(unit: UnitEntity, entity: Pick<RuntimeEntity, 'i' | 'j'> & { visible?: boolean }): boolean {
  const map = unit.context?.map
  if (map?.revealEverything || entity.visible) return true
  if (!unit.owner?.views) return true
  return unit.owner.views.isVisible(entity.i, entity.j)
}

function isShelterVisibleToUnit(unit: UnitEntity, building: BuildingEntity): boolean {
  if (!sameMapSpace(unit, building)) return false
  return isVisibleToUnit(unit, building)
}

export function getNearestShelter(unit: UnitEntity): { shelter: BuildingEntity; targetCell: RuntimeCell } | null {
  let best: { shelter: BuildingEntity; targetCell: RuntimeCell; score: number } | null = null
  for (const building of unit.owner?.buildings ?? []) {
    if (!isUsableShelter(building, unit.owner)) continue
    if (!isShelterVisibleToUnit(unit, building)) continue
    if (hitPointRatio(building) <= CRITICAL_SHELTER_HITPOINT_RATIO) continue
    if (!hasBuildingShelterCapacity(building, unit.owner?.units ?? [], { exclude: unit })) continue
    const targetCell = getShelterEntryCell(unit, building)
    if (!targetCell) continue
    const score = getShelterScore(unit, building)
    if (!best || score < best.score) best = { shelter: building, targetCell, score }
  }
  return best
}

function isVillager(unit: UnitEntity): boolean {
  return unit.type === UNIT_TYPES.villager
}

function isHeroUnit(unit: UnitEntity): boolean {
  return Boolean(unit.type === UNIT_TYPES.hero || unit.controlMode === 'hero' || isHeroControlled(unit))
}

function isActiveDefense(unit: UnitEntity): boolean {
  const attackAction = ACTION_TYPES?.attack ?? 'attack'
  return Boolean(
    unit.action === attackAction ||
      unit.combatMode === 'attack' ||
      unit.combatMode === 'recover' ||
      unit.combatMode === 'flee' ||
      unit.waitingForEnergyAction
  )
}

function getNowMs(unit: UnitEntity): number {
  return unit.context?.scheduler?.elapsedMs ?? 0
}

export function markUnitRestAlert(
  unit: UnitEntity,
  target?: RuntimeEntity | null,
  durationMs = REST_WAKE_LOCK_MS
): void {
  keepUnitAwakeForRestDelay(unit, { durationMs, target })
}

export function clearExpiredUnitRestAlert(unit: UnitEntity): void {
  const until = unit.restWakeLockUntilMs
  if (until == null || until > getNowMs(unit)) return
  unit.restWakeLockUntilMs = null
  unit.restAlertTargetLabel = null
}

export function isUnitRestWakeLocked(unit: UnitEntity): boolean {
  clearExpiredUnitRestAlert(unit)
  return Boolean(unit.restWakeLockUntilMs != null && unit.restWakeLockUntilMs > getNowMs(unit))
}

export function canUseUnitRest(unit: UnitEntity): boolean {
  return Boolean(
    !unit.isDead &&
      !unit.isDestroyed &&
      !isHeroUnit(unit) &&
      !unit.followingHero &&
      !unit.trainingTargetType
  )
}

function keepUnitAwakeForRestDelay(unit: UnitEntity, options: UnitRestDelayOptions = {}): boolean {
  const {
    durationMs = REST_WAKE_LOCK_MS,
    requireRestCapable = false,
    requireSleepTime = false,
    target = null,
  } = options
  if (!unit.context) return false
  if (requireSleepTime && !isSleepTime(unit.context)) return false
  if (requireRestCapable && !canUseUnitRest(unit)) return false
  const until = getNowMs(unit) + durationMs
  unit.restWakeLockUntilMs = Math.max(unit.restWakeLockUntilMs ?? 0, until)
  unit.restAlertTargetLabel = target?.label ?? null
  return true
}

export function delayUnitRestAfterActivity(unit: UnitEntity, durationMs = REST_WAKE_LOCK_MS): boolean {
  return keepUnitAwakeForRestDelay(unit, {
    durationMs,
    requireRestCapable: true,
    requireSleepTime: true,
  })
}

export function shouldRest(unit: UnitEntity, options: { ignoreWakeLock?: boolean } = {}): boolean {
  return Boolean(
    canUseUnitRest(unit) &&
      !isActiveDefense(unit) &&
      (options.ignoreWakeLock || !isUnitRestWakeLocked(unit))
  )
}

function findRestCellAroundPoint(
  unit: UnitEntity,
  anchor: Pick<RuntimeEntity, 'i' | 'j'>,
  maxRadius = REST_OUTSIDE_SEARCH_RADIUS
): RuntimeCell | null {
  const map = unit.context?.map
  if (!map) return null
  const grid = getEntitySpaceGrid(unit, map)
  if (!grid) return null

  let best: { cell: RuntimeCell; score: number } | null = null
  const passageLookup = createReservedPassageCellLookup(unit.context)
  for (let radius = 0; radius <= maxRadius; radius++) {
    const cells = getCellsAroundPoint(
      anchor.i,
      anchor.j,
      grid,
      radius,
      cell => canUnitUseCellAsIdleDestination(unit, cell, { passageLookup })
    )
    for (const cell of cells) {
      const score = distance(unit, cell) + distance(anchor, cell) * 0.35
      if (!best || score < best.score) best = { cell, score }
    }
    if (best && radius > 0) break
  }

  return best?.cell ?? null
}

function isVisibleFireCampInSight(unit: UnitEntity, building: BuildingEntity): boolean {
  if (!BUILDING_TYPES.fireCamp || building.type !== BUILDING_TYPES.fireCamp) return false
  if (building.isBuilt === false || building.isDead || building.isDestroyed) return false
  if (!sameMapSpace(unit, building)) return false
  if (!isVisibleToUnit(unit, building)) return false
  return distance(unit, building) <= (unit.sight ?? DEFAULT_UNIT_SIGHT)
}

function getNearestFireCampRestSite(unit: UnitEntity): UnitRestSite | null {
  let best: { site: UnitRestSite; score: number } | null = null
  for (const building of unit.owner?.buildings ?? []) {
    if (!isVisibleFireCampInSight(unit, building)) continue
    const targetCell = findRestCellAroundPoint(unit, building)
    if (!targetCell) continue
    const score = distance(unit, building)
    if (!best || score < best.score) best = { site: { location: 'outside', shelter: null, targetCell }, score }
  }
  return best?.site ?? null
}

function getCampAnchorRestSite(unit: UnitEntity): UnitRestSite | null {
  const anchor = unit.campPatrolAnchor ?? unit.banditCampAnchor
  if (!anchor) return null
  const targetCell = findRestCellAroundPoint(unit, anchor)
  return targetCell ? { location: 'outside', shelter: null, targetCell } : null
}

function getCurrentOutsideRestSite(unit: UnitEntity): UnitRestSite | null {
  const currentCell = getEntityCell(unit, unit.context?.map)
  const passageLookup = createReservedPassageCellLookup(unit.context)
  if (canUnitUseCellAsIdleDestination(unit, currentCell, { passageLookup })) {
    return { location: 'outside', shelter: null, targetCell: currentCell }
  }
  const targetCell = findRestCellAroundPoint(unit, unit, 2)
  return targetCell ? { location: 'outside', shelter: null, targetCell } : null
}

export function getNearestRestSite(unit: UnitEntity): UnitRestSite | null {
  const fireCamp = getNearestFireCampRestSite(unit)
  const shelter = getNearestShelter(unit)
  if (isVillager(unit) && shelter) {
    return { location: 'shelter', shelter: shelter.shelter, targetCell: shelter.targetCell }
  }
  if (fireCamp) return fireCamp
  if (shelter) return { location: 'shelter', shelter: shelter.shelter, targetCell: shelter.targetCell }
  return getCampAnchorRestSite(unit) ?? getCurrentOutsideRestSite(unit)
}
