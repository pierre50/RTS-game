import { UNIT_TYPES } from '../../../constants'
import {
  clearVillagerAutonomy,
  findInstancesInSight,
  getCellsAroundPoint,
  getClosestInstanceWithPath,
  getInstanceClosestFreeCellPath,
  getInstanceDegree,
  getInstancePath,
  markVillagerAutonomyTargetRejected,
  showBlockedFeedback,
} from '../../../lib'
import { debugCombatMove } from './UnitMovementDebug'
import {
  canUnitWaitOnCell,
  canUnitUseCellAsIdleDestination,
  createReservedPassageCellLookup,
  findNearestPassageWaitingCell,
  shouldUnitAvoidPassageStop,
  unitHasActivePassageStopIntent,
} from '../../../lib/buildings/passageCells'
import {
  BLOCKED_GATHER_APPROACH_ACTIONS,
  GATHER_SEND_TO_BY_ACTION,
  MAX_BLOCKED_GATHER_APPROACH_DISTANCE,
  POST_BUILD_GATHER_ACTIONS,
  isDestroyedEntity,
  isRuntimeEntity,
  resumeAutonomyBeforeStopping,
  syncVillagerWorkForAction,
  type SendToOptions,
} from './UnitMovementHelpers'
import { cancelEnergyWait } from '../../../lib/units/unitEnergy'
import { getEntitySpaceMapLike, sameCellMapSpace, sameMapSpace } from '../../../lib/mapSpaces'
import { getActionArrivalCell } from './UnitActionArrivalCells'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'

export class UnitMovementRouting {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  targetIsInUnitSpace(dest: RuntimeEntity | RuntimeCell | null | undefined): boolean {
    if (!dest) return false
    return isRuntimeEntity(dest) ? sameMapSpace(this.unit, dest) : sameCellMapSpace(this.unit, dest)
  }

  sendToPostBuildResource(): boolean {
    const unit = this.unit
    const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
    const actions = dest?.type ? POST_BUILD_GATHER_ACTIONS[dest.type] : undefined
    if (!actions || !(dest as { isBuilt?: boolean } | undefined)?.isBuilt || dest?.isDead || dest?.isDestroyed)
      return false

    const unitAsInstance = unit
    const targets = findInstancesInSight<UnitEntity, RuntimeEntity>(unitAsInstance, instance =>
      actions.some(action => unit.getActionCondition?.(instance, action))
    )
    if (!targets.length) return false

    const target = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(unitAsInstance, targets)
    if (!target) return false

    const action = actions.find(candidate => unit.getActionCondition?.(target.instance, candidate))
    const sendTo = action ? GATHER_SEND_TO_BY_ACTION[action] : undefined
    return sendTo ? sendTo(unit, target.instance) : false
  }

  findClosestReachableCellNearTarget(
    target: RuntimeEntity | RuntimeCell,
    minDistance = 2,
    allowCurrentCell = false
  ): { cell: RuntimeCell; path: RuntimeCell[] } | null {
    const unit = this.unit
    const map = getEntitySpaceMapLike(unit, unit.context?.map)
    if (!map) return null
    const maxDistance = Math.max(
      2,
      Math.min(unit.sight || MAX_BLOCKED_GATHER_APPROACH_DISTANCE, MAX_BLOCKED_GATHER_APPROACH_DISTANCE)
    )
    let best: { cell: RuntimeCell; path: RuntimeCell[] } | null = null
    const passageLookup = createReservedPassageCellLookup(unit.context)

    for (let distance = minDistance; distance <= maxDistance; distance++) {
      const cells = getCellsAroundPoint(target.i, target.j, map.grid, distance, cell =>
        canUnitWaitOnCell(unit, cell, { passageLookup })
      )
      cells.sort(
        (a, b) =>
          Math.abs(a.i - target.i) + Math.abs(a.j - target.j) - (Math.abs(b.i - target.i) + Math.abs(b.j - target.j)) ||
          Math.abs(a.i - unit.i) + Math.abs(a.j - unit.j) - (Math.abs(b.i - unit.i) + Math.abs(b.j - unit.j))
      )

      for (const cell of cells) {
        if (allowCurrentCell && unit.i === cell.i && unit.j === cell.j) return { cell, path: [] }
        const path = getInstancePath(unit, cell.i, cell.j, map)
        if (path.length && (!best || path.length < best.path.length)) {
          best = { cell, path }
        }
      }
      if (best) return best
    }

    return null
  }

