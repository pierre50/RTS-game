import { FAMILY_TYPES } from '../constants'
import { getEntitySpaceId, getMapSpace, moveEntityToMapSpace, sameCellMapSpace } from '../lib/mapSpaces'
import {
  createReservedPassageCellLookup,
  findNearestPassageWaitingCell,
  routeUnitAwayFromPassageCell,
} from '../lib/buildings/passageCells'
import { getCellsAroundPoint } from '../lib/grid/cells'
import { updateInstanceRenderVisibility, updateInstanceVisibility } from '../lib/grid/visibility'
import { isHeroControlled } from '../lib/units/unitControl'
import type { GameContextLike } from '../types/context'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell, RuntimeMapSpacePortal } from '../types/map'

const SPACE_PORTAL_CHECK_INTERVAL_MS = 250

export type SpacePortalRouteOptions = {
  onTransferred?: (() => void) | null
}

function sameGridPosition(
  a: Pick<UnitEntity, 'i' | 'j'> | RuntimeCell | null | undefined,
  b: RuntimeCell | null | undefined
): boolean {
  return Boolean(a && b && a.i === b.i && a.j === b.j)
}

function isPortalCell(cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  return Boolean(cell && !cell.terrainHidden && !cell.border && !cell.waterBorder && cell.category !== 'Water')
}

function canOccupyPortalCell(cell: RuntimeCell | null | undefined, unit: UnitEntity): cell is RuntimeCell {
  if (!isPortalCell(cell)) return false
  return !cell.solid || cell.has === unit || cell.has?.label === unit.label
}

function canUsePortalArrivalCell(
  context: GameContextLike,
  cell: RuntimeCell | null | undefined,
  unit: UnitEntity
): cell is RuntimeCell {
  if (!isPortalCell(cell)) return false
  if (createReservedPassageCellLookup(context).has(cell)) return false
  return !cell.solid || cell.has === unit || cell.has?.label === unit.label || cell.has?.isDestroyed === true
}

function unitIsOnCell(unit: UnitEntity, cell: RuntimeCell | null | undefined): boolean {
  return Boolean(
    cell && sameCellMapSpace(unit, cell) && (sameGridPosition(unit.currentCell, cell) || sameGridPosition(unit, cell))
  )
}

function targetPortalCellIsBlocked(portal: RuntimeMapSpacePortal, unit: UnitEntity): boolean {
  return !canOccupyPortalCell(portal.targetCell, unit)
}

function getBlockingUnit(cell: RuntimeCell | null | undefined, unit: UnitEntity): UnitEntity | null {
  const occupant = cell?.has
  if (!occupant || occupant === unit || occupant.label === unit.label) return null
  if (occupant.family !== 'unit' && typeof (occupant as UnitEntity).sendToEvt !== 'function') return null
  const blocker = occupant as UnitEntity
  if (blocker.isDead || blocker.isDestroyed || isHeroControlled(blocker)) return null
  return blocker
}

function routePortalCellBlockerAway(cell: RuntimeCell | null | undefined, unit: UnitEntity): boolean {
  const blocker = getBlockingUnit(cell, unit)
  return blocker ? routeUnitAwayFromPassageCell(blocker, cell) : false
}

function isMovablePortalBlocker(entity: RuntimeEntity | null | undefined, unit: UnitEntity): entity is RuntimeEntity {
  if (!entity || entity === unit || entity.label === unit.label) return false
  if (entity.isDead || entity.isDestroyed) return false
  return entity.family === FAMILY_TYPES.unit || entity.family === FAMILY_TYPES.animal
}

function clearStalePortalCellOccupancy(cell: RuntimeCell | null | undefined): boolean {
  if (!cell || !isPortalCell(cell)) return false
  const occupant = cell.has
  if (occupant && !occupant.isDead && !occupant.isDestroyed) return false
  cell.has = null
  cell.solid = false
  return true
}

function entityActuallyOccupiesCell(entity: RuntimeEntity, cell: RuntimeCell): boolean {
  return Boolean(
    sameCellMapSpace(entity, cell) &&
      (entity.currentCell === cell || sameGridPosition(entity.currentCell, cell) || sameGridPosition(entity, cell))
  )
}

type ForcedPortalBlocker = RuntimeEntity & {
  action?: string | null
  actionLocked?: boolean
  blockedGatherApproach?: unknown
  dest?: RuntimeCell | RuntimeEntity | null
  path?: RuntimeCell[]
  pendingOrder?: unknown
  realDest?: RuntimeCell | RuntimeEntity | null
}

