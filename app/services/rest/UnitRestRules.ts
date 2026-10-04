import { sameMapSpace } from '../../lib/mapSpaces'
import { UNIT_TYPES } from '../../constants'
import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { canChiefEscortRest } from '../../lib/units/chiefEscort'
import { isBanditUnit } from '../../lib/combat/bandits'
import { isHeroControlled } from '../../lib/units/unitControl'
import { isVillagerSleepTime } from '../../lib/units/village/villagerSchedule'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import { stableUnitSeed } from './UnitRestMath'
import {
  hasVisiblePlayerEnemyNearby,
  isActiveDefense,
  isBanditAtHome,
  isExternalOffensiveUnit,
} from './UnitRestSleepBlockers'
import {
  findRestCellAroundPoint,
  getCurrentOutsideRestSite,
  getNearestFurnitureRestSite,
  type UnitRestSite,
} from './UnitRestShelter'

export { isShelterUnsafe } from './UnitRestShelter'
export { canResumeVillagerReturnTaskBeforeRest } from './UnitRestTravel'
export type { UnitRestSite } from './UnitRestShelter'

export const REST_CHECK_INTERVAL_MS = 1000
export const REST_ORDER_GRACE_MS = 2500
export const REST_MAX_RETRIES = 3
const REST_WAKE_LOCK_MS = 12000
const GAME_HOUR_MS = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay

type UnitRestDelayOptions = {
  durationMs?: number
  requireRestCapable?: boolean
  requireSleepTime?: boolean
  target?: RuntimeEntity | null
}

export function isSleepTime(context: GameContextLike): boolean {
  return isVillagerSleepTime(context)
}

function isHeroUnit(unit: UnitEntity): boolean {
  return Boolean(unit.type === UNIT_TYPES.hero || unit.controlMode === 'hero' || isHeroControlled(unit))
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
    !unit.isDead && !unit.isDestroyed && !isHeroUnit(unit) && !unit.followingHero && !unit.trainingTargetType
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
    requireSleepTime: false,
  })
}

export function canStartSleepRest(unit: UnitEntity): boolean {
  return Boolean(
    canUseUnitRest(unit) &&
      canChiefEscortRest(unit) &&
      !unit.spacePortalState &&
      !unit.pendingOrder &&
      !isActiveDefense(unit) &&
      !isExternalOffensiveUnit(unit) &&
      isBanditAtHome(unit) &&
      !hasVisiblePlayerEnemyNearby(unit)
  )
}

export function shouldRest(unit: UnitEntity, options: { ignoreWakeLock?: boolean } = {}): boolean {
  return Boolean(canStartSleepRest(unit) && (options.ignoreWakeLock || !isUnitRestWakeLocked(unit)))
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
  const anchor =
    restSite && sameMapSpace(unit, restSite.targetCell) ? (restSite.restTarget ?? restSite.targetCell) : unit
  return findRestCellAroundPoint(unit, anchor, restSite?.location === 'shelter' ? 3 : 2)
}

export function getNearestRestSite(unit: UnitEntity, excludedTarget?: BuildingEntity | null): UnitRestSite | null {
  return getNearestFurnitureRestSite(unit, excludedTarget) ?? getCurrentOutsideRestSite(unit)
}
