import { UNIT_TYPES } from '../../constants'
import { evaluateCombatMorale } from '../../lib/combat'
import { findInstancesInSight } from '../../lib/grid/visibility'
import { instanceIsInInsightRange } from '../../lib/units/insightDetection'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import { getBuildingInteriorSpaceForUnit, settleUnitAtBuildingInteriorSleepCell } from '../BuildingInteriorSpaceSystem'
import {
  enterShelter,
  enterShelterInstant,
  finishUnitWakeTransition,
  retryShelterPath,
  rerouteRestUnit,
  sendUnitToRest,
  sleepOutside,
  sleepOutsideAtCellInstant,
  waitOutsideForSleep,
  wakeUnit,
  wakeUnitInstant,
  getRestReturnTask,
} from './UnitRestLifecycle'
import { hasBuildingShelterCapacity } from '../../lib/buildings/buildingOccupancy'
import { shouldVillagerBeAsleep } from '../../lib/units/villagerSchedule'
import type { TimedUnitRestState } from './UnitRestLifecycle'
import { keepSleepingOutsideVisual } from './UnitSleepVisuals'
import {
  canUseUnitRest,
  getRestTransitionCell,
  getRestTransitionDurationMs,
  isShelterUnsafe,
  isSleepTime,
  isUsableShelter,
  markUnitRestAlert,
  REST_MAX_RETRIES,
  REST_ORDER_GRACE_MS,
  shouldRest,
} from './UnitRestRules'

function hasPendingRestOrder(unit: UnitEntity, targetCell: UnitEntity['currentCell'] | null | undefined): boolean {
  const pending = unit.pendingOrder
  if (!pending || !targetCell) return false
  if (pending.execute) return true
  return pending.dest === targetCell || (pending.dest?.i === targetCell.i && pending.dest?.j === targetCell.j)
}

function retrySleepSpotPath(unit: UnitEntity, state: TimedUnitRestState): boolean {
  const targetCell = state.targetCell
  if (!targetCell) return false
  const retryCount = state.retryCount ?? 0
  if (retryCount >= REST_MAX_RETRIES) return false
  state.retryCount = retryCount + 1
  state.startedAtMs = unit.context?.scheduler?.elapsedMs ?? state.startedAtMs ?? 0
  unit.sendToEvt?.(targetCell, null, {
    forceRepath: true,
    preserveAutonomy: true,
    allowPassageStop: state.location === 'shelter',
  })
  return true
}

function retryUsableShelterPath(unit: UnitEntity, state: TimedUnitRestState): boolean {
  if (retryShelterPath(unit, state)) return true
  if (state.reason !== 'sleep' || !state.shelter || !isUsableShelter(state.shelter, unit.owner)) return false
  state.retryCount = 0
  return retryShelterPath(unit, state)
}

function moveUnitToRestSite(unit: UnitEntity, state: TimedUnitRestState): void {
  state.status = 'movingToRest'
  state.transitionTargetCell = null
  state.transitionUntilMs = undefined
  state.startedAtMs = unit.context?.scheduler?.elapsedMs ?? state.startedAtMs ?? 0
  state.retryCount = 0
  unit.sendToEvt?.(state.targetCell ?? null, null, {
    forceRepath: true,
    preserveAutonomy: true,
    allowPassageStop: state.location === 'shelter',
  })
}

function hasFailedTransitionPath(
  unit: UnitEntity,
  transitionCell: UnitEntity['currentCell'] | null | undefined,
  arrived: boolean,
  startedAtMs: number | null | undefined
): boolean {
  const elapsed = (unit.context?.scheduler?.elapsedMs ?? 0) - (startedAtMs ?? 0)
  return Boolean(
    !arrived &&
      !hasPendingRestOrder(unit, transitionCell) &&
      elapsed >= REST_ORDER_GRACE_MS &&
      !unit.path?.length &&
      unit.dest !== transitionCell
  )
}

function updateWindingDownRestUnit(unit: UnitEntity, state: TimedUnitRestState): boolean {
  if (state.status !== 'windingDown') return false
  if (!isSleepTime(unit.context!) || !canUseUnitRest(unit)) {
    unit.shelterState = null
    return true
  }

  const now = unit.context?.scheduler?.elapsedMs ?? 0
  const transitionCell = state.transitionTargetCell
  const arrived = Boolean(transitionCell && unit.i === transitionCell.i && unit.j === transitionCell.j)
  const failedPath = hasFailedTransitionPath(unit, transitionCell, arrived, state.startedAtMs)

  if (now < (state.transitionUntilMs ?? now) && !failedPath) return true

  const step = state.transitionStep ?? 0
  if (step < 1 && !failedPath) {
    const restSite = {
      location: state.location,
      shelter: state.shelter ?? null,
      targetCell: state.targetCell!,
    }
    const nextCell = getRestTransitionCell(unit, restSite)
    if (nextCell && nextCell !== transitionCell && !arrived) {
      state.transitionStep = step + 1
      state.transitionTargetCell = nextCell
      state.transitionUntilMs = now + Math.floor(getRestTransitionDurationMs(unit, 'windingDown') / 2)
      state.startedAtMs = now
      unit.sendToEvt?.(nextCell, null, { forceRepath: true, preserveAutonomy: true })
      return true
    }
  }

  moveUnitToRestSite(unit, state)
  return true
}

