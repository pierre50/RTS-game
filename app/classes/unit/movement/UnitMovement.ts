import { playerSeesTarget, observeTarget } from '../../../lib/units/playerTargetKnowledge'
import { getVillagerExplorationSearch } from '../../../lib/units/autonomy/villagerExploration'
import { canReachActionTarget, usesUnitContactAction } from '../../../lib/actions/contactActions'
import { ACTION_TYPES, FAMILY_TYPES, UNIT_TYPES } from '../../../constants'
import { findReachableFleeCell, getInstancePath, instanceContactInstance, instancesDistance } from '../../../lib'
import { isHeroActionInRange } from '../../../lib/hero/heroActionRange'
import { markCombatFlee } from '../../../lib/combat/combatBehavior'
import { getUnitCombatRange } from '../../../lib/equipment/equipmentStats'
import { getEntitySpaceMapLike } from '../../../lib/mapSpaces'
import { canUnitWaitOnCell, createReservedPassageCellLookup } from '../../../lib/buildings/passageCells'
import { UnitDirectMovement } from './UnitDirectMovement'
import { UnitMovementRouting } from './UnitMovementRouting'
import { moveUnitToPath } from './UnitPathMovement'
import { isUnitOnActionArrivalCell } from './UnitActionArrivalCells'
import { debugCombatMove, debugHuntRangeCheck } from './UnitMovementDebug'
import {
  CAPTURE_HORSE_TRIGGER_RANGE,
  clearRequestedMoveSpeedFactor,
  isRuntimeEntity,
  type DirectMoveOptions,
  type SendToOptions,
  usesCautiousAnimalApproach,
} from './UnitMovementHelpers'
import { affectNewDest as affectUnitNewDest } from './UnitAffectNewDest'
import type { HeroDirectMoveBlocker } from './UnitHeroDirectMovementCollision'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'

export class UnitMovement {
  unit: UnitEntity
  directMovement: UnitDirectMovement
  routing: UnitMovementRouting

  constructor(unit: UnitEntity) {
    this.unit = unit
    this.directMovement = new UnitDirectMovement(unit)
    this.routing = new UnitMovementRouting(unit)
  }

  get slideBias(): number {
    return this.directMovement.slideBias
  }

  set slideBias(value: number) {
    this.directMovement.slideBias = value
  }

  get directMoveBlocker(): HeroDirectMoveBlocker | null {
    return this.directMovement.directMoveBlocker
  }

  set directMoveBlocker(value: HeroDirectMoveBlocker | null) {
    this.directMovement.directMoveBlocker = value
  }

  findClosestReachableCellNearTarget(
    target: RuntimeEntity | RuntimeCell,
    minDistance = 2,
    allowCurrentCell = false
  ): { cell: RuntimeCell; path: RuntimeCell[] } | null {
    return this.routing.findClosestReachableCellNearTarget(target, minDistance, allowCurrentCell)
  }

  approachBlockedGatherTarget(dest: RuntimeEntity | null | undefined, action: string): boolean {
    return this.routing.approachBlockedGatherTarget(dest, action)
  }

  retryBlockedGatherApproach(): boolean {
    return this.routing.retryBlockedGatherApproach()
  }

  handleUnreachableDestination(action: string | null): void {
    this.routing.handleUnreachableDestination(action)
  }

  handleBlockedApproachFailure(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    allowBlockedGatherApproach: boolean
  ): void {
    this.routing.handleBlockedApproachFailure(dest, action, allowBlockedGatherApproach)
  }

  routeToReachableWaterApproach(
    dest: RuntimeEntity | RuntimeCell,
    action: string | null,
    allowBlockedGatherApproach: boolean
  ): boolean {
    return this.routing.routeToReachableWaterApproach(dest, action, allowBlockedGatherApproach)
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
    const startedAt = performance.now()
    if (forceRepath) this.unit.context?.performance?.record?.('unit.repath', 0)
    try {
      return this._sendToEvt(dest, action, {
        forceRepath,
        allowBlockedGatherApproach,
        preserveAutonomy,
        allowPassageStop,
      })
    } finally {
      this.unit.context?.performance?.record?.('unit.command', performance.now() - startedAt)
    }
  }

