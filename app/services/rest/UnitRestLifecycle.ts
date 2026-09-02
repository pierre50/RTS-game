import { ACTION_TYPES, FADE_DURATION_MS, SHEET_TYPES, UNIT_TYPES } from '../../constants'
import {
  cartesianToIsometric,
  getGroundReliefLevel,
  getInstanceZIndex,
  updateInstanceVisibility,
} from '../../lib'
import { resumeStrictVillagerAutonomy, resumeVillagerStoredTask } from '../../lib/units/villagerTaskRecovery'
import { unitHasDeliverableResources } from '../../lib/resources/resourceDelivery'
import { shouldVillagerBeAsleep } from '../../lib/units/villagerSchedule'
import { cancelFade, fadeIn, fadeOut } from '../../lib/entities/entityFade'
import { clearUnitOverheadIndicator, setUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import { isBuildingInteriorSupported } from '../../lib/buildings/interiors'
import { getMapSpace, moveEntityToMapSpace } from '../../lib/mapSpaces'
import type { BuildingEntity, RuntimeEntity, UnitEntity, UnitRestReason, UnitRestState } from '../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import {
  canStartSleepRest,
  canSleepWithoutRestSite,
  getNearestRestSite,
  getRestTransitionCell,
  getRestTransitionDurationMs,
  getShelterEntryCell,
  isUsableShelter,
  REST_MAX_RETRIES,
  type UnitRestSite,
} from './UnitRestRules'
import {
  cancelSleepingWakeVisual,
  clearSleepingVisualState,
  playSleepingOutsideVisual,
  playSleepingWakeVisual,
  setSleepingOutsideFinalVisual,
  setDetachedShadowsVisible,
} from './UnitSleepVisuals'
import {
  ensureRuntimeBuildingInteriorSpace,
  getBuildingInteriorSpaceForUnit,
  moveUnitToBuildingInteriorSleep,
} from '../BuildingInteriorSpaceSystem'

type RuntimeMapWithBuckets = RuntimeMap & {
  addChild?: (child: UnitEntity) => void
  removeFromInstanceBucket?: (entity: RuntimeEntity) => void
  addToInstanceBucket?: (entity: RuntimeEntity) => void
  updateInstanceBucket?: (entity: RuntimeEntity, oldI: number, oldJ: number) => void
}

export type TimedUnitRestState = UnitRestState & { hiddenAt?: number }
export type UnitWakeMode = 'resume' | 'order'
export type SleepOutsideVisualMode = 'animate' | 'finalFrame'
type RestTransitionOptions = {
  transition?: boolean
}

function rememberRestState(
  unit: UnitEntity,
  state: Omit<UnitRestState, 'previousDest' | 'previousWork' | 'previousAction' | 'previousAutonomousJob'>
): UnitRestState {
  const existing = unit.shelterState
  const restState: UnitRestState = {
    ...state,
    reason: state.reason ?? existing?.reason ?? 'sleep',
    previousDest: existing?.previousDest ?? unit.dest ?? null,
    previousWork: existing?.previousWork ?? unit.work ?? null,
    previousAction: existing?.previousAction ?? unit.action ?? null,
    previousAutonomousJob: existing?.previousAutonomousJob ?? unit.autonomousJob ?? null,
  }
  unit.shelterState = restState
  return restState
}

function clearUnitCell(unit: UnitEntity): void {
  const cell = unit.currentCell
  if (cell?.has === unit || cell?.has?.label === unit.label) {
    cell.has = null
    cell.solid = false
  }
}

function stopUnitForRest(unit: UnitEntity): void {
  unit.stopInterval?.()
  unit.stopTimeout?.()
  unit.path = []
  unit.realDest = null
  unit.pendingOrder = null
  unit.blockedGatherApproach = null
  unit.inactif = true
}

