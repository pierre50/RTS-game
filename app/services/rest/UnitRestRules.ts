import {
  ACTION_TYPES,
  BUILDING_TYPES,
  CELL_HEIGHT,
  CELL_WIDTH,
  FAMILY_TYPES,
  STEP_TIME,
  UNIT_TYPES,
  WORK_TYPES,
} from '../../constants'
import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { getBuildingShelterCapacity, hasBuildingShelterCapacity } from '../../lib/buildings/buildingOccupancy'
import { getBuildingInteriorEntryCell, isBuildingInteriorSupported } from '../../lib/buildings/interiors'
import { isBanditUnit } from '../../lib/combat/bandits'
import {
  canUnitUseCellAsIdleDestination,
  canUseReservedPassageCellForTransit,
  createReservedPassageCellLookup,
} from '../../lib/buildings/passageCells'
import { getCellsAroundPoint } from '../../lib/grid/cells'
import { getInstanceClosestFreeCellPath, getInstancePath } from '../../lib/grid/movement'
import { isHeroControlled } from '../../lib/units/unitControl'
import {
  getMinutesUntilVillagerBed,
  getMinutesUntilVillagerWorkEnds,
  isVillagerSleepTime,
  shouldVillagerBeAsleep,
  shouldVillagerWork,
} from '../../lib/units/villagerSchedule'
import { getEntityCell, getEntitySpaceGrid, sameMapSpace } from '../../lib/mapSpaces'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity, UnitResourceDeliveryReturnTask } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

export const REST_CHECK_INTERVAL_MS = 1000
const CRITICAL_SHELTER_HITPOINT_RATIO = 0.25
export const REST_ORDER_GRACE_MS = 2500
export const REST_MAX_RETRIES = 3
const REST_WAKE_LOCK_MS = 12000
const REST_OUTSIDE_SEARCH_RADIUS = 4
const DEFAULT_UNIT_SIGHT = 7
const BANDIT_HOME_SLEEP_RADIUS = 8
const GAME_HOUR_MS = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay
const GAME_MINUTE_MS = GAME_HOUR_MS / 60
const AVERAGE_PATH_CELL_DISTANCE_PX = Math.hypot(CELL_WIDTH / 2, CELL_HEIGHT / 2)
const REST_TRAVEL_BUFFER_RATIO = 1.15
const MIN_RETURN_TASK_WORK_MINUTES = 30

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

function stableUnitSeed(unit: UnitEntity): number {
  const value = unit.label ?? `${unit.type}:${unit.i}:${unit.j}`
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
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
      isBuildingInteriorSupported(building) &&
      getBuildingShelterCapacity(building) > 0 &&
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
  return null
}

function getShelterScore(unit: UnitEntity, building: BuildingEntity): number {
  return distance(unit, building)
}

export function estimateTravelMsToCell(unit: UnitEntity, targetCell: RuntimeCell): number | null {
  const map = unit.context?.map
  if (!map) return null
  if (unit.i === targetCell.i && unit.j === targetCell.j) return 0
  const path = getInstancePath(unit, targetCell.i, targetCell.j, map)
  if (!path.length) return null
  return estimatePathTravelMs(unit, path.length)
}

function estimatePathTravelMs(unit: UnitEntity, pathLength: number): number | null {
  const speed = getUnitSpeed(unit)
  if (speed <= 0) return null
  return ((pathLength * AVERAGE_PATH_CELL_DISTANCE_PX) / speed) * STEP_TIME * REST_TRAVEL_BUFFER_RATIO
}

function estimateTravelMsToEntity(
  unit: UnitEntity,
  target: RuntimeEntity,
  action: string | null | undefined
): number | null {
  const map = unit.context?.map
  if (!map || !sameMapSpace(unit, target)) return null
  if (unit.isUnitAtDest?.(action, target)) return 0
  const passageLookup = createReservedPassageCellLookup(unit.context)
  const path = getInstanceClosestFreeCellPath<RuntimeCell>(unit, target, map, {
    isCellAllowed: cell => canUnitUseCellAsIdleDestination(unit, cell, { passageLookup }),
    pathfinding: {
      canPassThroughSolidCell: cell => canUseReservedPassageCellForTransit(cell, passageLookup),
    },
  })
  if (path.length) return estimatePathTravelMs(unit, path.length)
  const targetCell = getEntityCell(target, map)
  return targetCell ? estimateTravelMsToCell(unit, targetCell) : null
}

function getUnitSpeed(unit: UnitEntity): number {
  const configuredSpeed = unit.owner?.config?.units?.[unit.type]?.speed
  return typeof unit.speed === 'number' ? unit.speed : typeof configuredSpeed === 'number' ? configuredSpeed : 1
}

function estimateTravelMsToReturnTask(unit: UnitEntity, task: UnitResourceDeliveryReturnTask): number | null {
  const dest = task.dest
  if (!dest) return null
  if ('has' in dest) return estimateTravelMsToCell(unit, dest)
  return estimateTravelMsToEntity(unit, dest, task.action)
}

