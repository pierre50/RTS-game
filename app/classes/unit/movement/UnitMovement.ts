import {
  ACTION_TYPES,
  FAMILY_TYPES,
  UNIT_TYPES,
} from '../../../constants'
import {
  findReachableFleeCell,
  getInstancePath,
  instanceContactInstance,
  instancesDistance,
} from '../../../lib'
import { isHeroActionInRange } from '../../../lib/hero/heroActionRange'
import { markCombatFlee } from '../../../lib/combat/combatBehavior'
import { getUnitCombatRange } from '../../../lib/equipment/equipmentStats'
import { UnitDirectMovement } from './UnitDirectMovement'
import { UnitMovementRouting } from './UnitMovementRouting'
import { moveUnitToPath } from './UnitPathMovement'
import { debugCombatMove, debugHuntRangeCheck } from './UnitMovementDebug'
import {
  CAPTURE_HORSE_TRIGGER_RANGE,
  clearRequestedMoveSpeedFactor,
  isCellBlockedForUnit,
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

  get directMoveClimbFactor(): number {
    return this.directMovement.directMoveClimbFactor
  }

  set directMoveClimbFactor(value: number) {
    this.directMovement.directMoveClimbFactor = value
  }

  sendToPostBuildResource(): boolean {
    return this.routing.sendToPostBuildResource()
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
    { forceRepath = false, allowBlockedGatherApproach = true, preserveAutonomy = false }: SendToOptions = {}
  ) {
    const startedAt = performance.now()
    if (forceRepath) this.unit.context?.performance?.record?.('unit.repath', 0)
    try {
      return this._sendToEvt(dest, action, { forceRepath, allowBlockedGatherApproach, preserveAutonomy })
    } finally {
      this.unit.context?.performance?.record?.('unit.command', performance.now() - startedAt)
    }
  }

  _sendToEvt(
    dest: RuntimeEntity | RuntimeCell | null,
    action: string | null,
    { forceRepath = false, allowBlockedGatherApproach = true, preserveAutonomy = false }: SendToOptions = {}
  ) {
    if (!this.unit.followingHero && !usesCautiousAnimalApproach(this.unit, dest, action)) {
      clearRequestedMoveSpeedFactor(this.unit)
    }
    return this.routing.sendToEvt(dest, action, { forceRepath, allowBlockedGatherApproach, preserveAutonomy })
  }

  isUnitAtDest(action: string | null | undefined, dest: RuntimeEntity | RuntimeCell | null | undefined): boolean {
    const unit = this.unit
    if (!action || !dest) return false
    if (isRuntimeEntity(dest) && isHeroActionInRange(unit, action, dest)) return true
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

  destHasMoved(): boolean {
    const unit = this.unit
    const dest = unit.dest
    if (!dest || !unit.realDest) return false
    return (
      (dest.i !== unit.realDest.i || dest.j !== unit.realDest.j) && instancesDistance(unit, dest) <= (unit.sight ?? 0)
    )
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
    affectUnitNewDest(this.unit, this)
  }

  explore(): boolean {
    const unit = this.unit
    const map = unit.context?.map
    if (!map) return false
    const { grid } = map
    const views = unit.owner?.views
    if (!views) return false
    const candidates: { cell: RuntimeCell; score: number; dist: number }[] = []

    for (let r = 1; r <= 50; r++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = unit.i + dx
        const row = grid[x]
        if (!row) continue
        const dyMax = r - Math.abs(dx)
        for (const dy of dyMax === 0 ? [0] : [-dyMax, dyMax]) {
          const cell = row[unit.j + dy]
          if (cell && !views.isViewed(cell.i, cell.j) && !cell.solid) {
            let unseenNeighbors = 0
            for (let ni = cell.i - 1; ni <= cell.i + 1; ni++) {
              for (let nj = cell.j - 1; nj <= cell.j + 1; nj++) {
                const neighbor = grid[ni]?.[nj]
                if (neighbor && !views.isViewed(ni, nj) && !neighbor.solid) unseenNeighbors++
              }
            }
            const score = unseenNeighbors * 3 - r
            candidates.push({ cell, score, dist: r })
          }
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score || a.dist - b.dist)

    for (const { cell } of candidates.slice(0, 12)) {
      const path = getInstancePath(unit, cell.i, cell.j, map)
      if (path.length) {
        unit.sendToEvt?.(cell, null, { forceRepath: true, preserveAutonomy: true })
        return true
      }
    }

    unit.stop?.()
    return false
  }

  runaway(instance: RuntimeEntity) {
    const unit = this.unit
    const map = unit.context?.map
    if (!map) return
    const cell = findReachableFleeCell<RuntimeCell>(unit, instance, map, {
      isCellAllowed: candidate => !isCellBlockedForUnit(unit, candidate) && candidate.category !== 'Water' && !candidate.border,
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
