import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES, STEP_TIME } from '../../constants'
import { degreeToDirection, getInstanceDegree, instancesDistance } from '../../lib'
import { getNearestAvailableStableForUnit, routeCapturedHorseToStableWithOwnerContact } from '../../lib/horseCapture'
import type { AnimalEntity, BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { SchedulerTaskId } from '../../types/context'
import { HeroLassoThrow } from '../HeroLassoThrow'

const CAPTURE_HORSE_RETRY_INTERVAL_MS = 750
const CAPTURE_HORSE_REPATH_INTERVAL_MS = 220
const CAPTURE_HORSE_OWNER_STABLE_MIN_TIMEOUT_MS = 20000
const CAPTURE_HORSE_OWNER_STABLE_MS_PER_CELL = 900

type CaptureHorseActionState = {
  lastLassoAttemptAt: number
  lastRepathAt: number
  stableRouteStop: (() => void) | null
  stableRouteHorseLabel: string | null
  tickTaskId: SchedulerTaskId | null
}

type HeroLassoWithTarget = {
  target?: RuntimeEntity | null
}

const captureHorseActionStateByUnit = new WeakMap<UnitEntity, CaptureHorseActionState>()

function getCaptureHorseActionState(unit: UnitEntity): CaptureHorseActionState {
  let state = captureHorseActionStateByUnit.get(unit)
  if (!state) {
    state = {
      lastLassoAttemptAt: 0,
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
  return Boolean(value?.family === FAMILY_TYPES.animal && value.type === 'Horse')
}

function getHorseLassoOwner(horse: AnimalEntity): UnitEntity | null | undefined {
  return horse.lassoOwner
}

function getHeroLassoTarget(unit: UnitEntity): RuntimeEntity | null {
  const lasso = (unit.heroLasso ?? null) as HeroLassoWithTarget | null
  const target = lasso?.target
  return isRuntimeEntity(target) ? target : null
}

function getHeroCaptureLasso(unit: UnitEntity): HeroLassoThrow | null {
  return unit.heroLasso instanceof HeroLassoThrow ? unit.heroLasso : null
}

function releaseCaptureHorseAttachment(
  unit: UnitEntity,
  horse: AnimalEntity | null | undefined = null,
  { allowFlee = true }: { allowFlee?: boolean } = {}
): void {
  const lasso = getHeroCaptureLasso(unit)
  const lassoTarget = (lasso as HeroLassoWithTarget | null)?.target
  const lassoHorse = isHorseEntity(lassoTarget) ? lassoTarget : null
  const ownedHorse = horse && getHorseLassoOwner(horse)?.label === unit.label ? horse : lassoHorse

  if (lasso && lassoHorse && getHorseLassoOwner(lassoHorse)?.label === unit.label) {
    lasso.releaseHorse({ allowStable: false, allowFlee })
  } else if (ownedHorse && getHorseLassoOwner(ownedHorse)?.label === unit.label) {
    ownedHorse.isLassoed = false
    ownedHorse.lassoOwner = null
    if (allowFlee) ownedHorse.animalBehavior?.start?.()
  }
  lasso?.clearLasso({ releaseHorse: false })
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
  getHeroCaptureLasso(unit)?.setExternalStableRouteActive(false)
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
  if (degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
    unit.setTextures?.(SHEET_TYPES.action)
  }
}

function tryStartCaptureHorseLasso(
  unit: UnitEntity,
  horse: AnimalEntity,
  state: CaptureHorseActionState,
  now: number,
  hasActiveCaptureLasso: boolean,
  isCapturing: boolean
): boolean {
  if (isCapturing || hasActiveCaptureLasso || !unit.context) return false
  if (now - state.lastRepathAt > CAPTURE_HORSE_REPATH_INTERVAL_MS) {
    state.lastRepathAt = now
    unit.sendToEvt?.(horse, ACTION_TYPES.captureHorse, { forceRepath: true })
  }
  if (now - state.lastLassoAttemptAt < CAPTURE_HORSE_RETRY_INTERVAL_MS) return true
  state.lastLassoAttemptAt = now
  const lasso = new HeroLassoThrow(unit, { x: horse.x, y: horse.y }, unit.context, {
    pullCapturedHorseToOwner: true,
    allowStableOnRelease: false,
    releaseHorseOnClear: false,
    autoRouteStableWhileAttached: false,
    showMessages: unit.owner?.isPlayed,
  })
  unit.context.map?.addChild(lasso)
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
      isRouteValid: () => Boolean(horse.isLassoed && getHorseLassoOwner(horse)?.label === unit.label),
      onHorseRouteStart: () => {
        getHeroCaptureLasso(unit)?.setExternalStableRouteActive(true)
      },
      onStored: () => {
        horse.isLassoed = false
        horse.lassoOwner = null
        clearStableRoute()
        unit.heroLasso?.clearLasso?.({ releaseHorse: false })
        if (unit.action === ACTION_TYPES.captureHorse) unit.affectNewDest?.()
      },
      onFailure: () => {
        clearStableRoute()
        horse.isLassoed = false
        horse.lassoOwner = null
        unit.heroLasso?.clearLasso?.({ releaseHorse: false })
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
  const heroLassoTarget = getHeroLassoTarget(unit)
  const now = unitContext.scheduler?.elapsedMs ?? Date.now()
  const captureHorseState = getCaptureHorseActionState(unit)
  const clearStableRoute = () => clearCaptureHorseStableRoute(unit, captureHorseState)
  const stableTarget = unitDest?.family === FAMILY_TYPES.building ? (unitDest as BuildingEntity) : null
  const horse = isHorseEntity(unitDest) ? unitDest : isHorseEntity(heroLassoTarget) ? heroLassoTarget : null
  if (!horse || horse.isDead || horse.isDestroyed) {
    clearStableRoute()
    resetCaptureHorseActionState(unit, horse)
    unit.affectNewDest?.()
    return
  }

  const lassoOwner = getHorseLassoOwner(horse)
  if (!horse.isLassoed && lassoOwner?.label === unit.label) {
    horse.lassoOwner = null
  }
  if (horse.isLassoed && !lassoOwner) {
    horse.isLassoed = false
    clearStableRoute()
    captureHorseState.lastLassoAttemptAt = 0
    captureHorseState.lastRepathAt = 0
    resetCaptureHorseActionState(unit, horse)
    unit.affectNewDest?.()
    return
  }
  const isLassoedByOther = Boolean(horse.isLassoed && lassoOwner && lassoOwner.label !== unit.label)
  if (isLassoedByOther) {
    clearStableRoute()
    resetCaptureHorseActionState(unit)
    unit.affectNewDest?.()
    return
  }
  ensureCaptureHorseTick(unit, captureHorseState)

  const heroCaptureLasso = getHeroCaptureLasso(unit)
  const lassoTarget = (heroCaptureLasso as HeroLassoWithTarget | null)?.target
  if (
    heroCaptureLasso &&
    heroCaptureLasso.state !== 'retracting' &&
    isRuntimeEntity(lassoTarget) &&
    lassoTarget.label !== horse.label
  ) {
    heroCaptureLasso.clearLasso?.({ releaseHorse: false })
  }
  const hasActiveCaptureLasso =
    unit.action === ACTION_TYPES.captureHorse &&
    Boolean(
      heroCaptureLasso &&
        heroCaptureLasso.state !== 'retracting' &&
        (!isRuntimeEntity(lassoTarget) ? unitDest?.label === horse.label : lassoTarget.label === horse.label)
    )
  const isHeroLassoOwner = horse.isLassoed && horse.type === 'Horse' && lassoOwner?.label === unit.label
  const isCapturing = isHeroLassoOwner || hasActiveCaptureLasso

  if (stableTarget) {
    if (!isCapturing || !horse.isLassoed) {
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

  unit.setTextures?.(SHEET_TYPES.action)

  if (!unit.isUnitAtDest?.(unit.action, horse)) {
    unit.sendToEvt?.(horse, ACTION_TYPES.captureHorse, { forceRepath: true })
    return
  }

  syncCaptureHorseMovingDest(unit, horse)

  if (tryStartCaptureHorseLasso(unit, horse, captureHorseState, now, hasActiveCaptureLasso, isCapturing)) return

  if (!horse.isLassoed) {
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
