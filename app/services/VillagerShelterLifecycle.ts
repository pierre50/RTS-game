import { FADE_DURATION_MS } from '../constants'
import {
  cartesianToIsometric,
  getGroundReliefLevel,
  getInstanceZIndex,
  resumeVillagerAutonomy,
  updateInstanceVisibility,
} from '../lib'
import { cancelFade, fadeIn, fadeOut } from '../lib/entities/entityFade'
import { clearUnitOverheadIndicator, setUnitOverheadIndicator } from '../lib/entities/overheadIndicator'
import type { BuildingEntity, RuntimeEntity, UnitEntity, VillagerShelterReason, VillagerShelterState } from '../types/entities'
import type { RuntimeCell, RuntimeMap } from '../types/map'
import {
  getNearestShelter,
  getShelterEntryCell,
  isUsableShelter,
  SHELTER_MAX_RETRIES,
} from './VillagerShelterRules'
import {
  cancelSleepingWakeVisual,
  playSleepingOutsideVisual,
  playSleepingWakeVisual,
  setSleepingOutsideFinalVisual,
  setDetachedShadowsVisible,
} from './VillagerSleepVisuals'

type RuntimeMapWithBuckets = RuntimeMap & {
  addChild?: (child: UnitEntity) => void
  removeFromInstanceBucket?: (entity: RuntimeEntity) => void
  addToInstanceBucket?: (entity: RuntimeEntity) => void
  updateInstanceBucket?: (entity: RuntimeEntity, oldI: number, oldJ: number) => void
}

export type TimedVillagerShelterState = VillagerShelterState & { hiddenAt?: number }
export type VillagerWakeMode = 'resume' | 'order'
export type SleepOutsideVisualMode = 'animate' | 'finalFrame'

function rememberShelterState(
  unit: UnitEntity,
  state: Omit<VillagerShelterState, 'previousDest' | 'previousWork' | 'previousAction' | 'previousAutonomousJob'>
): VillagerShelterState {
  const existing = unit.shelterState
  const shelterState: VillagerShelterState = {
    ...state,
    reason: state.reason ?? existing?.reason ?? 'sleep',
    previousDest: existing?.previousDest ?? unit.dest ?? null,
    previousWork: existing?.previousWork ?? unit.work ?? null,
    previousAction: existing?.previousAction ?? unit.action ?? null,
    previousAutonomousJob: existing?.previousAutonomousJob ?? unit.autonomousJob ?? null,
  }
  unit.shelterState = shelterState
  return shelterState
}

function clearUnitCell(unit: UnitEntity): void {
  const cell = unit.currentCell
  if (cell?.has === unit || cell?.has?.label === unit.label) {
    cell.has = null
    cell.solid = false
  }
}

function stopUnitForShelter(unit: UnitEntity): void {
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
  clearUnitCell(unit)
  map?.removeFromInstanceBucket?.(unit)
  setDetachedShadowsVisible(unit, false)
  unit.alpha = 0
  unit.visible = false
}

export function sleepOutside(
  unit: UnitEntity,
  reason: VillagerShelterReason = unit.shelterState?.reason ?? 'sleep',
  options: { visual?: SleepOutsideVisualMode } = {}
): void {
  cancelSleepingWakeVisual(unit)
  rememberShelterState(unit, { status: 'outside', reason, location: 'outside', shelter: null, targetCell: null })
  cancelFade(unit)
  unit.alpha = 1
  unit.visible = true
  setDetachedShadowsVisible(unit, true)
  stopUnitForShelter(unit)
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
  const state = unit.shelterState as TimedVillagerShelterState | null | undefined
  if (!state) return
  state.hiddenAt = unit.context?.scheduler?.elapsedMs ?? 0
}

