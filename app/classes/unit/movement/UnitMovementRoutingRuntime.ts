import { ACTION_TYPES } from '../../../constants'
import { getInstanceClosestFreeCellPath, getInstanceDegree, getInstancePath } from '../../../lib'
import {
  canUnitUseCellAsIdleDestination,
  canUseReservedPassageCellForTransit,
  createReservedPassageCellLookup,
} from '../../../lib/buildings/passageCells'
import { getEntitySpaceMapLike, sameCellMapSpace, sameMapSpace } from '../../../lib/mapSpaces'
import { cancelVillagerExplorationResume } from '../../../lib/units/autonomy/villagerExploration'
import { routeToRememberedTarget } from '../../../lib/units/targetPursuit'
import { cancelEnergyWait } from '../../../lib/units/unitEnergy'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'
import { clearManualMoveWorkState } from './ManualMoveState'
import { getActionArrivalCell } from './UnitActionArrivalCells'
import {
  findReachableApproachCell,
  handleBlockedApproachFailure,
  retryBlockedGatherApproach,
  routeToReachableWaterApproach,
  startBlockedGatherApproach,
  type ReachableApproach,
} from './UnitBlockedApproach'
import { tryStartUnitContactApproach } from './UnitContactApproach'
import { admitMoveOrder, isRedundantMoveOrder, resolveAttackOrder } from './UnitMoveOrderAdmission'
import { debugCombatMove } from './UnitMovementDebug'
import {
  isDestroyedEntity,
  isRuntimeEntity,
  resumeAutonomyBeforeStopping,
  syncVillagerWorkForAction,
  type SendToOptions,
} from './UnitMovementHelpers'
import {
  allowsUnitPassageStop,
  createPassagePathfindingOptions,
  resolvePassageDestination,
  type PassageLookup,
} from './UnitMovementPassage'

