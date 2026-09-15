import {
  ACTION_TYPES,
  FAMILY_TYPES,
  UNIT_TYPES,
  WORK_TYPES,
} from '../../constants'
import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { isBanditUnit } from '../../lib/combat/bandits'
import { isHeroControlled } from '../../lib/units/unitControl'
import { isVillagerSleepTime } from '../../lib/units/villagerSchedule'
import { sameMapSpace } from '../../lib/mapSpaces'
import type { GameContextLike } from '../../types/context'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import { restDistance, stableUnitSeed } from './UnitRestMath'
import {
  findRestCellAroundPoint,
  getCurrentOutsideRestSite,
  getNearestShelter,
  isUsableFireCampForRest,
  type UnitRestSite,
} from './UnitRestShelter'

export { getNearestShelter, getShelterEntryCell, isShelterUnsafe, isUsableShelter } from './UnitRestShelter'
export { canResumeVillagerReturnTaskBeforeRest } from './UnitRestTravel'
export type { UnitRestSite } from './UnitRestShelter'

export const REST_CHECK_INTERVAL_MS = 1000
export const REST_ORDER_GRACE_MS = 2500
export const REST_MAX_RETRIES = 3
const REST_WAKE_LOCK_MS = 12000
const DEFAULT_UNIT_SIGHT = 7
const BANDIT_HOME_SLEEP_RADIUS = 8
const GAME_HOUR_MS = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay

type UnitRestDelayOptions = {
  durationMs?: number
  requireRestCapable?: boolean
  requireSleepTime?: boolean
  target?: RuntimeEntity | null
}

function distance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return restDistance(a, b)
}

export function isSleepTime(context: GameContextLike): boolean {
  return isVillagerSleepTime(context)
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

function getNearestFireCampRestSite(unit: UnitEntity): UnitRestSite | null {
  let best: { site: UnitRestSite; score: number } | null = null
  for (const building of unit.owner?.buildings ?? []) {
    if (!isUsableFireCampForRest(unit, building)) continue
    const targetCell = findRestCellAroundPoint(unit, building, undefined, 2)
    if (!targetCell) continue
    const score = distance(unit, building)
    if (!best || score < best.score) best = { site: { location: 'outside', shelter: null, targetCell }, score }
  }
  return best?.site ?? null
}

export function getNearestRestSite(unit: UnitEntity): UnitRestSite | null {
  const shelter = getNearestShelter(unit)
  if (shelter) return { location: 'shelter', shelter: shelter.shelter, targetCell: shelter.targetCell }
  return getNearestFireCampRestSite(unit) ?? getCurrentOutsideRestSite(unit)
}
