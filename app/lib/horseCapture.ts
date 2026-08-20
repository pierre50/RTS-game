import { BUILDING_TYPES, STEP_TIME } from '../constants'
import { canStoreStableHorse, storeStableHorse } from './stableHorses'
import { instancesDistance } from './maths'
import { instanceContactInstance } from './grid/movement'
import type { AnimalEntity, BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { GameContextLike, SchedulerTaskId } from '../types/context'

export const HORSE_CAPTURE_STABLE_MAX_DISTANCE = 7
export const HORSE_CAPTURE_STABLE_TIMEOUT_MS = 12000

export type LassoedHorseForCapture = AnimalEntity

export function getNearestAvailableStableForUnit(
  unit: UnitEntity,
  reference: RuntimeEntity,
  options: { maxDistance?: number | null } = {}
): BuildingEntity | null {
  const owner = unit.owner
  if (!owner) return null
  let stable: BuildingEntity | null = null
  let bestDistance = Infinity
  const maxDistance = options.maxDistance
  for (const building of owner.buildings ?? []) {
    if (
      building.type !== BUILDING_TYPES.stable ||
      !building.isBuilt ||
      building.isDead ||
      building.isDestroyed ||
      !canStoreStableHorse(building)
    ) {
      continue
    }
    const distance = instancesDistance(reference, building)
    if (maxDistance != null && distance > maxDistance) continue
    if (distance >= bestDistance) continue
    stable = building
    bestDistance = distance
  }
  return stable
}

export function routeCapturedHorseToStable({
  gameContext,
  horse,
  stable,
  timeoutMs = HORSE_CAPTURE_STABLE_TIMEOUT_MS,
  forceRepath = false,
  taskName = 'horse.captureToStable',
  isRouteValid,
  onStored,
  onFailure,
}: {
  gameContext: GameContextLike
  horse: LassoedHorseForCapture
  stable: BuildingEntity
  timeoutMs?: number
  forceRepath?: boolean
  taskName?: string
  isRouteValid?: () => boolean
  onStored?: () => void
  onFailure?: () => void
}): () => void {
  const scheduler = gameContext.scheduler
  const startedAt = scheduler.elapsedMs
  let taskId: SchedulerTaskId | null = null

  const clear = () => {
    if (taskId == null) return
    scheduler.remove(taskId)
    taskId = null
  }

  const tick = () => {
    if (isRouteValid && !isRouteValid()) {
      clear()
      onFailure?.()
      return
    }
    if (horse.isDead || horse.isDestroyed) {
      clear()
      onFailure?.()
      return
    }
    if (stable.isDead || stable.isDestroyed) {
      clear()
      onFailure?.()
      return
    }
    if (instanceContactInstance(horse, stable)) {
      if (storeStableHorse(stable, horse)) {
        horse.clear?.()
        clear()
        onStored?.()
        return
      }
      clear()
      onFailure?.()
      return
    }
    if (scheduler.elapsedMs - startedAt >= timeoutMs) {
      clear()
      onFailure?.()
      return
    }
    horse.sendTo?.(stable, undefined, { forceRepath })
  }

  taskId = scheduler.add(tick, STEP_TIME, taskName)
  tick()
  return clear
}

type OwnerStableRoutingContext = {
  gameContext: GameContextLike
  owner: UnitEntity
  horse: LassoedHorseForCapture
  timeoutMs?: number
  ownerContactTimeoutMs?: number | null
  forceRepath?: boolean
  maxDistance?: number | null
  taskName?: string
  canStartRouting?: (
    owner: UnitEntity,
    horse: LassoedHorseForCapture,
    stable: BuildingEntity
  ) => boolean
  isRouteValid?: () => boolean
  onRouteStart?: (stable: BuildingEntity) => void
  onHorseRouteStart?: (stable: BuildingEntity) => void
  onStableUnavailable?: () => void
  onStored: () => void
  onFailure: () => void
}

export function routeCapturedHorseWithOwnerToStable({
  gameContext,
  owner,
  horse,
  timeoutMs = HORSE_CAPTURE_STABLE_TIMEOUT_MS,
  ownerContactTimeoutMs = timeoutMs,
  forceRepath = false,
  maxDistance = null,
  taskName = 'horse.captureToStable.owner',
  canStartRouting = () => true,
  isRouteValid,
  onRouteStart,
  onHorseRouteStart,
  onStableUnavailable,
  onStored,
  onFailure,
}: OwnerStableRoutingContext): () => void {
  const scheduler = gameContext.scheduler
  const startedAt = scheduler.elapsedMs
  let taskId: SchedulerTaskId | null = null
  let stopCurrentHorseRoute: (() => void) | null = null
  let activeStableLabel: string | null = null
  let wasNoStable = false

  const clearHorseRoute = () => {
    if (!stopCurrentHorseRoute) return
    stopCurrentHorseRoute()
    stopCurrentHorseRoute = null
    activeStableLabel = null
  }

  const clear = () => {
    clearHorseRoute()
    if (taskId == null) return
    scheduler.remove(taskId)
    taskId = null
  }

  let ownerRouteTargetLabel: string | null = null

  const requestRoute = (stable: BuildingEntity) => {
    clearHorseRoute()
    if (onHorseRouteStart) onHorseRouteStart(stable)
    stopCurrentHorseRoute = routeCapturedHorseToStable({
      gameContext,
      horse,
      stable,
      timeoutMs,
      forceRepath,
      taskName: `${taskName}.route`,
      isRouteValid,
      onStored: () => {
        onStored()
        clear()
      },
      onFailure: () => {
        onFailure()
        clear()
      },
    })
  }

  const tick = () => {
    if (isRouteValid && !isRouteValid()) {
      clear()
      onFailure()
      return
    }
    if (horse.isDead || horse.isDestroyed) {
      clear()
      onFailure()
      return
    }
    if (
      !stopCurrentHorseRoute &&
      ownerContactTimeoutMs != null &&
      scheduler.elapsedMs - startedAt >= ownerContactTimeoutMs
    ) {
      clear()
      onFailure()
      return
    }
    const stable = getNearestAvailableStableForUnit(owner, horse, { maxDistance })
    if (!stable) {
      clearHorseRoute()
      if (!wasNoStable) {
        onStableUnavailable?.()
        wasNoStable = true
        ownerRouteTargetLabel = null
      }
      return
    }
    wasNoStable = false
    const shouldSelectStable = activeStableLabel !== stable.label || !stopCurrentHorseRoute
    if (!shouldSelectStable) return

    if (ownerRouteTargetLabel !== stable.label) {
      if (onRouteStart) onRouteStart(stable)
      ownerRouteTargetLabel = stable.label
    }

    if (!canStartRouting(owner, horse, stable)) return

    if (activeStableLabel !== stable.label || !stopCurrentHorseRoute) {
      activeStableLabel = stable.label
      requestRoute(stable)
    }
  }

  taskId = scheduler.add(tick, STEP_TIME, taskName)
  tick()
  return clear
}

export function routeCapturedHorseToStableWithOwnerContact(
  context: Omit<OwnerStableRoutingContext, 'canStartRouting'>
): () => void {
  return routeCapturedHorseWithOwnerToStable({
    ...context,
    canStartRouting: (_owner, _horse, stable) => instanceContactInstance(context.owner, stable),
    maxDistance: context.maxDistance ?? null,
  })
}
