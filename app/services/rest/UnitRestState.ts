import { cartesianToIsometric, getGroundReliefLevel, getInstanceZIndex, updateInstanceVisibility } from '../../lib'
import { getMapSpace, moveEntityToMapSpace } from '../../lib/mapSpaces'
import type { RuntimeEntity, UnitEntity, UnitRestState } from '../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../types/map'

export type RuntimeMapWithBuckets = RuntimeMap & {
  addChild?: (child: UnitEntity) => void
  removeFromInstanceBucket?: (entity: RuntimeEntity) => void
  addToInstanceBucket?: (entity: RuntimeEntity) => void
  updateInstanceBucket?: (entity: RuntimeEntity, oldI: number, oldJ: number) => void
}

export function rememberRestState(
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

export function clearUnitCell(unit: UnitEntity): void {
  const cell = unit.currentCell
  if (cell && (cell.has === unit || (unit.label != null && cell.has?.label === unit.label))) {
    cell.has = null
    cell.solid = false
  }
}

export function stopUnitForRest(unit: UnitEntity): void {
  unit.stopInterval?.()
  unit.stopTimeout?.()
  unit.path = []
  unit.realDest = null
  unit.pendingOrder = null
  unit.blockedGatherApproach = null
  unit.inactif = true
}

export function placeUnitAtCell(unit: UnitEntity, cell: RuntimeCell): void {
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