function hideUnitInsideShelter(unit: UnitEntity, shelter: BuildingEntity): void {
  const state = unit.shelterState
  if (state?.status !== 'inside' || state.shelter !== shelter) return
  const map = unit.context?.map as RuntimeMapWithBuckets | undefined
  if (unit.context) {
    const space = ensureRuntimeBuildingInteriorSpace(unit.context, shelter)
    if (space && moveUnitToBuildingInteriorSleep(unit.context, unit, space, { mode: 'route' })) return
  }
  if (isBuildingInteriorSupported(shelter)) {
    sleepOutside(unit, state.reason)
    return
  }
  clearUnitCell(unit)
  map?.removeFromInstanceBucket?.(unit)
  setDetachedShadowsVisible(unit, false)
  unit.alpha = 0
  unit.visible = false
}

function prepareUnitInsideShelter(unit: UnitEntity, shelter: BuildingEntity): void {
  rememberRestState(unit, {
    status: 'inside',
    reason: unit.shelterState?.reason ?? 'sleep',
    location: 'shelter',
    shelter,
    targetCell: null,
  })
  markShelterEnteredAt(unit)
  stopUnitForRest(unit)
  unit.dest = null
  unit.action = null
  unit.actionLocked = true
  clearUnitOverheadIndicator(unit)
}

export function waitOutsideForSleep(unit: UnitEntity): void {
  cancelSleepingWakeVisual(unit)
  rememberRestState(unit, { status: 'outside', reason: 'sleep', location: 'outside', shelter: null, targetCell: null })
  stopUnitForRest(unit)
  unit.dest = null
  unit.action = null
  unit.actionLocked = true
  clearSleepingVisualState(unit)
  clearUnitOverheadIndicator(unit)
  unit.setTextures?.(SHEET_TYPES.standing)
  unit.syncAppearanceLayers?.(SHEET_TYPES.standing)
  unit.sprite?.stop?.()
}

export function sleepOutside(
  unit: UnitEntity,
  reason: UnitRestReason = unit.shelterState?.reason ?? 'sleep',
  options: { visual?: SleepOutsideVisualMode } = {}
): void {
  cancelSleepingWakeVisual(unit)
  rememberRestState(unit, { status: 'outside', reason, location: 'outside', shelter: null, targetCell: null })
  cancelFade(unit)
  unit.alpha = 1
  unit.visible = true
  setDetachedShadowsVisible(unit, true)
  stopUnitForRest(unit)
  unit.dest = null
  unit.action = null
  unit.actionLocked = true
  if ((options.visual ?? 'animate') === 'finalFrame') {
    setSleepingOutsideFinalVisual(unit)
  } else {
    playSleepingOutsideVisual(unit)
  }
  setUnitOverheadIndicator(unit, 'sleep')
}

function markShelterEnteredAt(unit: UnitEntity): void {
  const state = unit.shelterState as TimedUnitRestState | null | undefined
  if (!state) return
  state.hiddenAt = unit.context?.scheduler?.elapsedMs ?? 0
}

export function enterShelter(unit: UnitEntity, shelter: BuildingEntity): void {
  prepareUnitInsideShelter(unit, shelter)
  fadeOut(unit, FADE_DURATION_MS, () => hideUnitInsideShelter(unit, shelter))
}

export function enterShelterInstant(unit: UnitEntity, shelter: BuildingEntity): void {
  cancelSleepingWakeVisual(unit)
  prepareUnitInsideShelter(unit, shelter)
  cancelFade(unit)
  hideUnitInsideShelter(unit, shelter)
}

export function putRestingUnitToSleep(unit: UnitEntity, options: { instant?: boolean } = {}): boolean {
  const state = unit.shelterState
  if (!state || state.reason !== 'sleep') return false
  if (state.status === 'inside') {
    unit.actionLocked = true
    if (options.instant) setSleepingOutsideFinalVisual(unit)
    else playSleepingOutsideVisual(unit)
    setUnitOverheadIndicator(unit, 'sleep')
    return true
  }
  if (state.status === 'outside') {
    sleepOutside(unit, 'sleep', { visual: options.instant ? 'finalFrame' : 'animate' })
    return true
  }
  return false
}