function prepareForcedPortalBlockerMove(blocker: ForcedPortalBlocker, context: GameContextLike, cell: RuntimeCell): void {
  blocker.context ??= context
  blocker.currentCell ??= cell
  blocker.stopInterval?.()
  blocker.stopTimeout?.()
  blocker.path = []
  blocker.dest = null
  blocker.realDest = null
  blocker.action = null
  blocker.pendingOrder = null
  blocker.blockedGatherApproach = null
  if (blocker.family === FAMILY_TYPES.unit) blocker.actionLocked = false
}

function forceMovePortalBlockerAway(context: GameContextLike, cell: RuntimeCell, unit: UnitEntity): boolean {
  const blocker = cell.has
  if (!isMovablePortalBlocker(blocker, unit)) return false
  if (!entityActuallyOccupiesCell(blocker, cell)) {
    cell.has = null
    cell.solid = false
    return true
  }
  const forcedBlocker = blocker as ForcedPortalBlocker
  prepareForcedPortalBlockerMove(forcedBlocker, context, cell)
  const waitingCell = findNearestPassageWaitingCell(forcedBlocker, cell)
  if (!waitingCell) return false
  if (cell.has === blocker || cell.has?.label === blocker.label) {
    cell.has = null
    cell.solid = false
  }
  const targetSpace = getMapSpace(context.map, waitingCell.cell.spaceId ?? cell.spaceId ?? blocker.spaceId)
  if (!targetSpace) return false
  moveEntityToMapSpace(context.map, blocker, targetSpace, waitingCell.cell)
  updateInstanceVisibility(blocker)
  updateInstanceRenderVisibility(blocker)
  return true
}

function forceClearPortalTargetForHero(context: GameContextLike, unit: UnitEntity, cell: RuntimeCell | null | undefined): boolean {
  if (!isHeroControlled(unit) || !cell || !isPortalCell(cell)) return false
  if (canOccupyPortalCell(cell, unit)) return true
  if (clearStalePortalCellOccupancy(cell)) return true
  if (forceMovePortalBlockerAway(context, cell, unit)) return canOccupyPortalCell(cell, unit)
  return false
}

function routeUnitToPortalWaitingCell(unit: UnitEntity, portal: RuntimeMapSpacePortal): boolean {
  const waitingCell = findNearestPassageWaitingCell(unit, portal.sourceCell)
  if (!waitingCell) return false
  if (
    unitIsOnCell(unit, waitingCell.cell) ||
    sameGridPosition(unit.dest as RuntimeCell | null | undefined, waitingCell.cell)
  ) {
    return true
  }
  unit.sendToEvt?.(waitingCell.cell, null, { forceRepath: true, preserveAutonomy: true })
  return true
}

function getPortalArrivalCell(
  context: GameContextLike,
  unit: UnitEntity,
  portal: RuntimeMapSpacePortal
): RuntimeCell | null {
  const targetSpace = getMapSpace(context.map, portal.targetSpaceId)
  const targetCell = portal.targetCell
  if (!targetSpace || !targetCell) return null
  const passageLookup = createReservedPassageCellLookup(context)
  let best: { cell: RuntimeCell; score: number } | null = null

  for (let radius = 1; radius <= Math.max(2, targetSpace.size); radius += 1) {
    const cells = getCellsAroundPoint(targetCell.i, targetCell.j, targetSpace.grid, radius, cell => {
      if (!isPortalCell(cell)) return false
      if (passageLookup.has(cell)) return false
      return !cell.solid || cell.has === unit || cell.has?.label === unit.label || cell.has?.isDestroyed === true
    })
    for (const cell of cells) {
      const score = Math.abs(cell.i - targetCell.i) + Math.abs(cell.j - targetCell.j)
      if (!best || score < best.score) best = { cell, score }
    }
    if (best) return best.cell
  }

  return canUsePortalArrivalCell(context, targetCell, unit) ? targetCell : null
}

export function prepareUnitForSpaceTransfer(unit: UnitEntity, options: { preserveVisualState?: boolean } = {}): void {
  unit.stopInterval?.()
  unit.stopTimeout?.()
  unit.path = []
  unit.dest = null
  unit.realDest = null
  unit.action = null
  unit.pendingOrder = null
  unit.blockedGatherApproach = null
  unit.actionLocked = false
  if (!options.preserveVisualState) {
    unit.alpha = 1
    unit.visible = true
  }
}

function clearUnitSpacePortalRoute(unit: UnitEntity): void {
  const taskId = unit.spacePortalState?.taskId
  if (taskId != null) unit.context?.scheduler?.remove(taskId)
  unit.spacePortalState = null
}

