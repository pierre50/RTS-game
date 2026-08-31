import { getCellsAroundPoint } from '../grid/cells'
import { getInstancePath } from '../grid/movement'
import { getCellSpaceId, getEntitySpaceMapLike } from '../mapSpaces'
import { isHeroControlled } from '../units/unitControl'
import { getBuildingInteriorEntryCell } from './interiors'
import { getKnownBuildings, type KnownBuildingsContext } from './knownBuildings'
import type { UnitEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMap, RuntimeMapSpace } from '../../types/map'

const DEFAULT_PASSAGE_WAIT_MAX_DISTANCE = 5

type PassageMapLike = {
  grid?: RuntimeCell[][] | null
  spaces?: RuntimeMap['spaces'] | null
}

type PassageMapContext = {
  map?: PassageMapLike | null
}

export type PassageContext = (KnownBuildingsContext & PassageMapContext) | null | undefined

export type PassageStopOptions = {
  allowPassageStop?: boolean
  passageLookup?: ReservedPassageCellLookup
}

export type ReservedPassageCellLookup = {
  has(cell: RuntimeCell | null | undefined): boolean
  size: number
}

function passageCellKey(cell: RuntimeCell | null | undefined): string | null {
  if (!cell) return null
  return `${getCellSpaceId(cell)}:${cell.i}:${cell.j}`
}

function samePassageCell(a: RuntimeCell | null | undefined, b: RuntimeCell | null | undefined): boolean {
  const aKey = passageCellKey(a)
  const bKey = passageCellKey(b)
  return Boolean(aKey && bKey && aKey === bKey)
}

function addPassageCellKey(keys: Set<string>, cell: RuntimeCell | null | undefined): void {
  const key = passageCellKey(cell)
  if (key) keys.add(key)
}

function addRuntimePortalCells(keys: Set<string>, map: PassageMapLike | null | undefined): void {
  for (const space of map?.spaces?.values?.() ?? []) {
    for (const portal of space.portals ?? []) {
      addPassageCellKey(keys, portal.sourceCell)
      addPassageCellKey(keys, portal.targetCell)
    }
  }
}

export function isRuntimeMapSpacePassageCell(
  space: Pick<RuntimeMapSpace, 'entryCell' | 'exitCell' | 'portals'> | null | undefined,
  cell: RuntimeCell | null | undefined
): boolean {
  if (!space || !cell) return false
  if (samePassageCell(space.entryCell, cell) || samePassageCell(space.exitCell, cell)) return true
  return Boolean(
    space.portals?.some(portal => samePassageCell(portal.sourceCell, cell) || samePassageCell(portal.targetCell, cell))
  )
}

function addBuildingInteriorEntryCells(keys: Set<string>, context: PassageContext): void {
  const map = context?.map
  if (!context || !map?.grid) return
  for (const building of getKnownBuildings(context)) {
    addPassageCellKey(keys, getBuildingInteriorEntryCell(building, map.grid))
  }
}

export function createReservedPassageCellLookup(context: PassageContext): ReservedPassageCellLookup {
  const keys = new Set<string>()
  addRuntimePortalCells(keys, context?.map)
  addBuildingInteriorEntryCells(keys, context)
  return {
    has(cell) {
      const key = passageCellKey(cell)
      return Boolean(key && keys.has(key))
    },
    size: keys.size,
  }
}

export function createNonReservedPassageCellCondition(context: PassageContext): (cell: RuntimeCell) => boolean {
  const lookup = createReservedPassageCellLookup(context)
  return cell => !lookup.has(cell)
}

type PassageEntity = {
  context?: UnitEntity['context']
  currentCell?: RuntimeCell | null
  family?: string
  i: number
  j: number
  label?: string
  sendTo?: (cell: RuntimeCell, action?: string, options?: { forceRepath?: boolean }) => void
  sendToEvt?: UnitEntity['sendToEvt']
  spaceId?: string | null
}

function canEntityStopOnReservedPassageCell(entity: PassageEntity, options: PassageStopOptions = {}): boolean {
  if (options.allowPassageStop) return true
  return entity.family === 'unit' && isHeroControlled(entity as UnitEntity)
}

export function shouldEntityAvoidPassageStop(
  entity: PassageEntity,
  cell: RuntimeCell | null | undefined,
  options: PassageStopOptions = {}
): boolean {
  if (!cell || canEntityStopOnReservedPassageCell(entity, options)) return false
  const lookup = options.passageLookup ?? createReservedPassageCellLookup(entity.context)
  return lookup.has(cell)
}

export function shouldUnitAvoidPassageStop(
  unit: UnitEntity,
  cell: RuntimeCell | null | undefined,
  options: PassageStopOptions = {}
): boolean {
  return shouldEntityAvoidPassageStop(unit, cell, options)
}