function placeUnitAtCell(unit: UnitEntity, cell: RuntimeCell): void {
  const map = unit.context?.map as RuntimeMapWithBuckets | undefined
  const oldI = unit.i
  const oldJ = unit.j
  const space = map ? getMapSpace(map, cell.spaceId) : null
  if (map && space) {
    moveEntityToMapSpace(map, unit, space, cell)
    updateInstanceVisibility(unit)
    return
  }
  const [x, y] = cartesianToIsometric(cell.i, cell.j)
  clearUnitCell(unit)
  unit.i = cell.i
  unit.j = cell.j
  unit.x = x
  unit.y = y
  unit.z = cell.z
  unit.zIndex = getInstanceZIndex(unit)
  unit.currentCell = cell
  cell.place(unit)
  cell.solid = true
  map?.addChild?.(unit)
  map?.addToInstanceBucket?.(unit)
  map?.updateInstanceBucket?.(unit, oldI, oldJ)
  unit.applyReliefLift?.(getGroundReliefLevel(cell), true)
  updateInstanceVisibility(unit)
}

export function sleepOutsideAtCellInstant(
  unit: UnitEntity,
  cell: RuntimeCell,
  reason: UnitRestReason = unit.shelterState?.reason ?? 'sleep'
): void {
  placeUnitAtCell(unit, cell)
  sleepOutside(unit, reason, { visual: 'finalFrame' })
}

function restoreAwakeState(unit: UnitEntity, options: { clearShelterState?: boolean } = {}): void {
  if (options.clearShelterState ?? true) unit.shelterState = null
  unit.actionLocked = false
  unit.alpha = 1
  unit.visible = true
  setDetachedShadowsVisible(unit, true)
  clearUnitOverheadIndicator(unit)
  unit.inactif = true
}

export function getRestReturnTask(unit: UnitEntity, state: UnitRestState | null | undefined = unit.shelterState) {
  if (!state) return null
  const deliveryAction = ACTION_TYPES?.delivery ?? 'delivery'
  const deliveryReturnTask = unit.resourceDeliveryState?.returnTask
  if (state.previousAction === deliveryAction && deliveryReturnTask?.dest) return deliveryReturnTask
  const task = {
    autonomousJob: state.previousAutonomousJob ?? null,
    dest: state.previousDest,
    action: state.previousAction ?? null,
    work: state.previousWork ?? null,
  }
  if (!task.dest && !task.action && !task.work && !task.autonomousJob) return null
  return task
}

function resumeUnitReturnTask(unit: UnitEntity, task = getRestReturnTask(unit)): boolean {
  return resumeVillagerStoredTask(unit, task, { clearMotion: false, exploreWhenNoTarget: true })
}

function resumeStoredReturnTask(unit: UnitEntity, state: UnitRestState): boolean {
  return resumeUnitReturnTask(unit, getRestReturnTask(unit, state))
}

export function finishUnitWakeTransition(unit: UnitEntity, state: UnitRestState): void {
  unit.shelterState = null
  if (resumeStoredReturnTask(unit, state)) return

  if (unit.type !== UNIT_TYPES.villager) return
  unit.autonomousJob = state.previousAutonomousJob ?? unit.autonomousJob ?? null
  if (unit.autonomousJob && resumeStrictVillagerAutonomy(unit, unit.autonomousJob, { exploreWhenNoTarget: true })) return
}

function startUnitWakeTransition(unit: UnitEntity, state: UnitRestState): void {
  const now = unit.context?.scheduler?.elapsedMs ?? 0
  const transitionTargetCell = getRestTransitionCell(unit)
  unit.shelterState = {
    ...state,
    status: 'wakingUp',
    transitionTargetCell,
    transitionUntilMs: now + getRestTransitionDurationMs(unit, 'wakingUp'),
    startedAtMs: now,
    retryCount: 0,
  }
  if (!transitionTargetCell) {
    finishUnitWakeTransition(unit, unit.shelterState)
    return
  }
  unit.sendToEvt?.(transitionTargetCell, null, { forceRepath: true, preserveAutonomy: true })
}

export function startUnitWakeTransitionFromTask(
  unit: UnitEntity,
  task: ReturnType<typeof getRestReturnTask>
): boolean {
  if (!task) return false
  if (unit.context?.restTransitionsEnabled !== true) {
    return resumeUnitReturnTask(unit, task)
  }
  startUnitWakeTransition(unit, {
    status: 'wakingUp',
    reason: 'sleep',
    location: 'outside',
    shelter: null,
    targetCell: null,
    previousAutonomousJob: task.autonomousJob ?? null,
    previousDest: task.dest ?? null,
    previousAction: task.action ?? null,
    previousWork: task.work ?? null,
  })
  return true
}