  _sendToEvt(
    dest: RuntimeEntity | RuntimeCell | null,
    action: string | null,
    {
      forceRepath = false,
      allowBlockedGatherApproach = true,
      preserveAutonomy = false,
      allowPassageStop = false,
    }: SendToOptions = {}
  ) {
    if (!this.unit.followingHero && !usesCautiousAnimalApproach(this.unit, dest, action)) {
      clearRequestedMoveSpeedFactor(this.unit)
    }
    return this.routing.sendToEvt(dest, action, {
      forceRepath,
      allowBlockedGatherApproach,
      preserveAutonomy,
      allowPassageStop,
    })
  }

  isUnitAtDest(action: string | null | undefined, dest: RuntimeEntity | RuntimeCell | null | undefined): boolean {
    const unit = this.unit
    if (!dest) return false
    if (isRuntimeEntity(dest) && usesUnitContactAction(unit, action)) {
      return canReachActionTarget(unit, dest, action)
    }
    if (!action && isUnitOnActionArrivalCell(unit, dest, action)) return true
    if (!action) return false
    if (action === ACTION_TYPES.train) return isUnitOnActionArrivalCell(unit, dest, action)
    if (isUnitOnActionArrivalCell(unit, dest, action)) return true
    if (isRuntimeEntity(dest) && isHeroActionInRange(unit, action, dest)) return true
    return this.isUnitInActionRange(action, dest)
  }

  private isUnitInActionRange(action: string, dest: RuntimeEntity | RuntimeCell): boolean {
    const unit = this.unit
    const { usesActionRange, effectiveRange } = this.actionRange(action)
    const distance = instancesDistance(unit, dest)
    debugHuntRangeCheck(unit, action, dest, effectiveRange, distance)
    if (unit.type === UNIT_TYPES.villager && action === ACTION_TYPES.captureHorse) {
      const isStableTarget = isRuntimeEntity(dest) && dest.family === FAMILY_TYPES.building
      if (isStableTarget) {
        return instanceContactInstance(unit, dest)
      }
      return effectiveRange !== undefined && distance <= effectiveRange
    }
    if (usesActionRange && effectiveRange && distance <= effectiveRange) {
      return true
    }
    return instanceContactInstance(unit, dest)
  }

  private actionRange(action: string): { usesActionRange: boolean; effectiveRange: number | undefined } {
    const unit = this.unit
    const usesActionRange =
      action === ACTION_TYPES.attack ||
      action === ACTION_TYPES.convert ||
      action === ACTION_TYPES.heal ||
      (unit.type === UNIT_TYPES.villager && (action === ACTION_TYPES.hunt || action === ACTION_TYPES.captureHorse))
    const effectiveRange =
      unit.type === UNIT_TYPES.villager && action === ACTION_TYPES.captureHorse
        ? CAPTURE_HORSE_TRIGGER_RANGE
        : unit.type === UNIT_TYPES.villager && action === ACTION_TYPES.hunt
          ? getUnitCombatRange(unit)
          : action === ACTION_TYPES.attack
            ? getUnitCombatRange(unit)
            : undefined
    return { usesActionRange, effectiveRange }
  }

  destHasMoved(): boolean {
    const unit = this.unit
    const dest = unit.dest
    if (!dest || !unit.realDest) return false
    if (!('family' in dest) || !playerSeesTarget(unit.owner, dest as RuntimeEntity)) return false
    observeTarget(unit.owner, dest as RuntimeEntity)
    return dest.i !== unit.realDest.i || dest.j !== unit.realDest.j
  }

  moveToPath() {
    const performanceMonitor = this.unit.context?.performance
    if (performanceMonitor) return performanceMonitor.measureSampled('unit.move', () => this._moveToPath())
    return this._moveToPath()
  }

  _moveToPath() {
    moveUnitToPath(this.unit, () => this.retryBlockedGatherApproach())
  }

  moveDirect(dirX: number, dirY: number, distance: number, options: DirectMoveOptions = {}): boolean {
    return this.directMovement.moveDirect(dirX, dirY, distance, options)
  }

  attemptSlideAlongRoundedFootprint(
    blocker: HeroDirectMoveBlocker,
    dirX: number,
    dirY: number,
    distance: number,
    facingDirX: number = dirX,
    facingDirY: number = dirY
  ): boolean {
    return this.directMovement.attemptSlideAlongRoundedFootprint(blocker, dirX, dirY, distance, facingDirX, facingDirY)
  }

