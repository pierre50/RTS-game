import { SHEET_TYPES } from '../../app/constants'
import { sameBuilding } from '../../app/lib/buildings/identity'
import { clearUnitOverheadIndicator, setUnitOverheadIndicator } from '../../app/lib/entities/overheadIndicator'
import { moveEntityToMapSpace } from '../../app/lib/mapSpaces'
import { shouldVillagerBeAsleep } from '../../app/lib/units/villagerSchedule'
import { applyBuildingInteriorIdleFacing } from '../../app/services/buildingInterior/InteriorIdleFacing'
import { setDetachedShadowsVisible, setSleepingOutsideFinalVisual } from '../../app/services/rest/UnitSleepVisuals'
import { prepareUnitForSpaceTransfer, transferUnitThroughSpacePortal } from '../../app/services/SpacePortalSystem'
import type { GameContextLike } from '../../app/types/context'
import type { UnitEntity } from '../../app/types/entities'
import type { RuntimeCell } from '../../app/types/map'
import { findSleepCell } from './BuildingInteriorSpaceLayout'
import type { BuildingInteriorRuntimeSpace } from './BuildingInteriorSpaceTypes'

export function moveUnitToBuildingInteriorSleep(
  context: GameContextLike,
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace,
  options: { mode?: 'instant' | 'route'; sleep?: boolean } = {}
): boolean {
  const state = unit.shelterState
  if (state?.reason !== 'sleep' || !sameBuilding(state.shelter, space.building)) return false
  const cell = findSleepCell(space, unit)
  if (!cell) return false
  if ((options.mode ?? 'instant') === 'route') {
    if (!transferUnitThroughSpacePortal(context, unit, space.entryPortal)) return false
    unit.shelterState = {
      ...state,
      status: 'movingToRest',
      location: 'shelter',
      shelter: space.building,
      targetCell: cell ?? null,
      startedAtMs: context.scheduler?.elapsedMs ?? 0,
      retryCount: 0,
    }
    unit.inactif = true
    setDetachedShadowsVisible(unit, true)
    if (unit.i === cell.i && unit.j === cell.j) {
      settleUnitAtBuildingInteriorSleepCell(unit, space, cell, options)
    } else {
      unit.sendToEvt?.(cell, null, { forceRepath: true, preserveAutonomy: true })
    }
    return true
  }
  prepareUnitForSpaceTransfer(unit)
  moveEntityToMapSpace(context.map, unit, space, cell)
  settleUnitAtBuildingInteriorSleepCell(unit, space, cell, options)
  return true
}

export function settleUnitAtBuildingInteriorSleepCell(
  unit: UnitEntity,
  space: BuildingInteriorRuntimeSpace,
  cell: RuntimeCell | null | undefined = unit.currentCell,
  options: { sleep?: boolean } = {}
): void {
  const state = unit.shelterState
  unit.shelterState = {
    ...state,
    status: 'inside',
    location: 'shelter',
    shelter: space.building,
    targetCell: cell ?? null,
  }
  unit.actionLocked = true
  unit.inactif = true
  setDetachedShadowsVisible(unit, true)
  applyBuildingInteriorIdleFacing(unit, space, cell)
  const sleeping = options.sleep ?? shouldVillagerBeAsleep(unit)
  if (sleeping) {
    setSleepingOutsideFinalVisual(unit)
    setUnitOverheadIndicator(unit, 'sleep')
  } else {
    clearUnitOverheadIndicator(unit)
    unit.setTextures?.(SHEET_TYPES.standing)
    unit.syncAppearanceLayers?.(SHEET_TYPES.standing)
    unit.sprite?.stop?.()
  }
}

export function syncBuildingInteriorShelterOccupants(
  context: GameContextLike,
  space: BuildingInteriorRuntimeSpace
): void {
  for (const unit of space.building.owner?.units ?? []) {
    if (unit.isDead || unit.isDestroyed || unit === context.controls?.heroUnit) continue
    const state = unit.shelterState
    if (state?.status !== 'inside' || state.reason !== 'sleep' || !sameBuilding(state.shelter, space.building)) {
      continue
    }
    moveUnitToBuildingInteriorSleep(context, unit, space)
  }
}