  approachBlockedGatherTarget(dest: RuntimeEntity | null | undefined, action: string): boolean {
    const unit = this.unit
    if (unit.type !== UNIT_TYPES.villager || !BLOCKED_GATHER_APPROACH_ACTIONS.has(action)) return false
    if (!dest || dest.isDestroyed || !unit.getActionCondition?.(dest, action)) return false
    if (unit.blockedGatherApproach?.target === dest && unit.blockedGatherApproach.action === action) return false

    const approach = this.findClosestReachableCellNearTarget(dest)
    if (!approach) return false

    unit.setDest?.(dest)
    unit.action = action
    unit.blockedGatherApproach = { target: dest, action }
    unit.setPath?.(approach.path)
    return true
  }

  retryBlockedGatherApproach(): boolean {
    const unit = this.unit
    const blockedGatherApproach = unit.blockedGatherApproach
    if (!blockedGatherApproach) return false

    unit.blockedGatherApproach = null
    const { target, action } = blockedGatherApproach
    if (!target || target.isDestroyed || !unit.getActionCondition?.(target, action)) {
      markVillagerAutonomyTargetRejected?.(unit, target)
      unit.affectNewDest?.()
      return true
    }

    markVillagerAutonomyTargetRejected?.(unit, target)
    unit.sendToEvt?.(target, action, { forceRepath: true, allowBlockedGatherApproach: false })
    return true
  }

  routeToActionArrivalCell(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    passageLookup: ReturnType<typeof createReservedPassageCellLookup>
  ): boolean {
    const unit = this.unit
    const map = getEntitySpaceMapLike(unit, unit.context?.map)
    const arrivalCell = getActionArrivalCell(unit, dest, action)
    if (!arrivalCell) return false
    if (
      !canUnitUseCellAsIdleDestination(unit, arrivalCell, {
        allowPassageStop: true,
        passageLookup,
      })
    ) {
      this.handleUnreachableDestination(action)
      return true
    }

    if (unit.i === arrivalCell.i && unit.j === arrivalCell.j) {
      unit.setDest?.(dest)
      unit.action = action
      unit.degree = getInstanceDegree(unit, dest.x, dest.y)
      unit.getAction?.(action ?? '')
      return true
    }

    if (!map) return false
    const path = getInstancePath(unit, arrivalCell.i, arrivalCell.j, map)
    if (!path.length) return false

    unit.setDest?.(dest)
    unit.action = action
    unit.setPath?.(path)
    return true
  }

  handleUnreachableDestination(_action: string | null): void {
    const unit = this.unit
    if (resumeAutonomyBeforeStopping(unit)) {
      return
    } else {
      showBlockedFeedback(unit)
      unit.affectNewDest?.()
    }
  }

  handleBlockedApproachFailure(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    allowBlockedGatherApproach: boolean
  ): void {
    const unit = this.unit
    if (
      allowBlockedGatherApproach &&
      this.approachBlockedGatherTarget(isRuntimeEntity(dest) ? dest : null, action ?? '')
    ) {
      return
    }
    showBlockedFeedback(unit)
    if (action) unit.affectNewDest?.()
    else if (!resumeAutonomyBeforeStopping(unit)) unit.stop?.()
  }

  routeToReachableWaterApproach(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    allowBlockedGatherApproach: boolean
  ): boolean {
    const unit = this.unit
    const approach = this.findClosestReachableCellNearTarget(dest, 1, true)
    if (!approach) {
      this.handleBlockedApproachFailure(dest, action, allowBlockedGatherApproach)
      return true
    }
    if (!action) {
      unit.sendToEvt?.(approach.cell, null)
      return true
    }
    unit.setDest?.(dest)
    unit.action = action
    if (approach.path.length) {
      unit.setPath?.(approach.path)
    } else {
      unit.degree = getInstanceDegree(unit, dest.x, dest.y)
      unit.getAction?.(action)
    }
    return true
  }

