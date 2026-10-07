import { BUILDING_TYPES, SHEET_TYPES } from '../../constants'
import { createReservedPassageCellLookup } from '../../lib/buildings/passageCells'
import { getEntityCell, getEntitySpaceMapLike, sameCellMapSpace } from '../../lib/mapSpaces'
import { getBedRestPoint } from '../../lib/terrain/furnitureSurface'
import { syncEntityRelief } from '../../lib/terrain/reliefSurface'
import { findRestCellAroundPoint } from './UnitRestShelter'
import { cancelFade } from '../../lib/entities/entityFade'
import { clearUnitOverheadIndicator, setUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import type { UnitEntity, UnitRestReason, UnitRestState } from '../../types/entities'
import { placeUnitAtCell, rememberRestState, stopUnitForRest } from './UnitRestState'
import {
  cancelSleepingWakeVisual,
  clearSleepingVisualState,
  playSleepingOutsideVisual,
  setDetachedShadowsVisible,
  setSleepingOutsideFinalVisual,
} from './UnitSleepVisuals'

export type TimedUnitRestState = UnitRestState & { hiddenAt?: number }

export type SleepOutsideVisualMode = 'animate' | 'finalFrame'

function leavePassageBeforeRest(unit: UnitEntity, reason: UnitRestReason, instant = false): boolean {
  const passages = createReservedPassageCellLookup(unit.context)
  if (!passages.has(getEntityCell(unit, unit.context?.map))) return false
  const targetCell = findRestCellAroundPoint(unit, unit, 5)
  cancelSleepingWakeVisual(unit)
  cancelFade(unit)
  unit.alpha = 1
  unit.visible = true
  setDetachedShadowsVisible(unit, true)
  clearSleepingVisualState(unit)
  clearUnitOverheadIndicator(unit)
  stopUnitForRest(unit)
  unit.actionLocked = false
  unit.dest = null
  unit.action = null
  if (instant && targetCell) {
    placeUnitAtCell(unit, targetCell)
    return false
  }
  rememberRestState(unit, {
    status: 'movingToRest',
    reason,
    location: 'outside',
    shelter: null,
    targetCell,
    startedAtMs: unit.context?.scheduler?.elapsedMs ?? 0,
    retryCount: 0,
  })
  if (targetCell) unit.sendToEvt?.(targetCell, null, { forceRepath: true, preserveAutonomy: true })
  return true
}

function settledRestTarget(unit: UnitEntity) {
  const state = unit.shelterState
  const cell = state?.targetCell
  if (!state?.restTarget || !cell || !sameCellMapSpace(unit, cell) || unit.i !== cell.i || unit.j !== cell.j)
    return { location: 'outside' as const, shelter: null, restTarget: null, targetCell: null }
  if (state.restTarget.type === BUILDING_TYPES.campBedroll) {
    Object.assign(unit, getBedRestPoint(state.restTarget))
    syncEntityRelief(getEntitySpaceMapLike(unit, unit.context?.map), unit)
  }
  return { location: state.location, shelter: state.shelter, restTarget: state.restTarget, targetCell: cell }
}

export function waitOutsideForSleep(unit: UnitEntity, options: { instant?: boolean } = {}): void {
  if (leavePassageBeforeRest(unit, 'sleep', options.instant)) return
  cancelSleepingWakeVisual(unit)
  rememberRestState(unit, { status: 'outside', reason: 'sleep', ...settledRestTarget(unit) })
  stopUnitForRest(unit)
  unit.dest = null
  unit.action = null
  unit.actionLocked = true
  clearSleepingVisualState(unit)
  clearUnitOverheadIndicator(unit)
  unit.setTextures?.(SHEET_TYPES.standing)
  unit.syncAppearanceLayers?.(unit.currentSheet ?? SHEET_TYPES.standing)
  unit.sprite?.stop?.()
}

export function sleepOutside(
  unit: UnitEntity,
  reason: UnitRestReason = unit.shelterState?.reason ?? 'sleep',
  options: { visual?: SleepOutsideVisualMode } = {}
): void {
  if (leavePassageBeforeRest(unit, reason, options.visual === 'finalFrame')) return
  cancelSleepingWakeVisual(unit)
  rememberRestState(unit, { status: 'outside', reason, ...settledRestTarget(unit) })
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

export function putRestingUnitToSleep(unit: UnitEntity, options: { instant?: boolean } = {}): boolean {
  const state = unit.shelterState
  if (!state || state.reason !== 'sleep') return false
  if (state.status === 'inside') {
    if (createReservedPassageCellLookup(unit.context).has(getEntityCell(unit, unit.context?.map))) return false
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
