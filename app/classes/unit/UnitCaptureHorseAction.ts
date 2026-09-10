import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES, STEP_TIME } from '../../constants'
import { degreeToDirection, getInstanceDegree, instancesDistance, isWildHorse } from '../../lib'
import {
  finishHeroCatchingPoleThrowAnimation,
  holdHeroCatchingPoleThrowFrame,
} from '../../lib/hero/heroProjectileTools'
import {
  getNearestAvailableStableForUnit,
  routeCapturedHorseToStableWithOwnerContact,
} from '../../lib/horses/horseCapture'
import type { AnimalEntity, BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { SchedulerTaskId } from '../../types/context'
import { HeroCatchingPoleThrow } from '../HeroCatchingPoleThrow'

const CAPTURE_HORSE_RETRY_INTERVAL_MS = 750
const CAPTURE_HORSE_REPATH_INTERVAL_MS = 220
const CAPTURE_HORSE_OWNER_STABLE_MIN_TIMEOUT_MS = 20000
const CAPTURE_HORSE_OWNER_STABLE_MS_PER_CELL = 900

type CaptureHorseActionState = {
  lastCatchingPoleAttemptAt: number
  lastRepathAt: number
  stableRouteStop: (() => void) | null
  stableRouteHorseLabel: string | null
  tickTaskId: SchedulerTaskId | null
}

type HeroCatchingPoleWithTarget = {
  target?: RuntimeEntity | null
}

const captureHorseActionStateByUnit = new WeakMap<UnitEntity, CaptureHorseActionState>()

function getCaptureHorseActionState(unit: UnitEntity): CaptureHorseActionState {
  let state = captureHorseActionStateByUnit.get(unit)
  if (!state) {
    state = {
      lastCatchingPoleAttemptAt: 0,
      lastRepathAt: 0,
      stableRouteStop: null,
      stableRouteHorseLabel: null,
      tickTaskId: null,
    }
    captureHorseActionStateByUnit.set(unit, state)
  }
  return state
}

function stopCaptureHorseTick(unit: UnitEntity, state: CaptureHorseActionState): void {
  if (state.tickTaskId == null) return
  unit.context?.scheduler?.remove(state.tickTaskId)
  state.tickTaskId = null
}

function ensureCaptureHorseTick(unit: UnitEntity, state: CaptureHorseActionState): void {
  const scheduler = unit.context?.scheduler
  if (!scheduler || state.tickTaskId != null) return
  state.tickTaskId = scheduler.add(
    () => {
      if (unit.action !== ACTION_TYPES.captureHorse || unit.isDead || unit.isDestroyed) {
        resetCaptureHorseActionState(unit)
        return
      }
      unit.getAction?.(ACTION_TYPES.captureHorse)
    },
    STEP_TIME,
    'unit.captureHorse'
  )
}

function getCaptureHorseOwnerStableTimeoutMs(owner: UnitEntity, stable: BuildingEntity): number {
  return Math.max(
    CAPTURE_HORSE_OWNER_STABLE_MIN_TIMEOUT_MS,
    Math.ceil(instancesDistance(owner, stable) * CAPTURE_HORSE_OWNER_STABLE_MS_PER_CELL)
  )
}

function isRuntimeEntity(value: UnitEntity['dest'] | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

function isHorseEntity(value: RuntimeEntity | null | undefined): value is AnimalEntity {
  return Boolean(value?.family === FAMILY_TYPES.animal && value.type === 'Horse' && isWildHorse(value))
}

function getHorseCatchingPoleOwner(horse: AnimalEntity): UnitEntity | null | undefined {
  return horse.catchingPoleOwner
}

function getHeroCatchingPoleTarget(unit: UnitEntity): RuntimeEntity | null {
  const catchingPole = (unit.heroCatchingPoleThrow ?? null) as HeroCatchingPoleWithTarget | null
  const target = catchingPole?.target
  return isRuntimeEntity(target) ? target : null
}

function getHeroCaptureCatchingPole(unit: UnitEntity): HeroCatchingPoleThrow | null {
  return unit.heroCatchingPoleThrow instanceof HeroCatchingPoleThrow ? unit.heroCatchingPoleThrow : null
}

function releaseCaptureHorseAttachment(
  unit: UnitEntity,
  horse: AnimalEntity | null | undefined = null,
  { allowFlee = true }: { allowFlee?: boolean } = {}
): void {
  const catchingPole = getHeroCaptureCatchingPole(unit)
  const catchingPoleTarget = (catchingPole as HeroCatchingPoleWithTarget | null)?.target
  const catchingPoleHorse = isHorseEntity(catchingPoleTarget) ? catchingPoleTarget : null
  const ownedHorse = horse && getHorseCatchingPoleOwner(horse)?.label === unit.label ? horse : catchingPoleHorse

  if (catchingPole && catchingPoleHorse && getHorseCatchingPoleOwner(catchingPoleHorse)?.label === unit.label) {
    catchingPole.releaseHorse({ allowStable: false, allowFlee })
  } else if (ownedHorse && getHorseCatchingPoleOwner(ownedHorse)?.label === unit.label) {
    ownedHorse.isCatchingPoleCaught = false
    ownedHorse.catchingPoleOwner = null
    if (allowFlee) ownedHorse.animalBehavior?.start?.()
  }
  catchingPole?.clearCatchingPoleThrow({ releaseHorse: false })
}

function resetCaptureHorseActionState(unit: UnitEntity, horse: AnimalEntity | null = null): void {
  const state = captureHorseActionStateByUnit.get(unit)
  if (state?.stableRouteStop) {
    state.stableRouteStop()
  }
  if (state) stopCaptureHorseTick(unit, state)
  releaseCaptureHorseAttachment(unit, horse)
  captureHorseActionStateByUnit.delete(unit)
}

function clearCaptureHorseStableRoute(unit: UnitEntity, state: CaptureHorseActionState): void {
  getHeroCaptureCatchingPole(unit)?.setExternalStableRouteActive(false)
  if (state.stableRouteStop) {
    state.stableRouteStop()
    state.stableRouteStop = null
  }
  state.stableRouteHorseLabel = null
}

function syncCaptureHorseMovingDest(unit: UnitEntity, horse: AnimalEntity): void {
  if (!unit.destHasMoved?.() || !unit.realDest) return
  unit.realDest.i = horse.i
  unit.realDest.j = horse.j
  unit.realDest.x = horse.x
  unit.realDest.y = horse.y
  const oldDeg = unit.degree
  unit.degree = getInstanceDegree(unit, horse.x, horse.y)
  if (!unit.heroCatchingPoleThrow && degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
    unit.setTextures?.(SHEET_TYPES.action)
  }
}

function tryStartCaptureHorseCatchingPole(
  unit: UnitEntity,
  horse: AnimalEntity,
  state: CaptureHorseActionState,
  now: number,
  hasActiveCaptureCatchingPole: boolean,
  isCapturing: boolean
): boolean {
  if (isCapturing || hasActiveCaptureCatchingPole || !unit.context) return false
  if (now - state.lastRepathAt > CAPTURE_HORSE_REPATH_INTERVAL_MS) {
    state.lastRepathAt = now
    unit.sendToEvt?.(horse, ACTION_TYPES.captureHorse, { forceRepath: true })
  }
  if (now - state.lastCatchingPoleAttemptAt < CAPTURE_HORSE_RETRY_INTERVAL_MS) return true
  state.lastCatchingPoleAttemptAt = now
  holdHeroCatchingPoleThrowFrame(unit)
  const catchingPole = new HeroCatchingPoleThrow(unit, { x: horse.x, y: horse.y }, unit.context, {
    pullCapturedHorseToOwner: true,
    allowStableOnRelease: false,
    releaseHorseOnClear: false,
    autoRouteStableWhileAttached: false,
    showMessages: Boolean(unit.owner?.isPlayed),
    onThrowResolved: () => finishHeroCatchingPoleThrowAnimation(unit),
  })
  unit.context.map?.addChild(catchingPole)
  return true
}

function routeCapturedHorseToStable(
  unit: UnitEntity,
  horse: AnimalEntity,
  stable: BuildingEntity,
  state: CaptureHorseActionState,
  clearStableRoute: () => void
): void {
  const unitContext = unit.context
  if (!unitContext) return
  if (state.stableRouteHorseLabel !== horse.label) clearStableRoute()
  if (!state.stableRouteStop) {
    state.stableRouteHorseLabel = horse.label
    state.stableRouteStop = routeCapturedHorseToStableWithOwnerContact({
      gameContext: unitContext,
      owner: unit,
      horse,
      ownerContactTimeoutMs: getCaptureHorseOwnerStableTimeoutMs(unit, stable),
      isRouteValid: () => Boolean(horse.isCatchingPoleCaught && getHorseCatchingPoleOwner(horse)?.label === unit.label),
      onHorseRouteStart: () => {
        getHeroCaptureCatchingPole(unit)?.setExternalStableRouteActive(true)
      },
      onStored: () => {
        horse.isCatchingPoleCaught = false
        horse.catchingPoleOwner = null
        clearStableRoute()
        unit.heroCatchingPoleThrow?.clearCatchingPoleThrow?.({ releaseHorse: false })
        if (unit.action === ACTION_TYPES.captureHorse) unit.affectNewDest?.()
      },
      onFailure: () => {
        clearStableRoute()
        horse.isCatchingPoleCaught = false
        horse.catchingPoleOwner = null
        unit.heroCatchingPoleThrow?.clearCatchingPoleThrow?.({ releaseHorse: false })
        if (unit.action !== ACTION_TYPES.captureHorse) return
        if (unit.getActionCondition?.(horse, ACTION_TYPES.captureHorse)) {
          unit.sendToEvt?.(horse, ACTION_TYPES.captureHorse, { forceRepath: true })
        } else {
          unit.affectNewDest?.()
        }
      },
    })
  }
}

export function handleCaptureHorseAction(unit: UnitEntity): void {
  const unitContext = unit.context
  if (!unitContext) {
    unit.affectNewDest?.()
    return
  }
  const unitDest = isRuntimeEntity(unit.dest) ? unit.dest : null
  const heroCatchingPoleThrowTarget = getHeroCatchingPoleTarget(unit)
  const now = unitContext.scheduler?.elapsedMs ?? Date.now()
  const captureHorseState = getCaptureHorseActionState(unit)
  const clearStableRoute = () => clearCaptureHorseStableRoute(unit, captureHorseState)
  const stableTarget = unitDest?.family === FAMILY_TYPES.building ? (unitDest as BuildingEntity) : null
  const horse = isHorseEntity(unitDest)
    ? unitDest
    : isHorseEntity(heroCatchingPoleThrowTarget)
      ? heroCatchingPoleThrowTarget
      : null
  if (!horse || horse.isDead || horse.isDestroyed) {
    clearStableRoute()
    resetCaptureHorseActionState(unit, horse)
    unit.affectNewDest?.()
    return
  }

  const catchingPoleOwner = getHorseCatchingPoleOwner(horse)
  if (!horse.isCatchingPoleCaught && catchingPoleOwner?.label === unit.label) {
    horse.catchingPoleOwner = null
  }
  if (horse.isCatchingPoleCaught && !catchingPoleOwner) {
    horse.isCatchingPoleCaught = false
    clearStableRoute()
    captureHorseState.lastCatchingPoleAttemptAt = 0
    captureHorseState.lastRepathAt = 0
    resetCaptureHorseActionState(unit, horse)
    unit.affectNewDest?.()
    return
  }
  const isCatchingPoleCaughtByOther = Boolean(
    horse.isCatchingPoleCaught && catchingPoleOwner && catchingPoleOwner.label !== unit.label
  )
  if (isCatchingPoleCaughtByOther) {
    clearStableRoute()
    resetCaptureHorseActionState(unit)
    unit.affectNewDest?.()
    return
  }
  ensureCaptureHorseTick(unit, captureHorseState)

  const heroCaptureCatchingPole = getHeroCaptureCatchingPole(unit)
  const catchingPoleTarget = (heroCaptureCatchingPole as HeroCatchingPoleWithTarget | null)?.target
  if (
    heroCaptureCatchingPole &&
    heroCaptureCatchingPole.state !== 'retracting' &&
    isRuntimeEntity(catchingPoleTarget) &&
    catchingPoleTarget.label !== horse.label
  ) {
    heroCaptureCatchingPole.clearCatchingPoleThrow?.({ releaseHorse: false })
  }
  const hasActiveCaptureCatchingPole =
    unit.action === ACTION_TYPES.captureHorse &&
    Boolean(
      heroCaptureCatchingPole &&
        heroCaptureCatchingPole.state !== 'retracting' &&
        (!isRuntimeEntity(catchingPoleTarget)
          ? unitDest?.label === horse.label
          : catchingPoleTarget.label === horse.label)
    )
  const isHeroCatchingPoleOwner =
    horse.isCatchingPoleCaught && horse.type === 'Horse' && catchingPoleOwner?.label === unit.label
  const isCapturing = isHeroCatchingPoleOwner || hasActiveCaptureCatchingPole

  if (stableTarget) {
    if (!isCapturing || !horse.isCatchingPoleCaught) {
      clearStableRoute()
      unit.affectNewDest?.()
      unit.sendToEvt?.(horse, ACTION_TYPES.captureHorse, { forceRepath: true })
      return
    }
    if (unit.isUnitAtDest?.(unit.action, stableTarget)) {
      unit.setTextures?.(SHEET_TYPES.standing)
    } else if ((unit.path?.length ?? 0) === 0) {
      unit.sendToEvt?.(stableTarget, ACTION_TYPES.captureHorse, { forceRepath: true })
    }
    return
  }

  if (!isCapturing && !unit.getActionCondition?.(horse, ACTION_TYPES.captureHorse)) {
    clearStableRoute()
    resetCaptureHorseActionState(unit, horse)
    unit.affectNewDest?.()
    return
  }

  if (!unit.isUnitAtDest?.(unit.action, horse)) {
    if (now - captureHorseState.lastRepathAt >= CAPTURE_HORSE_REPATH_INTERVAL_MS) {
      captureHorseState.lastRepathAt = now
      unit.sendToEvt?.(horse, ACTION_TYPES.captureHorse, { forceRepath: true })
    }
    return
  }

  if (unit.currentSheet !== SHEET_TYPES.action) unit.setTextures?.(SHEET_TYPES.action)
  syncCaptureHorseMovingDest(unit, horse)

  if (tryStartCaptureHorseCatchingPole(unit, horse, captureHorseState, now, hasActiveCaptureCatchingPole, isCapturing))
    return

  if (!horse.isCatchingPoleCaught) {
    clearStableRoute()
    captureHorseState.lastRepathAt = now
    return
  }

  const stable = getNearestAvailableStableForUnit(unit, horse)
  if (!stable) {
    clearStableRoute()
    unit.affectNewDest?.()
    resetCaptureHorseActionState(unit, horse)
    return
  }

  routeCapturedHorseToStable(unit, horse, stable, captureHorseState, clearStableRoute)

  const shouldMoveToStable =
    !stableTarget &&
    (unitDest?.label !== stable.label ||
      ((unit.path?.length ?? 0) === 0 && !unit.isUnitAtDest?.(ACTION_TYPES.captureHorse, stable)))
  if (shouldMoveToStable) {
    unit.sendToEvt?.(stable, ACTION_TYPES.captureHorse, { forceRepath: true })
  }
}
