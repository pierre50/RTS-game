import { FADE_DURATION_MS, SHEET_TYPES } from '../../constants'
import { isBuildingInteriorSupported } from '../../lib/buildings/interiors'
import { cancelFade, fadeOut } from '../../lib/entities/entityFade'
import { clearUnitOverheadIndicator, setUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import type { BuildingEntity, UnitEntity, UnitRestReason, UnitRestState } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import { ensureRuntimeBuildingInteriorSpace, moveUnitToBuildingInteriorSleep } from '../BuildingInteriorSpaceSystem'
import {
  clearUnitCell,
  placeUnitAtCell,
  rememberRestState,
  stopUnitForRest,
  type RuntimeMapWithBuckets,
} from './UnitRestState'
import {
  cancelSleepingWakeVisual,
  clearSleepingVisualState,
  playSleepingOutsideVisual,
  setDetachedShadowsVisible,
  setSleepingOutsideFinalVisual,
} from './UnitSleepVisuals'

export type TimedUnitRestState = UnitRestState & { hiddenAt?: number }

export type SleepOutsideVisualMode = 'animate' | 'finalFrame'

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

export function sleepOutsideAtCellInstant(
  unit: UnitEntity,
  cell: RuntimeCell,
  reason: UnitRestReason = unit.shelterState?.reason ?? 'sleep'
): void {
  placeUnitAtCell(unit, cell)
  sleepOutside(unit, reason, { visual: 'finalFrame' })
}
