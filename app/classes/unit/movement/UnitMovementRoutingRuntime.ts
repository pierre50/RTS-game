import { routeToRememberedTarget } from '../../../lib/units/targetPursuit'
import { cancelVillagerExplorationResume } from '../../../lib/units/autonomy/villagerExploration'
import { tryStartUnitContactApproach } from './UnitContactApproach'
import { ACTION_TYPES, UNIT_TYPES } from '../../../constants'
import {
  clearVillagerAutonomy,
  getCellsAroundPoint,
  getInstanceClosestFreeCellPath,
  getInstanceDegree,
  getInstancePath,
  markVillagerAutonomyTargetRejected,
} from '../../../lib'
import { debugCombatMove } from './UnitMovementDebug'
import {
  canUnitWaitOnCell,
  canUnitUseCellAsIdleDestination,
  canUseReservedPassageCellForTransit,
  createReservedPassageCellLookup,
  findNearestPassageWaitingCell,
  shouldUnitAvoidPassageStop,
  unitHasActivePassageStopIntent,
} from '../../../lib/buildings/passageCells'
import {
  BLOCKED_GATHER_APPROACH_ACTIONS,
  MAX_BLOCKED_GATHER_APPROACH_DISTANCE,
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
import type { PathfindingOptions } from '../../../services/Pathfinding'

type PassageLookup = ReturnType<typeof createReservedPassageCellLookup>

function clearManualMoveWorkState(unit: UnitEntity, preserveAutonomy: boolean): void {
  if (preserveAutonomy) return
  unit.exploringForAutonomy = false
  unit.previousDest = null
  unit.previousWork = null
  unit.gatherProgressState = null
  unit.resourceDeliveryState = null
  if (unit.type === UNIT_TYPES.villager) unit.work = null
  clearVillagerAutonomy?.(unit)
  if (unit.owner?.isPlayed) unit.context?.menu?.updateTopbar?.()
}

function createPassagePathfindingOptions(passageLookup: PassageLookup): PathfindingOptions<RuntimeCell> {
  return {
    canPassThroughSolidCell: cell => canUseReservedPassageCellForTransit(cell, passageLookup),
  }
}

function canUsePassageCellForTransit(cell: RuntimeCell, passageLookup: PassageLookup): boolean {
  return canUseReservedPassageCellForTransit(cell, passageLookup)
}

export class UnitMovementRouting {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  targetIsInUnitSpace(dest: RuntimeEntity | RuntimeCell | null | undefined): boolean {
    if (!dest) return false
    return isRuntimeEntity(dest) ? sameMapSpace(this.unit, dest) : sameCellMapSpace(this.unit, dest)
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
    const pathfinding = createPassagePathfindingOptions(passageLookup)

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
        const path = getInstancePath(unit, cell.i, cell.j, map, pathfinding)
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
    passageLookup: PassageLookup
  ): boolean {
    const unit = this.unit
    const map = getEntitySpaceMapLike(unit, unit.context?.map)
    const arrivalCell = getActionArrivalCell(unit, dest, action)
    if (!arrivalCell) return false
    if (
      !canUnitUseCellAsIdleDestination(unit, arrivalCell, {
        allowPassageStop: true,
        passageLookup,
      }) &&
      !canUsePassageCellForTransit(arrivalCell, passageLookup)
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
    const path = getInstancePath(
      unit,
      arrivalCell.i,
      arrivalCell.j,
      map,
      createPassagePathfindingOptions(passageLookup)
    )
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
      // The original order already decided whether to clear the job; this is only a detour.
      unit.sendToEvt?.(approach.cell, null, { preserveAutonomy: true })
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
    if (dest && isRuntimeEntity(dest) && routeToRememberedTarget(unit, dest, action)) return
    const currentDestMatchesTarget = this.matchesCurrentTarget(dest)
    if (this.isRedundantOrder(dest, action, forceRepath, currentDestMatchesTarget)) return
    cancelVillagerExplorationResume(unit)
    unit.handleChangeDest?.()
    if (action !== ACTION_TYPES.train) {
      unit.trainingTargetType = null
      unit.trainingRetryTaskId = null
    }
    unit.stopInterval?.()
    unit.blockedGatherApproach = null
    if (!dest || isDestroyedEntity(dest) || unit.isDead || !map) return
    if (!this.targetIsInUnitSpace(dest)) {
      this.handleUnreachableDestination(action)
      return
    }
    const passageLookup = createReservedPassageCellLookup(unit.context)
    const passageStopAllowed = this.allowsPassageStop(dest, allowPassageStop)
    this.prepareMoveWork(action, preserveAutonomy)
    if (this.routeToActionArrivalCell(dest, action, passageLookup)) return
    dest = this.resolvePassageDestination(dest, action, passageStopAllowed, passageLookup)
    if (!dest) {
      this.handleUnreachableDestination(action)
      return
    }
    cancelEnergyWait(unit)
    syncVillagerWorkForAction(unit, action)
    if (this.tryArriveAtDestination(map, dest, action, forceRepath, currentDestMatchesTarget)) return
    if (isRuntimeEntity(dest) && tryStartUnitContactApproach(unit, dest, action)) return
    this.routePreparedDestination(dest, action, map, passageLookup, passageStopAllowed, allowBlockedGatherApproach)
  }

  private isRedundantOrder(
    dest: RuntimeEntity | RuntimeCell | null,
    action: string | null,
    forceRepath: boolean,
    currentDestMatchesTarget: boolean
  ): boolean {
    const unit = this.unit
    return Boolean(
      !forceRepath &&
        dest &&
        isRuntimeEntity(unit.dest) &&
        currentDestMatchesTarget &&
        unit.action === action &&
        ((unit.path?.length ?? 0) > 0 || unit.isUnitAtDest?.(action, dest))
    )
  }

  private resolvePassageDestination(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    passageStopAllowed: boolean,
    passageLookup: PassageLookup
  ): RuntimeEntity | RuntimeCell | null {
    const unit = this.unit
    if (
      !action &&
      !isRuntimeEntity(dest) &&
      shouldUnitAvoidPassageStop(unit, dest, { allowPassageStop: passageStopAllowed, passageLookup })
    ) {
      const waitingCell = findNearestPassageWaitingCell(unit, dest, { passageLookup })
      if (!waitingCell) {
        return null
      }
      dest = waitingCell.cell
    }
    return dest
  }

  private tryArriveAtDestination(
    map: NonNullable<ReturnType<typeof getEntitySpaceMapLike>>,
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    forceRepath: boolean,
    currentDestMatchesTarget: boolean
  ): boolean {
    const unit = this.unit
    const currentCell = map.grid[unit.i]?.[unit.j]
    if (
      currentCell &&
      unit.isUnitAtDest?.(action, dest) &&
      (!currentCell.solid || currentCell.has?.label === unit.label)
    ) {
      if (!forceRepath && currentDestMatchesTarget && unit.action === action && (unit.path?.length ?? 0) === 0) {
        return true
      }
      unit.setDest?.(dest)
      unit.action = action
      unit.degree = getInstanceDegree(unit, dest.x, dest.y)
      unit.getAction?.(action ?? '')
      return true
    }
    return false
  }

  private routePreparedDestination(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    map: NonNullable<ReturnType<typeof getEntitySpaceMapLike>>,
    passageLookup: PassageLookup,
    passageStopAllowed: boolean,
    allowBlockedGatherApproach: boolean
  ): void {
    const unit = this.unit
    let path: RuntimeCell[] = []
    const destCell = map.grid[dest.i]?.[dest.j]
    if (destCell) {
      if (destCell.solid) {
        const detour = this.findSolidDestinationPath(
          dest,
          action,
          map,
          destCell,
          passageLookup,
          passageStopAllowed,
          allowBlockedGatherApproach
        )
        if (detour === null) return
        path = detour
      } else if (destCell.category === 'Water') {
        unit.action = action
        this.routeToReachableWaterApproach(dest, action, allowBlockedGatherApproach)
        return
      }
    }
    if (!path.length) {
      path = getInstancePath(unit, dest.i, dest.j, map, createPassagePathfindingOptions(passageLookup))
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

  private findSolidDestinationPath(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    map: NonNullable<ReturnType<typeof getEntitySpaceMapLike>>,
    destCell: RuntimeCell,
    passageLookup: PassageLookup,
    passageStopAllowed: boolean,
    allowBlockedGatherApproach: boolean
  ): RuntimeCell[] | null {
    const unit = this.unit
    const passagePathfinding = createPassagePathfindingOptions(passageLookup)
    const path = getInstanceClosestFreeCellPath<RuntimeCell>(unit, dest, map, {
      isCellAllowed: cell =>
        canUnitUseCellAsIdleDestination(unit, cell, { allowPassageStop: passageStopAllowed, passageLookup }),
      pathfinding: passagePathfinding,
    })
    if (!path.length && unit.work) {
      unit.action = action
      if (allowBlockedGatherApproach && isRuntimeEntity(dest) && this.approachBlockedGatherTarget(dest, action ?? ''))
        return null
      debugCombatMove(unit, 'send-to-solid-dest-no-path', destCell, {
        stage: 'send-to',
        action,
        destSolid: destCell.solid,
      })
      this.handleUnreachableDestination(action)
      return null
    }
    return path
  }

  private matchesCurrentTarget(dest: RuntimeEntity | RuntimeCell | null): boolean {
    const currentDest = this.unit.dest
    return isRuntimeEntity(currentDest) && isRuntimeEntity(dest) && currentDest.label === dest.label
  }

  private allowsPassageStop(dest: RuntimeEntity | RuntimeCell, allowPassageStop: boolean): boolean {
    return allowPassageStop || (!isRuntimeEntity(dest) && unitHasActivePassageStopIntent(this.unit, dest))
  }

  private prepareMoveWork(action: string | null, preserveAutonomy: boolean): void {
    if (!(preserveAutonomy && !action)) this.unit.exploringForAutonomy = false
    if (!action) clearManualMoveWorkState(this.unit, preserveAutonomy)
  }
}