  attemptSlideAroundSoftBody(
    blocker: HeroDirectMoveBlocker,
    dirX: number,
    dirY: number,
    distance: number,
    facingDirX: number = dirX,
    facingDirY: number = dirY
  ): boolean {
    return this.directMovement.attemptSlideAroundSoftBody(blocker, dirX, dirY, distance, facingDirX, facingDirY)
  }

  attemptMoveDirect(
    dirX: number,
    dirY: number,
    distance: number,
    facingDirX: number = dirX,
    facingDirY: number = dirY
  ): boolean {
    return this.directMovement.attemptMoveDirect(dirX, dirY, distance, facingDirX, facingDirY)
  }

  affectNewDest() {
    affectUnitNewDest(this.unit)
  }

  explore(): boolean {
    const unit = this.unit
    const map = getEntitySpaceMapLike(unit, unit.context?.map)
    if (!map) return false
    const { grid } = map
    const views = unit.owner?.views
    if (!views) return false
    const candidates: { cell: RuntimeCell; score: number; dist: number }[] = []
    const passageLookup = createReservedPassageCellLookup(unit.context)

    const maxRadius = grid.length + Math.max(0, ...grid.map(row => row.length))
    const search = getVillagerExplorationSearch(unit, grid, maxRadius)
    for (let r = 1; r <= search.radius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = unit.i + dx
        const row = grid[x]
        if (!row) continue
        const dyMax = r - Math.abs(dx)
        for (const dy of dyMax === 0 ? [0] : [-dyMax, dyMax]) {
          const cell = row[unit.j + dy]
          if (
            cell &&
            search.canTry(cell.i, cell.j) &&
            !views.isViewed(cell.i, cell.j) &&
            canUnitWaitOnCell(unit, cell, { passageLookup })
          ) {
            const unseenNeighbors = countExplorationNeighbors(
              cell,
              grid,
              neighbor =>
                !views.isViewed(neighbor.i, neighbor.j) && canUnitWaitOnCell(unit, neighbor, { passageLookup })
            )
            const score = unseenNeighbors * 3 - r
            candidates.push({ cell, score, dist: r })
          }
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score || a.dist - b.dist)

    for (const { cell } of candidates.slice(0, 12)) {
      const path = getInstancePath(unit, cell.i, cell.j, map)
      search.remember(cell.i, cell.j)
      if (path.length) {
        unit.exploringForAutonomy = true
        unit.sendToEvt?.(cell, null, { forceRepath: true, preserveAutonomy: true })
        return true
      }
    }

    search.expand()
    unit.exploringForAutonomy = false
    unit.stopInterval?.()
    unit.sprite?.stop()
    return false
  }

  runaway(instance: RuntimeEntity) {
    const unit = this.unit
    const map = getEntitySpaceMapLike(unit, unit.context?.map)
    if (!map) return
    const passageLookup = createReservedPassageCellLookup(unit.context)
    const cell = findReachableFleeCell<RuntimeCell>(unit, instance, map, {
      isCellAllowed: candidate => canUnitWaitOnCell(unit, candidate, { passageLookup }),
      range: unit.sight ?? 0,
    })
    if (cell) {
      debugCombatMove(unit, 'flee-cell-selected', cell, {
        stage: 'runaway',
        threat: { label: instance.label, type: instance.type },
      })
      markCombatFlee(unit)
      unit.sendTo?.(cell)
      return
    }
    const currentCell = unit.currentCell ?? map.grid[unit.i]?.[unit.j]
    if (currentCell) {
      debugCombatMove(unit, 'no-flee-cell', currentCell, {
        stage: 'runaway',
        threat: { label: instance.label, type: instance.type, i: instance.i, j: instance.j },
      })
    }
    unit.stop?.()
  }
}

function countExplorationNeighbors(
  cell: RuntimeCell,
  grid: RuntimeCell[][],
  isAvailable: (cell: RuntimeCell) => boolean
): number {
  let count = 0
  for (let i = cell.i - 1; i <= cell.i + 1; i++) {
    for (let j = cell.j - 1; j <= cell.j + 1; j++) {
      const neighbor = grid[i]?.[j]
      if (neighbor && isAvailable(neighbor)) count++
    }
  }
  return count
}