function entityHasActivePassageStopIntent(
  entity: PassageEntity,
  cell: RuntimeCell | null | undefined
): boolean {
  if (!cell) return false
  const restState = (entity as UnitEntity).shelterState
  if (restState?.status === 'movingToRest' && samePassageCell(restState.targetCell, cell)) return true
  if (samePassageCell((entity as UnitEntity).spacePortalState?.sourceCell, cell)) return true
  if (samePassageCell((entity as UnitEntity).interiorExitState?.targetCell, cell)) return true
  return false
}

export function unitHasActivePassageStopIntent(unit: UnitEntity, cell: RuntimeCell | null | undefined): boolean {
  return entityHasActivePassageStopIntent(unit, cell)
}

function canEntityWaitOnCell(
  entity: PassageEntity,
  cell: RuntimeCell | null | undefined,
  options: PassageStopOptions = {}
): cell is RuntimeCell {
  if (!cell) return false
  if (shouldEntityAvoidPassageStop(entity, cell, options)) return false
  if (cell.terrainHidden || cell.category === 'Water') return false
  if (cell.border && (!cell.waterBorder || cell.solid)) return false
  if (!cell.solid) return true
  return Boolean(cell.has && (cell.has === entity || cell.has.label === entity.label || cell.has.isDestroyed))
}

export function canUnitWaitOnCell(
  unit: UnitEntity,
  cell: RuntimeCell | null | undefined,
  options: PassageStopOptions = {}
): cell is RuntimeCell {
  return canEntityWaitOnCell(unit, cell, options)
}

export function canEntityUseCellAsIdleDestination(
  entity: PassageEntity,
  cell: RuntimeCell | null | undefined,
  options: PassageStopOptions = {}
): cell is RuntimeCell {
  if (!canEntityWaitOnCell(entity, cell, options)) return false
  if (cell.waterBorder) return false
  const occupant = cell.has
  return Boolean(!occupant || occupant === entity || occupant.label === entity.label || occupant.isDestroyed)
}

export function canUnitUseCellAsIdleDestination(
  unit: UnitEntity,
  cell: RuntimeCell | null | undefined,
  options: PassageStopOptions = {}
): cell is RuntimeCell {
  return canEntityUseCellAsIdleDestination(unit, cell, options)
}

export function canUseReservedPassageCellForTransit(
  cell: RuntimeCell | null | undefined,
  passageLookup: ReservedPassageCellLookup
): cell is RuntimeCell {
  if (!cell || !passageLookup.has(cell)) return false
  if (cell.terrainHidden || cell.category === 'Water') return false
  return !cell.border || Boolean(cell.waterBorder && !cell.solid)
}

export function findNearestPassageWaitingCell(
  entity: PassageEntity,
  passageCell: RuntimeCell | null | undefined = entity.currentCell,
  options: PassageStopOptions & { maxDistance?: number } = {}
): { cell: RuntimeCell; path: RuntimeCell[] } | null {
  if (!passageCell) return null
  const map = getEntitySpaceMapLike(entity, entity.context?.map)
  if (!map) return null
  const lookup = options.passageLookup ?? createReservedPassageCellLookup(entity.context)
  const maxDistance = Math.max(1, Math.floor(options.maxDistance ?? DEFAULT_PASSAGE_WAIT_MAX_DISTANCE))

  for (let distance = 1; distance <= maxDistance; distance++) {
    const cells = getCellsAroundPoint(passageCell.i, passageCell.j, map.grid, distance, cell =>
      canEntityWaitOnCell(entity, cell, { passageLookup: lookup })
    )
    cells.sort(
      (a, b) =>
        Math.abs(a.i - passageCell.i) +
          Math.abs(a.j - passageCell.j) -
          (Math.abs(b.i - passageCell.i) + Math.abs(b.j - passageCell.j)) ||
        Math.abs(a.i - entity.i) + Math.abs(a.j - entity.j) - (Math.abs(b.i - entity.i) + Math.abs(b.j - entity.j))
    )

    for (const cell of cells) {
      const path = getInstancePath(entity, cell.i, cell.j, map)
      if (path.length) return { cell, path }
    }
  }
  return null
}

export function routeUnitAwayFromPassageCell(
  unit: UnitEntity,
  passageCell: RuntimeCell | null | undefined = unit.currentCell
): boolean {
  if (!shouldEntityAvoidPassageStop(unit, passageCell)) return false
  const waitingCell = findNearestPassageWaitingCell(unit, passageCell)
  if (!waitingCell) return false
  unit.sendToEvt?.(waitingCell.cell, null, { forceRepath: true, preserveAutonomy: true })
  return true
}

export function routeEntityAwayFromPassageCell(
  entity: PassageEntity,
  passageCell: RuntimeCell | null | undefined = entity.currentCell
): boolean {
  if (!shouldEntityAvoidPassageStop(entity, passageCell)) return false
  const waitingCell = findNearestPassageWaitingCell(entity, passageCell)
  if (!waitingCell) return false
  if (entity.family === 'unit') {
    entity.sendToEvt?.(waitingCell.cell, null, { forceRepath: true, preserveAutonomy: true })
  } else {
    entity.sendTo?.(waitingCell.cell, undefined, { forceRepath: true })
  }
  return true
}