type SpaceMapLike = NonNullable<ReturnType<typeof getEntitySpaceMapLike>>
type RouteOptions = Required<Pick<SendToOptions, 'allowBlockedGatherApproach' | 'preserveAutonomy' | 'allowPassageStop'>>

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
  ): ReachableApproach | null {
    return findReachableApproachCell(this.unit, target, minDistance, allowCurrentCell)
  }

  approachBlockedGatherTarget(dest: RuntimeEntity | null | undefined, action: string): boolean {
    return startBlockedGatherApproach(this.unit, dest, action)
  }

  retryBlockedGatherApproach(): boolean {
    return retryBlockedGatherApproach(this.unit)
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
      !canUseReservedPassageCellForTransit(arrivalCell, passageLookup)
    ) {
      this.handleUnreachableDestination(action)
      return true
    }
    if (unit.i === arrivalCell.i && unit.j === arrivalCell.j) {
      this.startActionAt(dest, action)
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
    if (!resumeAutonomyBeforeStopping(this.unit)) this.unit.affectNewDest?.()
  }

  handleBlockedApproachFailure(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    allowBlockedGatherApproach: boolean
  ): void {
    handleBlockedApproachFailure(this.unit, dest, action, allowBlockedGatherApproach)
  }

  routeToReachableWaterApproach(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    allowBlockedGatherApproach: boolean
  ): boolean {
    return routeToReachableWaterApproach(this.unit, dest, action, allowBlockedGatherApproach)
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
    if (!admitMoveOrder(unit, dest, action)) return false
    const map = getEntitySpaceMapLike(unit, unit.context?.map)
    const attackDecision = resolveAttackOrder(unit, dest, action)
    if (attackDecision !== null) return attackDecision
    if (unit.actionLocked) {
      return unit.queueOrder?.(dest ?? (() => {}), action)
    }
    if (dest && isRuntimeEntity(dest) && routeToRememberedTarget(unit, dest, action)) return
    if (isRedundantMoveOrder(unit, dest, action, forceRepath)) return
    this.resetForNewOrder(action)
    if (!dest || isDestroyedEntity(dest) || unit.isDead || !map) return
    if (!this.targetIsInUnitSpace(dest)) {
      this.handleUnreachableDestination(action)
      return
    }
    this.routeAdmittedOrder(dest, action, map, { allowBlockedGatherApproach, preserveAutonomy, allowPassageStop })
  }

  private resetForNewOrder(action: string | null): void {
    const unit = this.unit
    cancelVillagerExplorationResume(unit)
    unit.handleChangeDest?.()
    if (action !== ACTION_TYPES.train) {
      unit.trainingTargetType = null
      unit.trainingRetryTaskId = null
    }
    unit.stopInterval?.()
    unit.blockedGatherApproach = null
  }

  private routeAdmittedOrder(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    map: SpaceMapLike,
    { allowBlockedGatherApproach, preserveAutonomy, allowPassageStop }: RouteOptions
  ): void {
    const unit = this.unit
    const passageLookup = createReservedPassageCellLookup(unit.context)
    const passageStopAllowed = allowsUnitPassageStop(unit, dest, allowPassageStop)
    this.prepareMoveWork(action, preserveAutonomy)
    if (this.routeToActionArrivalCell(dest, action, passageLookup)) return
    const resolvedDest = resolvePassageDestination(unit, dest, action, passageStopAllowed, passageLookup)
    if (!resolvedDest) {
      this.handleUnreachableDestination(action)
      return
    }
    cancelEnergyWait(unit)
    syncVillagerWorkForAction(unit, action)
    if (this.tryArriveAtDestination(map, resolvedDest, action)) return
    if (isRuntimeEntity(resolvedDest) && tryStartUnitContactApproach(unit, resolvedDest, action)) return
    this.routePreparedDestination(
      resolvedDest,
      action,
      map,
      passageLookup,
      passageStopAllowed,
      allowBlockedGatherApproach
    )
  }

  private startActionAt(dest: RuntimeEntity | RuntimeCell, action: string | null): void {
    const unit = this.unit
    unit.setDest?.(dest)
    unit.action = action
    unit.degree = getInstanceDegree(unit, dest.x, dest.y)
    unit.getAction?.(action ?? '')
  }

  private tryArriveAtDestination(map: SpaceMapLike, dest: RuntimeEntity | RuntimeCell, action: string | null): boolean {
    const unit = this.unit
    const currentCell = map.grid[unit.i]?.[unit.j]
    if (
      currentCell &&
      unit.isUnitAtDest?.(action, dest) &&
      (!currentCell.solid || currentCell.has?.label === unit.label)
    ) {
      this.startActionAt(dest, action)
      return true
    }
    return false
  }

  private routePreparedDestination(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    map: SpaceMapLike,
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
        routeToReachableWaterApproach(unit, dest, action, allowBlockedGatherApproach)
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
      this.handleNoPath(dest, action, map, allowBlockedGatherApproach)
    }
  }

  private handleNoPath(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    map: SpaceMapLike,
    allowBlockedGatherApproach: boolean
  ): void {
    const unit = this.unit
    unit.action = action
    const blockedCell = map.grid[dest.i]?.[dest.j] ?? unit.currentCell
    if (blockedCell) {
      debugCombatMove(unit, 'send-to-no-path', blockedCell, {
        stage: 'send-to',
        action,
      })
    }
    if (allowBlockedGatherApproach && isRuntimeEntity(dest) && startBlockedGatherApproach(unit, dest, action ?? ''))
      return
    this.handleUnreachableDestination(action)
  }

  private findSolidDestinationPath(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    map: SpaceMapLike,
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
      if (allowBlockedGatherApproach && isRuntimeEntity(dest) && startBlockedGatherApproach(unit, dest, action ?? ''))
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

  private prepareMoveWork(action: string | null, preserveAutonomy: boolean): void {
    if (!(preserveAutonomy && !action)) this.unit.exploringForAutonomy = false
    if (!action) clearManualMoveWorkState(this.unit, preserveAutonomy)
  }
}
