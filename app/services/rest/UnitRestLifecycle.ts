import { FADE_DURATION_MS, SHEET_TYPES, UNIT_TYPES } from '../../constants'
import {
  cartesianToIsometric,
  getGroundReliefLevel,
  getInstanceZIndex,
  resumeVillagerAutonomy,
  updateInstanceVisibility,
} from '../../lib'
import { cancelFade, fadeIn, fadeOut } from '../../lib/entities/entityFade'
import { clearUnitOverheadIndicator, setUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import { getMapSpace, moveEntityToMapSpace } from '../../lib/mapSpaces'
import type { BuildingEntity, RuntimeEntity, UnitEntity, UnitRestReason, UnitRestState } from '../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import { getNearestRestSite, getShelterEntryCell, isUsableShelter, REST_MAX_RETRIES } from './UnitRestRules'
import {
  cancelSleepingWakeVisual,
  playSleepingOutsideVisual,
  playSleepingWakeVisual,
  setSleepingOutsideFinalVisual,
  setDetachedShadowsVisible,
} from './UnitSleepVisuals'
import {
  getBuildingInteriorSpaceForBuilding,
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
    const space = getBuildingInteriorSpaceForBuilding(unit.context, shelter)
    if (space && moveUnitToBuildingInteriorSleep(unit.context, unit, space, { mode: 'route' })) return
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

function restoreAwakeState(unit: UnitEntity): void {
  unit.shelterState = null
  unit.actionLocked = false
  unit.alpha = 1
  unit.visible = true
  setDetachedShadowsVisible(unit, true)
  clearUnitOverheadIndicator(unit)
  unit.inactif = true
}

function resumeStoredVillagerActivity(unit: UnitEntity, state: UnitRestState): void {
  if (unit.type !== UNIT_TYPES.villager) return

  unit.autonomousJob = state.previousAutonomousJob ?? null
  if (unit.autonomousJob && resumeVillagerAutonomy(unit)) return

  const previousDest = state.previousDest
  if (previousDest && !(previousDest as RuntimeEntity).isDestroyed) {
    unit.work = state.previousWork ?? unit.work ?? null
    unit.sendToEvt?.(previousDest, state.previousAction ?? null, { forceRepath: true, preserveAutonomy: true })
  }
}

function resumePreviousActivity(unit: UnitEntity, state: UnitRestState): void {
  restoreAwakeState(unit)
  fadeIn(unit, FADE_DURATION_MS)
  playSleepingWakeVisual(unit, () => resumeStoredVillagerActivity(unit, state))
}

function wakeWithoutPreviousActivity(unit: UnitEntity, onComplete?: () => void): void {
  restoreAwakeState(unit)
  fadeIn(unit, FADE_DURATION_MS)
  playSleepingWakeVisual(unit, onComplete)
}

function restoreVisibleAwakeState(unit: UnitEntity): void {
  restoreAwakeState(unit)
  cancelSleepingWakeVisual(unit)
  cancelFade(unit)
  unit.setTextures?.(SHEET_TYPES.standing)
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
  if (mode === 'order') {
    wakeWithoutPreviousActivity(unit, options.onComplete)
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
  resumeStoredVillagerActivity(unit, state)
}

export function sendUnitToRest(unit: UnitEntity, reason: UnitRestReason): boolean {
  const restSite = getNearestRestSite(unit)
  if (!restSite) {
    if (reason === 'sleep') sleepOutside(unit, reason)
    return reason === 'sleep'
  }
  rememberRestState(unit, {
    status: 'movingToRest',
    reason,
    location: restSite.location,
    shelter: restSite.shelter,
    targetCell: restSite.targetCell,
    startedAtMs: unit.context?.scheduler?.elapsedMs ?? 0,
    retryCount: 0,
  })
  unit.sendToEvt?.(restSite.targetCell, null, {
    forceRepath: true,
    preserveAutonomy: true,
    allowPassageStop: restSite.location === 'shelter',
  })
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