function resumePreviousActivity(unit: UnitEntity, state: UnitRestState): void {
  const useWakeTransition = unit.context?.restTransitionsEnabled === true
  restoreAwakeState(unit, { clearShelterState: !useWakeTransition })
  fadeIn(unit, FADE_DURATION_MS)
  playSleepingWakeVisual(unit, () => {
    if (useWakeTransition) startUnitWakeTransition(unit, state)
    else finishUnitWakeTransition(unit, state)
  })
}

function wakeWithoutPreviousActivity(unit: UnitEntity, state: UnitRestState, onComplete?: () => void): void {
  unit.suspendedRestState = state
  restoreAwakeState(unit)
  fadeIn(unit, FADE_DURATION_MS)
  playSleepingWakeVisual(unit, onComplete)
}

function restoreVisibleAwakeState(unit: UnitEntity): void {
  restoreAwakeState(unit)
  clearSleepingVisualState(unit)
  cancelFade(unit)
  unit.setTextures?.(SHEET_TYPES.standing)
  unit.syncAppearanceLayers?.(SHEET_TYPES.standing)
  unit.sprite?.stop?.()
  unit.syncShadow?.()
  unit.inactif = true
}

function shouldWakeInsideInteriorSpace(unit: UnitEntity, mode: UnitWakeMode): boolean {
  return mode === 'order' && Boolean(getBuildingInteriorSpaceForUnit(unit))
}

function prepareInsideWakePlacement(
  unit: UnitEntity,
  state: UnitRestState,
  mode: UnitWakeMode,
  force = false
): boolean {
  if (state.status !== 'inside') return true
  const shelter = state.shelter
  if (shouldWakeInsideInteriorSpace(unit, mode)) {
    // The unit is already represented in the active interior space; let the
    // caller route it to the space portal after the wake animation.
    return true
  }
  if (isUsableShelter(shelter, unit.owner)) {
    const targetCell = getShelterEntryCell(unit, shelter)
    if (!targetCell && !force) return false
    if (targetCell) placeUnitAtCell(unit, targetCell)
    return true
  }
  return force
}

export function wakeUnit(
  unit: UnitEntity,
  options: { force?: boolean; mode?: UnitWakeMode; onComplete?: () => void } = {}
): void {
  const state = unit.shelterState
  if (!state) return
  const mode = options.mode ?? 'resume'
  if (!prepareInsideWakePlacement(unit, state, mode, options.force)) return
  if (unit.sleepVisualState !== 'sleeping') {
    setSleepingOutsideFinalVisual(unit)
  }
  if (mode === 'order') {
    wakeWithoutPreviousActivity(unit, state, options.onComplete)
    return
  }
  resumePreviousActivity(unit, state)
}

export function wakeUnitInstant(unit: UnitEntity, options: { force?: boolean; mode?: UnitWakeMode } = {}): void {
  const state = unit.shelterState
  if (!state) return
  const mode = options.mode ?? 'resume'
  if (!prepareInsideWakePlacement(unit, state, mode, options.force)) return

  restoreVisibleAwakeState(unit)
  if (mode === 'order') return
  finishUnitWakeTransition(unit, state)
}

function sendUnitToRestSite(
  unit: UnitEntity,
  reason: UnitRestReason,
  restSite: UnitRestSite,
  options: RestTransitionOptions = {}
): boolean {
  const transition = options.transition ?? unit.context?.restTransitionsEnabled === true
  const transitionTargetCell = transition ? getRestTransitionCell(unit, restSite) : null
  const now = unit.context?.scheduler?.elapsedMs ?? 0
  rememberRestState(unit, {
    status: transition && transitionTargetCell ? 'windingDown' : 'movingToRest',
    reason,
    location: restSite.location,
    shelter: restSite.shelter,
    targetCell: restSite.targetCell,
    transitionTargetCell,
    transitionUntilMs: transition ? now + getRestTransitionDurationMs(unit, 'windingDown') : now,
    transitionStep: 0,
    startedAtMs: now,
    retryCount: 0,
  })
  unit.sendToEvt?.(transitionTargetCell ?? restSite.targetCell, null, {
    forceRepath: true,
    preserveAutonomy: true,
    allowPassageStop: restSite.location === 'shelter' && !transitionTargetCell,
  })
  return true
}