function updateWakingUpRestUnit(unit: UnitEntity, state: TimedUnitRestState): boolean {
  if (state.status !== 'wakingUp') return false
  if (isSleepTime(unit.context!)) {
    sendUnitToRest(unit, 'sleep')
    return true
  }

  const now = unit.context?.scheduler?.elapsedMs ?? 0
  const transitionCell = state.transitionTargetCell
  const arrived = Boolean(transitionCell && unit.i === transitionCell.i && unit.j === transitionCell.j)
  const failedPath = hasFailedTransitionPath(unit, transitionCell, arrived, state.startedAtMs)

  if (now < (state.transitionUntilMs ?? now) && !failedPath) return true
  finishUnitWakeTransition(unit, state)
  return true
}

function settleMovingRestState(unit: UnitEntity, state: TimedUnitRestState | null | undefined): boolean {
  if (state?.status !== 'movingToRest') return false
  if (isUsableShelter(state.shelter, unit.owner)) {
    enterShelterInstant(unit, state.shelter)
    return true
  }
  if (state.reason === 'sleep' && state.location === 'outside' && state.targetCell) {
    sleepOutsideAtCellInstant(unit, state.targetCell, 'sleep')
    return true
  }
  return false
}

function canDetectHeroForRestAlert(unit: UnitEntity, hero: UnitEntity | null): hero is UnitEntity {
  if (!hero || hero === unit || hero.isDead || hero.isDestroyed) return false
  if (!unit.owner?.isEnemy?.(hero.owner)) return false
  return instanceIsInInsightRange(unit, hero, unit.sight ?? 7)
}

function sameRestAlertGroup(source: UnitEntity, target: UnitEntity): boolean {
  return Boolean(source.owner && target.owner && source.owner === target.owner)
}

export function isVillager(unit: UnitEntity): boolean {
  return unit.type === UNIT_TYPES.villager
}

export function settleSleepState(unit: UnitEntity): void {
  const state = unit.shelterState as TimedUnitRestState | null | undefined
  if (state?.status === 'inside') return
  if (settleMovingRestState(unit, state)) return
  if (state?.status === 'outside') {
    sleepOutside(unit, 'sleep', { visual: 'finalFrame' })
    return
  }
  if (!shouldRest(unit, { ignoreWakeLock: true })) return
  sendUnitToRest(unit, 'sleep', { transition: false })
  const nextState = unit.shelterState as TimedUnitRestState | null | undefined
  if (settleMovingRestState(unit, nextState)) return
  if (nextState?.status === 'outside') sleepOutside(unit, 'sleep', { visual: 'finalFrame' })
}

export function shouldRouteUnitToInteriorExit(context: GameContextLike, unit: UnitEntity): boolean {
  return (
    (context.map?.mapType === 'interior' || Boolean(getBuildingInteriorSpaceForUnit(unit))) &&
    unit.shelterState?.reason === 'sleep' &&
    Boolean(context.routeInteriorUnitToExit)
  )
}

function isActiveThreat(attacker: RuntimeEntity | null | undefined): attacker is RuntimeEntity {
  return Boolean(attacker && !attacker.isDead && !attacker.isDestroyed)
}

function fleeFromDanger(unit: UnitEntity, attacker: RuntimeEntity): void {
  markUnitRestAlert(unit, attacker)
  const fleeingUnit = unit as UnitEntity & { runaway?: (target: RuntimeEntity) => void }
  fleeingUnit.runaway?.(attacker)
}

export function reactUnitToDanger(unit: UnitEntity, attacker: RuntimeEntity): void {
  markUnitRestAlert(unit, attacker)
  if (evaluateCombatMorale(unit, attacker) === 'flee') {
    fleeFromDanger(unit, attacker)
    return
  }
  unit.detect?.(attacker)
}

export function handleUnitDanger(unit: UnitEntity, attacker: RuntimeEntity | null | undefined): boolean {
  if (!isActiveThreat(attacker)) return false
  const shouldVillagerReact = isVillager(unit) && canUseUnitRest(unit)
  if (unit.shelterState?.reason === 'sleep') {
    markUnitRestAlert(unit, attacker)
    wakeUnit(unit, {
      force: true,
      mode: 'order',
      onComplete: shouldVillagerReact ? () => reactUnitToDanger(unit, attacker) : undefined,
    })
    return shouldVillagerReact
  }
  if (!shouldVillagerReact) return false
  reactUnitToDanger(unit, attacker)
  return true
}

