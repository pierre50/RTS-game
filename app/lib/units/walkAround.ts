import { getCellsAroundPoint } from '../grid'
import { getEntitySpaceMapLike } from '../mapSpaces'
import { scheduleAmbientMove } from './ambientMovement'
import { canUnitUseCellAsIdleDestination, createReservedPassageCellLookup } from '../buildings/passageCells'
import type { SchedulerTaskId } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'

export type UnitWalkAroundOptions = {
  anchor: (unit: UnitEntity) => GridPosition | null
  canMove?: (unit: UnitEntity) => boolean
  delayMaxMs: (unit: UnitEntity) => number
  delayMinMs: (unit: UnitEntity) => number
  onTaskId?: (unit: UnitEntity, taskId: SchedulerTaskId | null) => void
  range: (unit: UnitEntity) => number
  shouldContinue: (unit: UnitEntity) => boolean
  taskName: string
}

function canUnitStartAmbientWalk(unit: UnitEntity): boolean {
  return Boolean(
    !unit.isDead &&
      !unit.isDestroyed &&
      !unit.shelterState &&
      !unit.action &&
      !unit.dest &&
      !(unit.path?.length) &&
      unit.combatMode !== 'attack' &&
      unit.combatMode !== 'recover' &&
      unit.combatMode !== 'flee' &&
      !unit.pendingOrder &&
      !unit.spacePortalState &&
      !unit.resourceDeliveryState
  )
}

function findUnitWalkAroundDestination(unit: UnitEntity, anchor: GridPosition | null, range: number): RuntimeCell | null {
  const map = unit.context?.map
  const spaceMap = getEntitySpaceMapLike(unit, map)
  if (!map || !anchor) return null
  const passageLookup = createReservedPassageCellLookup(unit.context)
  const cells = getCellsAroundPoint(anchor.i, anchor.j, spaceMap?.grid ?? map.grid, range, cell =>
    Boolean(canUnitUseCellAsIdleDestination(unit, cell, { passageLookup }) && (cell.i !== unit.i || cell.j !== unit.j))
  )
  return cells.length ? map.randomItem(cells) : null
}

export function scheduleUnitWalkAround(unit: UnitEntity, options: UnitWalkAroundOptions): SchedulerTaskId | null {
  const map = unit.context?.map
  const scheduler = unit.context?.scheduler
  if (!map || !scheduler) return null

  return scheduleAmbientMove(unit, {
    canMove: target => canUnitStartAmbientWalk(target) && (options.canMove?.(target) ?? true),
    delayMaxMs: options.delayMaxMs,
    delayMinMs: options.delayMinMs,
    move: (target, destination) => {
      if (target.sendToEvt) target.sendToEvt(destination, null, { forceRepath: true, preserveAutonomy: true })
      else target.sendTo?.(destination)
    },
    onTaskId: options.onTaskId,
    pickDestination: target => findUnitWalkAroundDestination(target, options.anchor(target), options.range(target)),
    randomRange: (min, max) => map.randomRange(min, max),
    scheduler,
    shouldContinue: options.shouldContinue,
    taskName: options.taskName,
  })
}