export function sendUnitToRest(
  unit: UnitEntity,
  reason: UnitRestReason,
  options: RestTransitionOptions = {}
): boolean {
  if (reason === 'sleep' && !canStartSleepRest(unit)) return false
  if (
    reason === 'sleep' &&
    unit.type === UNIT_TYPES.villager &&
    !unit.shelterState &&
    !unit.resourceDeliveryState &&
    unitHasDeliverableResources(unit)
  ) {
    rememberRestState(unit, {
      status: 'delivering',
      reason,
      location: 'outside',
      shelter: null,
      targetCell: null,
    })
    if (unit.sendToDelivery?.() === true) return true
    unit.shelterState = null
  }
  const restSite = getNearestRestSite(unit)
  if (!restSite) {
    if (reason === 'sleep' && canSleepWithoutRestSite(unit)) {
      sleepOutside(unit, reason)
      return true
    }
    return false
  }
  if (unit.type === UNIT_TYPES.villager && restSite.location === 'outside') {
    waitOutsideForSleep(unit)
    if (shouldVillagerBeAsleep(unit)) putRestingUnitToSleep(unit)
    return true
  }
  return sendUnitToRestSite(unit, reason, restSite, {
    ...options,
    transition: unit.type === UNIT_TYPES.villager ? false : options.transition,
  })
}

export function continueRestAfterDelivery(unit: UnitEntity): boolean {
  if (unit.shelterState?.reason !== 'sleep' || unit.shelterState.status !== 'delivering') return false
  const state = unit.shelterState
  const restSite = getNearestRestSite(unit)
  if (!restSite || restSite.location === 'outside') {
    waitOutsideForSleep(unit)
    if (shouldVillagerBeAsleep(unit)) putRestingUnitToSleep(unit)
    return true
  }
  unit.shelterState = state
  return sendUnitToRestSite(unit, 'sleep', restSite, { transition: false })
}

export function rerouteRestUnit(unit: UnitEntity): boolean {
  const state = unit.shelterState
  if (!state?.reason) return false
  const restSite = getNearestRestSite(unit)
  if (!restSite || restSite.location === 'outside') {
    waitOutsideForSleep(unit)
    if (shouldVillagerBeAsleep(unit)) putRestingUnitToSleep(unit)
    return true
  }
  unit.shelterState = state
  return sendUnitToRestSite(unit, state.reason, restSite, { transition: false })
}

export function settleUnitRestForTimeJump(unit: UnitEntity, sleep: boolean): boolean {
  if (!unit.shelterState && !sendUnitToRest(unit, 'sleep', { transition: false })) return false
  const state = unit.shelterState
  if (!state) return false
  if (state.status === 'movingToRest' && isUsableShelter(state.shelter, unit.owner)) {
    enterShelterInstant(unit, state.shelter)
  } else if (state.status === 'movingToRest') {
    waitOutsideForSleep(unit)
  }
  if (sleep) putRestingUnitToSleep(unit, { instant: true })
  return true
}

export function retryShelterPath(unit: UnitEntity, state: UnitRestState): boolean {
  if (!state.shelter || !isUsableShelter(state.shelter, unit.owner)) return false
  const retryCount = state.retryCount ?? 0
  if (retryCount >= REST_MAX_RETRIES) return false
  const nextCell = getShelterEntryCell(unit, state.shelter)
  if (!nextCell) return false
  state.targetCell = nextCell
  state.retryCount = retryCount + 1
  state.startedAtMs = unit.context?.scheduler?.elapsedMs ?? state.startedAtMs ?? 0
  unit.sendToEvt?.(nextCell, null, {
    forceRepath: true,
    preserveAutonomy: true,
    allowPassageStop: true,
  })
  return true
}
