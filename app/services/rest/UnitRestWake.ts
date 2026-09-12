import { ACTION_TYPES, FADE_DURATION_MS, SHEET_TYPES, UNIT_TYPES } from '../../constants'
import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { cancelFade, fadeIn } from '../../lib/entities/entityFade'
import { clearUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import { resumeStrictVillagerAutonomy, resumeVillagerStoredTask } from '../../lib/units/villagerTaskRecovery'
import { getMinutesUntilVillagerWorkStarts, shouldVillagerWork } from '../../lib/units/villagerSchedule'
import type { UnitEntity, UnitRestState } from '../../types/entities'
import { getBuildingInteriorSpaceForUnit } from '../BuildingInteriorSpaceSystem'
import {
  getRestTransitionCell,
  getRestTransitionDurationMs,
  getShelterEntryCell,
  isUsableShelter,
} from './UnitRestRules'
import { placeUnitAtCell } from './UnitRestState'
import { clearSleepingVisualState, playSleepingWakeVisual, setDetachedShadowsVisible } from './UnitSleepVisuals'

type UnitWakeMode = 'resume' | 'order'

const GAME_MINUTE_MS = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay / 60

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
    dest: state.previousDest ?? null,
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
  if (unit.type === UNIT_TYPES.villager && !shouldVillagerWork(unit)) {
    unit.autonomousJob = state.previousAutonomousJob ?? unit.autonomousJob ?? null
    return
  }
  if (resumeStoredReturnTask(unit, state)) return

  if (unit.type !== UNIT_TYPES.villager) return
  unit.autonomousJob = state.previousAutonomousJob ?? unit.autonomousJob ?? null
  if (unit.autonomousJob && resumeStrictVillagerAutonomy(unit, unit.autonomousJob, { exploreWhenNoTarget: true }))
    return
}

function startUnitWakeTransition(unit: UnitEntity, state: UnitRestState): void {
  const now = unit.context?.scheduler?.elapsedMs ?? 0
  const transitionTargetCell = getRestTransitionCell(unit)
  const transitionDurationMs = Math.max(
    getRestTransitionDurationMs(unit, 'wakingUp'),
    unit.type === UNIT_TYPES.villager ? getMinutesUntilVillagerWorkStarts(unit) * GAME_MINUTE_MS : 0
  )
  unit.shelterState = {
    ...state,
    status: 'wakingUp',
    transitionTargetCell,
    transitionUntilMs: now + transitionDurationMs,
    startedAtMs: now,
    retryCount: 0,
  }
  if (!transitionTargetCell && transitionDurationMs <= 0) {
    finishUnitWakeTransition(unit, unit.shelterState)
    return
  }
  if (transitionTargetCell) unit.sendToEvt?.(transitionTargetCell, null, { forceRepath: true, preserveAutonomy: true })
}

export function startUnitWakeTransitionFromTask(unit: UnitEntity, task: ReturnType<typeof getRestReturnTask>): boolean {
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
  finishWakeVisual(unit, () => {
    if (useWakeTransition) startUnitWakeTransition(unit, state)
    else finishUnitWakeTransition(unit, state)
  })
}

function wakeWithoutPreviousActivity(unit: UnitEntity, state: UnitRestState, onComplete?: () => void): void {
  unit.suspendedRestState = state
  restoreAwakeState(unit)
  finishWakeVisual(unit, onComplete)
}

function restoreAwakeVisual(unit: UnitEntity): void {
  clearSleepingVisualState(unit)
  cancelFade(unit)
  unit.setTextures?.(SHEET_TYPES.standing)
  unit.syncAppearanceLayers?.(SHEET_TYPES.standing)
  unit.sprite?.stop?.()
  unit.syncShadow?.()
}

function finishWakeVisual(unit: UnitEntity, onComplete?: () => void): void {
  // Evening rest also uses reason 'sleep' while the villager is still standing.
  if (unit.sleepVisualState === 'sleeping') {
    fadeIn(unit, FADE_DURATION_MS)
    playSleepingWakeVisual(unit, onComplete)
    return
  }
  restoreAwakeVisual(unit)
  onComplete?.()
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

  restoreAwakeState(unit)
  restoreAwakeVisual(unit)
  if (mode === 'order') return
  finishUnitWakeTransition(unit, state)
}