export function canResumeVillagerReturnTaskBeforeRest(
  unit: UnitEntity,
  task: UnitResourceDeliveryReturnTask | null | undefined
): boolean {
  if (!isVillager(unit)) return true
  if (!shouldVillagerWork(unit)) return false
  if (!task?.dest) return true

  const travelMs = estimateTravelMsToReturnTask(unit, task)
  if (travelMs == null) return false
  const remainingWorkMs = getMinutesUntilVillagerWorkEnds(unit) * GAME_MINUTE_MS
  const usefulWorkMs = MIN_RETURN_TASK_WORK_MINUTES * GAME_MINUTE_MS
  return travelMs + usefulWorkMs <= remainingWorkMs
}

function canReachShelterBeforeBed(unit: UnitEntity, targetCell: RuntimeCell): boolean {
  if (!isVillager(unit)) return true
  if (shouldVillagerBeAsleep(unit)) return true
  const travelMs = estimateTravelMsToCell(unit, targetCell)
  if (travelMs == null) return false
  return travelMs <= getMinutesUntilVillagerBed(unit) * GAME_MINUTE_MS
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
    if (!canReachShelterBeforeBed(unit, targetCell)) continue
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

function getBanditHomeAnchor(unit: UnitEntity): Pick<RuntimeEntity, 'i' | 'j'> | null {
  return unit.campPatrolAnchor ?? unit.banditCampAnchor ?? null
}

function isBanditAtHome(unit: UnitEntity): boolean {
  if (!isBanditUnit(unit)) return true
  const anchor = getBanditHomeAnchor(unit)
  if (!anchor) return false
  return distance(unit, anchor) <= BANDIT_HOME_SLEEP_RADIUS
}

function isExternalOffensiveUnit(unit: UnitEntity): boolean {
  if (isBanditUnit(unit) && isBanditAtHome(unit)) return false
  return Boolean(
    unit.work === WORK_TYPES.attacker &&
      (unit.dest || unit.action === ACTION_TYPES.attack || unit.combatMode === 'attack' || unit.path?.length)
  )
}

function getPlayedPlayer(unit: UnitEntity): UnitEntity['owner'] | null {
  return unit.context?.player ?? unit.context?.players?.find(player => player.isPlayed) ?? unit.owner ?? null
}

function isHostileRestBlocker(unit: UnitEntity, candidate: RuntimeEntity): boolean {
  if (candidate === unit || candidate.isDead || candidate.isDestroyed) return false
  if (candidate.family !== FAMILY_TYPES.unit && candidate.family !== FAMILY_TYPES.building) return false
  if (!sameMapSpace(unit, candidate)) return false
  const player = getPlayedPlayer(unit)
  if (!player?.isEnemy?.(candidate.owner)) return false
  if (player.views && !player.views.isVisible(candidate.i, candidate.j)) return false
  return distance(unit, candidate) <= (unit.sight ?? DEFAULT_UNIT_SIGHT)
}

function hasVisiblePlayerEnemyNearby(unit: UnitEntity): boolean {
  for (const player of unit.context?.players ?? []) {
    for (const candidate of [...(player.units ?? []), ...(player.buildings ?? [])]) {
      if (isHostileRestBlocker(unit, candidate)) return true
    }
  }
  return false
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

export function canStartSleepRest(unit: UnitEntity): boolean {
  return Boolean(
    canUseUnitRest(unit) &&
      !isActiveDefense(unit) &&
      !isExternalOffensiveUnit(unit) &&
      isBanditAtHome(unit) &&
      !hasVisiblePlayerEnemyNearby(unit)
  )
}

export function shouldRest(unit: UnitEntity, options: { ignoreWakeLock?: boolean } = {}): boolean {
  return Boolean(
    canStartSleepRest(unit) &&
      (options.ignoreWakeLock || !isUnitRestWakeLocked(unit))
  )
}

export function canSleepWithoutRestSite(unit: UnitEntity): boolean {
  return !isBanditUnit(unit) || isBanditAtHome(unit)
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

export function getRestTransitionDurationMs(unit: UnitEntity, phase: 'windingDown' | 'wakingUp'): number {
  const seed = stableUnitSeed(unit)
  const base = phase === 'windingDown' ? GAME_HOUR_MS * 1.25 : GAME_HOUR_MS * 0.25
  const spread = phase === 'windingDown' ? GAME_HOUR_MS * 1.5 : GAME_HOUR_MS * 0.45
  return base + (seed % spread)
}

export function getRestTransitionCell(unit: UnitEntity, restSite?: UnitRestSite | null): RuntimeCell | null {
  const anchor = restSite?.shelter ?? restSite?.targetCell ?? unit
  return findRestCellAroundPoint(unit, anchor, restSite?.location === 'shelter' ? 3 : 2)
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
  const anchor = getBanditHomeAnchor(unit)
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
  if (isBanditUnit(unit)) return isBanditAtHome(unit) ? getCampAnchorRestSite(unit) : null
  const fireCamp = getNearestFireCampRestSite(unit)
  const shelter = getNearestShelter(unit)
  if (isVillager(unit) && shelter) {
    return { location: 'shelter', shelter: shelter.shelter, targetCell: shelter.targetCell }
  }
  if (fireCamp) return fireCamp
  if (shelter) return { location: 'shelter', shelter: shelter.shelter, targetCell: shelter.targetCell }
  return getCampAnchorRestSite(unit) ?? getCurrentOutsideRestSite(unit)
}