export function evacuateUnitsFromShelter(building: BuildingEntity, options: { force?: boolean } = {}): void {
  for (const unit of building.owner?.units ?? []) {
    const state = unit.shelterState
    if (state?.shelter !== building) continue
    wakeUnit(unit, { force: options.force ?? true })
    if (isSleepTime(unit.context!) && !unit.shelterState) sendUnitToRest(unit, 'sleep')
  }
}

export function evacuateUnitsIfShelterUnsafe(building: BuildingEntity): void {
  if (!isShelterUnsafe(building)) return
  evacuateUnitsFromShelter(building, { force: true })
}

function getHeroAlertTarget(context: GameContextLike): UnitEntity | null {
  const controlsHero = context.controls?.heroUnit
  if (controlsHero && !controlsHero.isDead && !controlsHero.isDestroyed) return controlsHero

  for (const player of context.players ?? []) {
    for (const unit of player.units ?? []) {
      if (!unit.isDead && !unit.isDestroyed && (unit.type === UNIT_TYPES.hero || unit.controlMode === 'hero')) {
        return unit
      }
    }
  }
  return null
}

export function findHeroRestAlertTarget(context: GameContextLike, unit: UnitEntity): RuntimeEntity | null {
  const hero = getHeroAlertTarget(context)
  return canDetectHeroForRestAlert(unit, hero) ? hero : null
}

export function findPropagatedRestAlertSleepers(source: UnitEntity): UnitEntity[] {
  return findInstancesInSight<UnitEntity, UnitEntity>(
    source,
    candidate =>
      Boolean(
        candidate !== source &&
          candidate.family === 'unit' &&
          candidate.shelterState?.reason === 'sleep' &&
          sameRestAlertGroup(source, candidate) &&
          canUseUnitRest(candidate)
      ),
    { range: source.sight ?? 7 }
  )
}

export function updateMovingRestUnit(unit: UnitEntity): void {
  const state = unit.shelterState as TimedUnitRestState | null | undefined
  if (!state) return
  if (updateWindingDownRestUnit(unit, state)) return
  if (updateWakingUpRestUnit(unit, state)) return
  if (state.status !== 'movingToRest') return
  keepSleepingOutsideVisual(unit)
  const targetCell = state.targetCell
  const arrived = Boolean(targetCell && unit.i === targetCell.i && unit.j === targetCell.j)
  const elapsed = (unit.context?.scheduler?.elapsedMs ?? 0) - (state.startedAtMs ?? 0)
  const orderStillPending = hasPendingRestOrder(unit, targetCell)
  const failedPath =
    !orderStillPending && elapsed >= REST_ORDER_GRACE_MS && !unit.path?.length && unit.dest !== targetCell

  const interiorSpace = getBuildingInteriorSpaceForUnit(unit)
  if (interiorSpace && state.reason === 'sleep') {
    if (arrived) {
      settleUnitAtBuildingInteriorSleepCell(unit, interiorSpace, targetCell)
    } else if (failedPath) {
      if (retrySleepSpotPath(unit, state)) return
      settleUnitAtBuildingInteriorSleepCell(unit, interiorSpace, unit.currentCell ?? targetCell)
    }
    return
  }

  if (!isUsableShelter(state.shelter, unit.owner)) {
    if (state.location === 'outside' && targetCell) {
      if (arrived) {
        if (isVillager(unit) && !shouldVillagerBeAsleep(unit)) waitOutsideForSleep(unit)
        else sleepOutside(unit, state.reason)
      } else if (failedPath && !retrySleepSpotPath(unit, state)) {
        if (isVillager(unit) && !shouldVillagerBeAsleep(unit)) waitOutsideForSleep(unit)
        else sleepOutside(unit, state.reason)
      }
      return
    }
    if (isVillager(unit) && !shouldVillagerBeAsleep(unit)) waitOutsideForSleep(unit)
    else sleepOutside(unit, state.reason)
    return
  }

  if (arrived) {
    if (!hasBuildingShelterCapacity(state.shelter, unit.owner?.units ?? [], { exclude: unit })) {
      rerouteRestUnit(unit)
      return
    }
    enterShelter(unit, state.shelter)
  }
  else if (failedPath) {
    if (retryUsableShelterPath(unit, state)) return
    if (isVillager(unit) && !shouldVillagerBeAsleep(unit)) waitOutsideForSleep(unit)
    else sleepOutside(unit, state.reason)
  }
}

export function wakeRestingUnitInstant(context: GameContextLike, unit: UnitEntity): void {
  const routeToInteriorExit = shouldRouteUnitToInteriorExit(context, unit)
  const returnTask = routeToInteriorExit ? getRestReturnTask(unit) : null
  wakeUnitInstant(unit, { force: true, mode: routeToInteriorExit ? 'order' : 'resume' })
  if (routeToInteriorExit) context.routeInteriorUnitToExit?.(unit, returnTask)
}