export function transferUnitThroughSpacePortal(
  context: GameContextLike,
  unit: UnitEntity,
  portal: RuntimeMapSpacePortal,
  options: SpacePortalRouteOptions = {}
): boolean {
  if (unit.isDead || unit.isDestroyed) return false
  if (!unitIsOnCell(unit, portal.sourceCell)) return false
  if (!canOccupyPortalCell(portal.targetCell, unit)) {
    if (!forceClearPortalTargetForHero(context, unit, portal.targetCell)) {
      routePortalCellBlockerAway(portal.targetCell, unit)
      return false
    }
  }
  if (!canOccupyPortalCell(portal.targetCell, unit)) return false
  const targetSpace = getMapSpace(context.map, portal.targetSpaceId)
  if (!targetSpace || targetSpace.id !== portal.targetSpaceId || !portal.targetCell) return false
  const arrivalCell = getPortalArrivalCell(context, unit, portal)
  if (!arrivalCell) return false

  const onTransferred = options.onTransferred ?? unit.spacePortalState?.onTransferred ?? null
  clearUnitSpacePortalRoute(unit)
  prepareUnitForSpaceTransfer(unit)
  moveEntityToMapSpace(context.map, unit, targetSpace, arrivalCell)
  updateInstanceVisibility(unit)
  updateInstanceRenderVisibility(unit)
  onTransferred?.()
  return true
}

function updateUnitSpacePortalRoute(context: GameContextLike, unit: UnitEntity, portal: RuntimeMapSpacePortal): void {
  const state = unit.spacePortalState
  if (
    !state ||
    state.portalId !== portal.id ||
    unit.isDead ||
    unit.isDestroyed ||
    getEntitySpaceId(unit) !== portal.sourceSpaceId
  ) {
    clearUnitSpacePortalRoute(unit)
    return
  }

  if (transferUnitThroughSpacePortal(context, unit, portal)) return
  if (!portal.sourceCell || !isPortalCell(portal.sourceCell)) {
    clearUnitSpacePortalRoute(unit)
    return
  }
  if (!portal.targetCell || !isPortalCell(portal.targetCell)) {
    clearUnitSpacePortalRoute(unit)
    return
  }

  if (targetPortalCellIsBlocked(portal, unit) || !getPortalArrivalCell(context, unit, portal)) {
    if (unitIsOnCell(unit, portal.sourceCell)) routeUnitToPortalWaitingCell(unit, portal)
    return
  }

  const alreadyHeadingToSource = sameGridPosition(unit.dest as RuntimeCell | null | undefined, portal.sourceCell)
  if (!unitIsOnCell(unit, portal.sourceCell) && !alreadyHeadingToSource) {
    unit.sendToEvt?.(portal.sourceCell, null, {
      forceRepath: true,
      preserveAutonomy: true,
      allowPassageStop: true,
    })
  }
}

function scheduleUnitSpacePortalRoute(context: GameContextLike, unit: UnitEntity, portal: RuntimeMapSpacePortal): void {
  const state = unit.spacePortalState
  if (!state || !context.scheduler || state.taskId != null) return
  state.taskId = context.scheduler.add(
    () => updateUnitSpacePortalRoute(context, unit, portal),
    SPACE_PORTAL_CHECK_INTERVAL_MS,
    'spacePortal.route'
  )
}

export function routeUnitThroughSpacePortal(
  context: GameContextLike,
  unit: UnitEntity,
  portal: RuntimeMapSpacePortal,
  options: SpacePortalRouteOptions = {}
): boolean {
  if (unit.isDead || unit.isDestroyed || !portal.sourceCell || !portal.targetCell) return false
  if (getEntitySpaceId(unit) !== portal.sourceSpaceId) return false

  if (transferUnitThroughSpacePortal(context, unit, portal, options)) return true

  unit.spacePortalState = {
    onTransferred: options.onTransferred ?? null,
    portalId: portal.id,
    sourceCell: portal.sourceCell,
    sourceSpaceId: portal.sourceSpaceId,
    startedAtMs: context.scheduler?.elapsedMs ?? 0,
    targetCell: portal.targetCell,
    targetSpaceId: portal.targetSpaceId,
  }

  if (unitIsOnCell(unit, portal.sourceCell) && !getPortalArrivalCell(context, unit, portal)) {
    routeUnitToPortalWaitingCell(unit, portal)
  } else if (!unitIsOnCell(unit, portal.sourceCell)) {
    unit.sendToEvt?.(portal.sourceCell, null, {
      forceRepath: true,
      preserveAutonomy: true,
      allowPassageStop: true,
    })
  }
  scheduleUnitSpacePortalRoute(context, unit, portal)
  return true
}