  sendToEvt(
    dest: RuntimeEntity | RuntimeCell | null,
    action: string | null,
    {
      forceRepath = false,
      allowBlockedGatherApproach = true,
      preserveAutonomy = false,
      allowPassageStop = false,
    }: SendToOptions = {}
  ) {
    const unit = this.unit
    const map = getEntitySpaceMapLike(unit, unit.context?.map)
    if (unit.actionLocked) {
      return unit.queueOrder?.(dest ?? (() => {}), action)
    }
    const currentDest = unit.dest
    const currentDestMatchesTarget =
      isRuntimeEntity(currentDest) && isRuntimeEntity(dest) && currentDest.label === dest.label
    if (
      !forceRepath &&
      dest &&
      isRuntimeEntity(currentDest) &&
      currentDestMatchesTarget &&
      unit.action === action &&
      ((unit.path?.length ?? 0) > 0 || unit.isUnitAtDest?.(action, dest))
    ) {
      return
    }
    unit.handleChangeDest?.()
    unit.stopInterval?.()
    unit.blockedGatherApproach = null
    let path: RuntimeCell[] = []
    if (!dest || isDestroyedEntity(dest) || unit.isDead || !map) return
    if (!this.targetIsInUnitSpace(dest)) {
      this.handleUnreachableDestination(action)
      return
    }
    const passageLookup = createReservedPassageCellLookup(unit.context)
    const passageStopAllowed =
      allowPassageStop || (!isRuntimeEntity(dest) && unitHasActivePassageStopIntent(unit, dest))
    if (this.routeToActionArrivalCell(dest, action, passageLookup)) return
    if (
      !action &&
      !isRuntimeEntity(dest) &&
      shouldUnitAvoidPassageStop(unit, dest, { allowPassageStop: passageStopAllowed, passageLookup })
    ) {
      const waitingCell = findNearestPassageWaitingCell(unit, dest, { passageLookup })
      if (!waitingCell) {
        this.handleUnreachableDestination(action)
        return
      }
      dest = waitingCell.cell
    }
    cancelEnergyWait(unit)
    if (!action && !preserveAutonomy) {
      unit.previousDest = null
      unit.previousWork = null
      clearVillagerAutonomy?.(unit)
    }
    syncVillagerWorkForAction(unit, action)
    if (
      unit.isUnitAtDest?.(action, dest) &&
      (!map.grid[unit.i][unit.j].solid ||
        (map.grid[unit.i][unit.j].solid && map.grid[unit.i][unit.j].has?.label === unit.label))
    ) {
      if (!forceRepath && currentDestMatchesTarget && unit.action === action && (unit.path?.length ?? 0) === 0) {
        return
      }
      unit.setDest?.(dest)
      unit.action = action
      unit.degree = getInstanceDegree(unit, dest.x, dest.y)
      unit.getAction?.(action ?? '')
      return
    }
    if (map.grid[dest.i] && map.grid[dest.i][dest.j]) {
      const destCell = map.grid[dest.i][dest.j]
      if (destCell.solid) {
        path = getInstanceClosestFreeCellPath<RuntimeCell>(unit, dest, map, {
          isCellAllowed: cell =>
            canUnitUseCellAsIdleDestination(unit, cell, { allowPassageStop: passageStopAllowed, passageLookup }),
        })
        if (!path.length && unit.work) {
          unit.action = action
          if (
            allowBlockedGatherApproach &&
            isRuntimeEntity(dest) &&
            this.approachBlockedGatherTarget(dest, action ?? '')
          )
            return
          debugCombatMove(unit, 'send-to-solid-dest-no-path', destCell, {
            stage: 'send-to',
            action,
            destSolid: destCell.solid,
          })
          this.handleUnreachableDestination(action)
          return
        }
      } else if (destCell.category === 'Water') {
        unit.action = action
        this.routeToReachableWaterApproach(dest, action, allowBlockedGatherApproach)
        return
      }
    }
    if (!path.length) {
      path = getInstancePath(unit, dest.i, dest.j, map)
    }
    if (path.length) {
      unit.setDest?.(dest)
      unit.action = action
      unit.setPath?.(path)
    } else {
      unit.action = action
      const blockedCell = map.grid[dest.i]?.[dest.j] ?? unit.currentCell
      if (blockedCell) {
        debugCombatMove(unit, 'send-to-no-path', blockedCell, {
          stage: 'send-to',
          action,
        })
      }
      if (allowBlockedGatherApproach && isRuntimeEntity(dest) && this.approachBlockedGatherTarget(dest, action ?? ''))
        return
      this.handleUnreachableDestination(action)
    }
  }
}