export function enterShelter(unit: UnitEntity, shelter: BuildingEntity): void {
  rememberShelterState(unit, {
    status: 'inside',
    reason: unit.shelterState?.reason ?? 'sleep',
    location: 'shelter',
    shelter,
    targetCell: null,
  })
  markShelterEnteredAt(unit)
  stopUnitForShelter(unit)
  unit.dest = null
  unit.action = null
  unit.actionLocked = true
  clearUnitOverheadIndicator(unit)
  fadeOut(unit, FADE_DURATION_MS, () => hideUnitInsideShelter(unit, shelter))
}

function placeUnitAtCell(unit: UnitEntity, cell: RuntimeCell): void {
  const map = unit.context?.map as RuntimeMapWithBuckets | undefined
  const oldI = unit.i
  const oldJ = unit.j
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

function resumePreviousActivity(unit: UnitEntity, state: VillagerShelterState): void {
  unit.shelterState = null
  unit.actionLocked = false
  unit.alpha = 1
  setDetachedShadowsVisible(unit, true)
  clearUnitOverheadIndicator(unit)
  unit.inactif = true
  fadeIn(unit, FADE_DURATION_MS)

  playSleepingWakeVisual(unit, () => {
    unit.autonomousJob = state.previousAutonomousJob ?? null
    if (unit.autonomousJob && resumeVillagerAutonomy(unit)) return

    const previousDest = state.previousDest
    if (previousDest && !(previousDest as RuntimeEntity).isDestroyed) {
      unit.work = state.previousWork ?? unit.work ?? null
      unit.sendToEvt?.(previousDest, state.previousAction ?? null, { forceRepath: true, preserveAutonomy: true })
    }
  })
}

function wakeWithoutPreviousActivity(unit: UnitEntity, onComplete?: () => void): void {
  unit.shelterState = null
  unit.actionLocked = false
  unit.alpha = 1
  setDetachedShadowsVisible(unit, true)
  clearUnitOverheadIndicator(unit)
  unit.inactif = true
  fadeIn(unit, FADE_DURATION_MS)
  playSleepingWakeVisual(unit, onComplete)
}

export function wakeUnit(
  unit: UnitEntity,
  options: { force?: boolean; mode?: VillagerWakeMode; onComplete?: () => void } = {}
): void {
  const state = unit.shelterState
  if (!state) return
  if (state.status === 'inside') {
    const shelter = state.shelter
    if (isUsableShelter(shelter, unit.owner)) {
      const targetCell = getShelterEntryCell(unit, shelter)
      if (!targetCell && !options.force) return
      if (targetCell) placeUnitAtCell(unit, targetCell)
    } else if (!options.force) {
      return
    }
  }
  if ((options.mode ?? 'resume') === 'order') {
    wakeWithoutPreviousActivity(unit, options.onComplete)
    return
  }
  resumePreviousActivity(unit, state)
}

export function sendUnitToShelter(unit: UnitEntity, reason: VillagerShelterReason): boolean {
  const shelter = getNearestShelter(unit, reason)
  if (!shelter) {
    if (reason === 'sleep') sleepOutside(unit, reason)
    return reason === 'sleep'
  }
  rememberShelterState(unit, {
    status: 'movingToShelter',
    reason,
    location: 'shelter',
    shelter: shelter.shelter,
    targetCell: shelter.targetCell,
    startedAtMs: unit.context?.scheduler?.elapsedMs ?? 0,
    retryCount: 0,
  })
  unit.sendToEvt?.(shelter.targetCell, null, { forceRepath: true, preserveAutonomy: true })
  return true
}

export function retryShelterPath(unit: UnitEntity, state: VillagerShelterState): boolean {
  if (!state.shelter || !isUsableShelter(state.shelter, unit.owner)) return false
  const retryCount = state.retryCount ?? 0
  if (retryCount >= SHELTER_MAX_RETRIES) return false
  const nextCell = getShelterEntryCell(unit, state.shelter)
  if (!nextCell) return false
  state.targetCell = nextCell
  state.retryCount = retryCount + 1
  state.startedAtMs = unit.context?.scheduler?.elapsedMs ?? state.startedAtMs ?? 0
  unit.sendToEvt?.(nextCell, null, { forceRepath: true, preserveAutonomy: true })
  return true
}
