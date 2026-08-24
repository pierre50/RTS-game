import {
  ACTION_TYPES,
  FAMILY_TYPES,
  RELIEF_CLIMB_SPEED_MULTIPLIER,
  RELIEF_LIFT_SMOOTHING,
  SHEET_TYPES,
  UNIT_TYPES,
  WORK_TYPES,
} from '../../constants'
import {
  canUpdateMinimap,
  cartesianToIsometric,
  degreeToDirection,
  getCellsAroundPoint,
  findInstancesInSight,
  findReachableFleeCell,
  getClosestInstanceWithPath,
  getGroundReliefLevel,
  getInstanceClosestFreeCellPath,
  getInstanceDegree,
  getInstancePath,
  getInstanceZIndex,
  instanceContactInstance,
  instancesDistance,
  isometricToCartesian,
  moveTowardPoint,
  playMovementSurfaceAudio,
  showBlockedFeedback,
  showConfusionFeedback,
  updateInstanceRenderVisibility,
  updateInstanceVisibility,
  clearVillagerAutonomy,
  resumeVillagerAutonomy,
} from '../../lib'
import { isHeroControlled } from '../../lib/unitControl'
import { isHeroActionInRange } from '../../lib/heroActionRange'
import { markCombatFlee } from '../../lib/combatBehavior'
import { getEnergyMoveSpeedMultiplier } from '../../lib/unitEnergy'
import { getUnitCombatRange } from '../../lib/equipmentStats'
import { debugBlockedDirectMove, debugCombatMove, debugHuntRangeCheck } from './UnitMovementDebug'
import {
  BLOCKED_GATHER_APPROACH_ACTIONS,
  CAPTURE_HORSE_TRIGGER_RANGE,
  GATHER_SEND_TO_BY_ACTION,
  MAX_BLOCKED_GATHER_APPROACH_DISTANCE,
  POST_BUILD_GATHER_ACTIONS,
  SLIDE_PROBE_ANGLES,
  cellOccupantIsDest,
  clearCellForUnit,
  getPathMoveSpeed,
  isCellBlockedForUnit,
  isDestroyedEntity,
  isMovingUnitEntity,
  isRecoveringAttack,
  isRuntimeEntity,
  isUnitCellOccupant,
  placeUnitOnCell,
  pauseCombatRecoveryMove,
  resumeAutonomyBeforeStopping,
  startActionIfAlreadyInRange,
  syncVillagerWorkForAction,
  type DirectMoveOptions,
  type SendToOptions,
} from './UnitMovementHelpers'
import {
  blocksHeroDirectMoveWithRoundedFootprint,
  blocksHeroDirectMoveWithSoftBody,
  createHeroTerrainMoveBlocker,
  getHeroCollisionFootprintPoints,
  getHeroDirectMoveBlockerAtPoint,
  isHeroLandTerrainBlockedCell,
  type HeroDirectMoveBlocker,
} from './UnitHeroDirectMovementCollision'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

export class UnitMovement {
  unit: UnitEntity
  // Side (+1/-1) of the last successful slide deflection. Re-probed first while the
  // slide lasts so the unit hugs one side of an obstacle instead of zigzagging when
  // both sides are free; cleared as soon as a direct move succeeds undeflected.
  slideBias: number
  directMoveBlocker: HeroDirectMoveBlocker | null
  // Eased slope-slowdown factor for direct (hero) movement — a hard 1.0↔0.7 toggle when the
  // underfoot cell flips at a tile boundary reads as stutter at 60Hz.
  directMoveClimbFactor: number

  constructor(unit: UnitEntity) {
    this.unit = unit
    this.slideBias = 0
    this.directMoveBlocker = null
    this.directMoveClimbFactor = 1
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
    const map = unit.context?.map
    if (!map) return null
    const maxDistance = Math.max(
      2,
      Math.min(unit.sight || MAX_BLOCKED_GATHER_APPROACH_DISTANCE, MAX_BLOCKED_GATHER_APPROACH_DISTANCE)
    )
    let best: { cell: RuntimeCell; path: RuntimeCell[] } | null = null

    for (let distance = minDistance; distance <= maxDistance; distance++) {
      const cells = getCellsAroundPoint(target.i, target.j, map.grid, distance, cell => {
        if (cell.solid || cell.border) return false
        return cell.category !== 'Water'
      })
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
      unit.affectNewDest?.()
      return true
    }

    unit.sendToEvt?.(target, action, { forceRepath: true, allowBlockedGatherApproach: false })
    return true
  }

  handleUnreachableDestination(action: string | null): void {
    const unit = this.unit
    if (action === ACTION_TYPES.delivery) {
      unit.stop?.()
    } else if (resumeAutonomyBeforeStopping(unit)) {
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
    const unit = this.unit
    const map = unit.context?.map
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
      if (currentDestMatchesTarget && unit.action === action && (unit.path?.length ?? 0) === 0) {
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
        path = getInstanceClosestFreeCellPath<RuntimeCell>(unit, dest, map)
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
    const unit = this.unit
    const map = unit.context?.map
    if (!map || !unit.path?.length) return
    const next = unit.path[unit.path.length - 1]
    const nextCell = map.grid[next.i][next.j]
    // unit.x/y are always flat; nextCell.x/y carry the terrain's baked relief offset, so any
    // distance/target math mixing the two must go through this flat equivalent of nextCell.
    const [nextFlatX, nextFlatY] = cartesianToIsometric(nextCell.i, nextCell.j)
    const nextFlatPoint = { i: nextCell.i, j: nextCell.j, x: nextFlatX, y: nextFlatY }
    if (unit.currentCell) {
      // The relief border is a slope, not a step: blend the lift continuously along the walk
      // between the two cells' ground levels, so a low→border→high climb reads as one single
      // ramp centered on the slope tile instead of two half-steps with a plateau between.
      const from = getGroundReliefLevel(unit.currentCell)
      const to = getGroundReliefLevel(nextCell)
      const total = instancesDistance(unit.currentCell, nextCell, false) || 1
      const remaining = Math.min(instancesDistance(unit, nextFlatPoint, false), total)
      unit.applyReliefLift?.(to + (from - to) * (remaining / total))
    }
    const dest = unit.dest
    if (!dest || isDestroyedEntity(dest)) {
      unit.affectNewDest?.()
      return
    }
    const nextCellHas = nextCell.has
    if (
      nextCellHas &&
      isMovingUnitEntity(nextCellHas) &&
      nextCellHas.label !== unit.label &&
      nextCellHas.hasPath?.() &&
      instancesDistance(unit, nextCellHas) <= 1 &&
      nextCellHas.sprite?.playing
    ) {
      debugCombatMove(unit, 'waiting-moving-blocker', nextCell, {
        stage: 'path-step',
        blocker: {
          label: nextCellHas.label,
          type: nextCellHas.type,
          family: nextCellHas.family,
          i: nextCellHas.i,
          j: nextCellHas.j,
          pathLength: nextCellHas.path?.length ?? 0,
        },
      })
      unit.sprite?.stop()
      return
    }
    if (nextCell.solid && isUnitCellOccupant(unit, nextCell)) {
      debugCombatMove(unit, 'self-solid-cell-allowed', nextCell, { stage: 'path-step' })
    }
    if (isCellBlockedForUnit(unit, nextCell) && unit.dest) {
      unit.context?.performance?.record?.('unit.blockedPath', 0)
      debugCombatMove(unit, 'blocked-solid-cell', nextCell, { stage: 'path-step' })
      if (cellOccupantIsDest(nextCell, dest) && startActionIfAlreadyInRange(unit, dest, 'blocked-target-cell-in-range')) {
        return
      }
      if (isRecoveringAttack(unit)) {
        pauseCombatRecoveryMove(unit)
        return
      }
      unit.sendToEvt?.(dest, unit.action ?? null, { forceRepath: true })
      return
    }
    const sprite = unit.sprite
    if (!sprite) return
    if (!sprite.playing) {
      sprite.play()
    }
    const moveSpeed = getPathMoveSpeed(unit, nextCell)
    if (instancesDistance(unit, nextFlatPoint, false) <= moveSpeed) {
      const oldI = unit.i,
        oldJ = unit.j
      const beforeX = unit.x
      const beforeY = unit.y
      unit.z = nextCell.z
      unit.i = nextCell.i
      unit.j = nextCell.j
      unit.zIndex = getInstanceZIndex(unit)
      clearCellForUnit(unit, unit.currentCell)
      unit.currentCell = map.grid[unit.i][unit.j]
      placeUnitOnCell(unit, unit.currentCell)
      map.updateInstanceBucket(unit, oldI, oldJ)
      updateInstanceVisibility(unit)
      unit.path.pop()
      if (unit.destHasMoved?.()) {
        unit.sendToEvt?.(dest, unit.action ?? null, { forceRepath: true })
        return
      }
      if (unit.isUnitAtDest?.(unit.action, dest)) {
        unit.path = []
        unit.stopInterval?.()
        unit.degree = getInstanceDegree(unit, dest.x, dest.y)
        unit.getAction?.(unit.action ?? '')
        return
      }
      if (!unit.path.length) {
        if (isRecoveringAttack(unit)) {
          pauseCombatRecoveryMove(unit)
          return
        }
        if (this.retryBlockedGatherApproach()) return
        unit.affectNewDest?.()
      }
      playMovementSurfaceAudio(unit, Math.hypot(unit.x - beforeX, unit.y - beforeY), {
        previousX: beforeX,
        previousY: beforeY,
      })
    } else {
      const menu = unit.context?.menu
      const player = unit.owner
      const oldDeg = unit.degree
      const wasWalking = unit.currentSheet === SHEET_TYPES.walking
      const beforeX = unit.x
      const beforeY = unit.y
      moveTowardPoint(unit, nextFlatX, nextFlatY, moveSpeed)
      if (unit.x === beforeX && unit.y === beforeY) {
        debugCombatMove(unit, 'no-position-progress', nextCell, {
          stage: 'path-step',
          moveSpeed,
          nextFlatX,
          nextFlatY,
        })
      }
      playMovementSurfaceAudio(unit, Math.hypot(unit.x - beforeX, unit.y - beforeY), {
        previousX: beforeX,
        previousY: beforeY,
      })
      canUpdateMinimap(unit, player) && menu?.updatePlayerMiniMap?.(unit.owner!)
      if (!wasWalking || degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
        unit.setTextures?.(SHEET_TYPES.walking)
      }
    }
  }

  moveDirect(dirX: number, dirY: number, distance: number, options: DirectMoveOptions = {}): boolean {
    const unit = this.unit
    const map = unit.context?.map
    if (!map || !unit.sprite || (dirX === 0 && dirY === 0) || distance <= 0) {
      debugBlockedDirectMove(
        unit,
        'precondition',
        { hasMap: Boolean(map), hasSprite: Boolean(unit.sprite), distance },
        dirX,
        dirY
      )
      return false
    }

    this.directMoveBlocker = null
    const facingDirX = options.facingDirX ?? dirX
    const facingDirY = options.facingDirY ?? dirY
    if (this.attemptMoveDirect(dirX, dirY, distance, facingDirX, facingDirY)) {
      this.slideBias = 0
      return true
    }
    const blocker = this.directMoveBlocker
    if (
      blocker &&
      blocksHeroDirectMoveWithRoundedFootprint(blocker) &&
      this.attemptSlideAlongRoundedFootprint(blocker, dirX, dirY, distance, facingDirX, facingDirY)
    ) {
      return true
    }
    if (
      blocker &&
      blocksHeroDirectMoveWithSoftBody(blocker) &&
      this.attemptSlideAroundSoftBody(blocker, dirX, dirY, distance, facingDirX, facingDirY)
    ) {
      return true
    }
    if (blocker && !blocksHeroDirectMoveWithSoftBody(blocker)) return false
    // Blocked head-on — slide along the obstacle's contour instead of stopping dead:
    // probe directions fanning out from the input, nearest deflection first. Distance
    // is scaled by cos(deflection) so hugging a wall is slower than moving freely.
    // The requested (dirX, dirY) is kept as the facing direction for every probe so
    // the sprite keeps facing the input direction instead of flickering toward
    // whichever side the slide resolved to.
    const baseAngle = Math.atan2(dirY, dirX)
    const probeSigns = this.slideBias ? [this.slideBias, -this.slideBias] : [1, -1]
    for (const step of SLIDE_PROBE_ANGLES) {
      const slideDistance = distance * Math.cos(step)
      for (const sign of probeSigns) {
        const angle = baseAngle + sign * step
        if (this.attemptMoveDirect(Math.cos(angle), Math.sin(angle), slideDistance, facingDirX, facingDirY)) {
          this.slideBias = sign
          return true
        }
      }
    }
    return false
  }

  attemptSlideAlongRoundedFootprint(
    blocker: HeroDirectMoveBlocker,
    dirX: number,
    dirY: number,
    distance: number,
    facingDirX: number = dirX,
    facingDirY: number = dirY
  ): boolean {
    const unit = this.unit
    const points = getHeroCollisionFootprintPoints(blocker, unit.context?.map)
    let tangentX = 0
    let tangentY = 0
    let closestDistanceSq = Infinity

    for (let index = 0; index < points.length; index++) {
      const a = points[index]
      const b = points[(index + 1) % points.length]
      const segmentX = b.x - a.x
      const segmentY = b.y - a.y
      const segmentLengthSq = segmentX * segmentX + segmentY * segmentY
      if (segmentLengthSq <= 0) continue
      const t = Math.max(0, Math.min(1, ((unit.x - a.x) * segmentX + (unit.y - a.y) * segmentY) / segmentLengthSq))
      const closestX = a.x + segmentX * t
      const closestY = a.y + segmentY * t
      const distanceSq = (unit.x - closestX) ** 2 + (unit.y - closestY) ** 2
      if (distanceSq < closestDistanceSq) {
        closestDistanceSq = distanceSq
        const segmentLength = Math.sqrt(segmentLengthSq)
        tangentX = segmentX / segmentLength
        tangentY = segmentY / segmentLength
      }
    }

    if (!Number.isFinite(closestDistanceSq)) return false
    const alignment = dirX * tangentX + dirY * tangentY
    const sign = alignment >= 0 ? 1 : -1
    const slideX = tangentX * sign
    const slideY = tangentY * sign
    const slideDistance = distance * Math.max(0.2, Math.abs(alignment))
    if (!this.attemptMoveDirect(slideX, slideY, slideDistance, facingDirX, facingDirY)) return false
    this.slideBias = sign
    return true
  }

  attemptSlideAroundSoftBody(
    blocker: HeroDirectMoveBlocker,
    dirX: number,
    dirY: number,
    distance: number,
    facingDirX: number = dirX,
    facingDirY: number = dirY
  ): boolean {
    const unit = this.unit
    const awayX = unit.x - (blocker.x ?? unit.x)
    const awayY = unit.y - (blocker.y ?? unit.y)
    const awayLength = Math.hypot(awayX, awayY)
    if (awayLength <= 0) return false

    const tangentX = -awayY / awayLength
    const tangentY = awayX / awayLength
    const alignment = dirX * tangentX + dirY * tangentY
    const firstSign = alignment >= 0 ? 1 : -1
    const probeSigns = this.slideBias ? [this.slideBias, -this.slideBias] : [firstSign, -firstSign]

    for (const sign of probeSigns) {
      const slideX = tangentX * sign * 0.7 + dirX * 0.3
      const slideY = tangentY * sign * 0.7 + dirY * 0.3
      const slideLength = Math.hypot(slideX, slideY)
      if (
        slideLength > 0 &&
        this.attemptMoveDirect(slideX / slideLength, slideY / slideLength, distance * 0.75, facingDirX, facingDirY)
      ) {
        this.slideBias = sign
        return true
      }
    }

    return false
  }

  attemptMoveDirect(
    dirX: number,
    dirY: number,
    distance: number,
    facingDirX: number = dirX,
    facingDirY: number = dirY
  ): boolean {
    const unit = this.unit
    const map = unit.context?.map
    if (!map || !unit.sprite || (dirX === 0 && dirY === 0) || distance <= 0) return false

    // Driven purely by the cell the unit is actually standing on (stable, no lookahead) —
    // the relief-border tile IS the slope, so slowing down while on it covers the whole climb.
    const targetClimbFactor = unit.currentCell?.inclined ? RELIEF_CLIMB_SPEED_MULTIPLIER : 1
    this.directMoveClimbFactor += (targetClimbFactor - this.directMoveClimbFactor) * RELIEF_LIFT_SMOOTHING
    const effectiveDistance = distance * this.directMoveClimbFactor * getEnergyMoveSpeedMultiplier(unit)

    const candidateX = unit.x + dirX * effectiveDistance
    const candidateY = unit.y + dirY * effectiveDistance
    const [rawI, rawJ] = isometricToCartesian(candidateX, candidateY)
    if (rawI < 0 || rawJ < 0 || rawI > map.size || rawJ > map.size) {
      debugBlockedDirectMove(unit, 'target-out-of-map', { rawI, rawJ, mapSize: map.size }, dirX, dirY)
      return false
    }
    const newI = Math.min(Math.max(rawI, 0), map.size)
    const newJ = Math.min(Math.max(rawJ, 0), map.size)
    const crossingCell = newI !== unit.i || newJ !== unit.j
    const targetCell = crossingCell ? map.grid[newI]?.[newJ] : unit.currentCell

    if (crossingCell) {
      if (!targetCell) {
        debugBlockedDirectMove(unit, 'missing-target-cell', { rawI, rawJ, newI, newJ }, dirX, dirY)
        return false
      }
      if (targetCell.border) {
        debugBlockedDirectMove(unit, 'target-border', { rawI, rawJ, newI, newJ, targetCell }, dirX, dirY)
        return false
      }
      if (!isHeroControlled(unit) && isCellBlockedForUnit(unit, targetCell)) {
        debugCombatMove(unit, 'direct-target-solid', targetCell, {
          stage: 'direct-move',
          rawI,
          rawJ,
          newI,
          newJ,
        })
        return false
      }
      const categoryAllowed = targetCell.category !== 'Water' && !isHeroLandTerrainBlockedCell(unit, targetCell)
      if (!categoryAllowed) {
        if (isHeroLandTerrainBlockedCell(unit, targetCell)) {
          this.directMoveBlocker = createHeroTerrainMoveBlocker(targetCell)
        }
        debugBlockedDirectMove(
          unit,
          'target-category',
          { rawI, rawJ, newI, newJ, category: targetCell.category, waterBorder: targetCell.waterBorder },
          dirX,
          dirY
        )
        return false
      }
    }
    if (isHeroControlled(unit)) {
      const blocker = getHeroDirectMoveBlockerAtPoint(unit, targetCell, candidateX, candidateY)
      if (blocker) {
        this.directMoveBlocker = blocker
        debugBlockedDirectMove(
          unit,
          'target-occupied',
          {
            rawI,
            rawJ,
            newI,
            newJ,
            target: {
              solid: targetCell?.solid,
              category: targetCell?.category,
              has: { type: blocker.type, family: blocker.family, label: blocker.label },
            },
          },
          dirX,
          dirY
        )
        return false
      }
    }

    const oldI = unit.i
    const oldJ = unit.j
    const oldDeg = unit.degree ?? 0
    const wasWalking = unit.currentSheet === SHEET_TYPES.walking
    const beforeX = unit.x
    const beforeY = unit.y
    unit.degree = getInstanceDegree(unit, unit.x + facingDirX, unit.y + facingDirY)
    unit.x = candidateX
    unit.y = candidateY

    if (crossingCell && targetCell) {
      unit.z = targetCell.z
      unit.i = newI
      unit.j = newJ
      unit.zIndex = getInstanceZIndex(unit)
      clearCellForUnit(unit, unit.currentCell)
      unit.currentCell = targetCell
      if (isHeroControlled(unit) && targetCell.solid && !targetCell.has) {
        // Stale flag left over from elsewhere — the placement below keeps solid/has in sync
        // for the hero same as any other unit, this only guards a cell that never got cleared.
        targetCell.solid = false
      }
      // The hero marks its own cell solid too, same as any other unit: this is what makes
      // followers and attackers path around a busy hero instead of all converging onto its
      // exact tile (see getInstanceClosestFreeCellPath / AIMilitary's surround assignment,
      // both already gated on the destination cell being solid).
      placeUnitOnCell(unit, targetCell)
      if (isHeroControlled(unit)) {
        updateInstanceRenderVisibility(unit)
        unit.visible = true
      }
      map.updateInstanceBucket(unit, oldI, oldJ)
    }
    updateInstanceVisibility(unit)
    unit.applyReliefLift?.(getGroundReliefLevel(unit.currentCell))
    playMovementSurfaceAudio(unit, effectiveDistance, { previousX: beforeX, previousY: beforeY })
    if (!unit.actionLocked) {
      if (!unit.sprite.playing) unit.sprite.play()
      if (!wasWalking || degreeToDirection(oldDeg) !== degreeToDirection(unit.degree ?? 0)) {
        unit.setTextures?.(SHEET_TYPES.walking)
      }
    }
    return true
  }

  affectNewDest() {
    const unit = this.unit
    unit.stopInterval?.()
    if (!unit.action) {
      if (isRecoveringAttack(unit)) {
        pauseCombatRecoveryMove(unit)
        return
      }
      if (resumeVillagerAutonomy?.(unit)) return
      unit.stop?.()
      return
    }
    // Checked before any of the AI-oriented branches below (build-queue continuation, post-build
    // auto-gather, auto-hunt/auto-attack acquisition) — the hero must never
    // auto-continue into a new job or path there on its own, no matter which branch would
    // otherwise apply.
    if (isHeroControlled(unit)) {
      showConfusionFeedback(unit)
      unit.previousDest = null
      unit.previousWork = null
      unit.stop?.()
      return
    }
    const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
    const queuedBuildInterrupted =
      unit.work === WORK_TYPES.builder && unit.action === ACTION_TYPES.build && (unit.buildQueue?.length ?? 0) > 0
    if (queuedBuildInterrupted) {
      if (dest && unit.getActionCondition?.(dest, ACTION_TYPES.build) && unit.buildQueue) {
        unit.buildQueue.push(unit.buildQueue.shift()!)
      }
      unit.stop?.()
      unit.context?.scheduler?.addOneShot?.(
        () => {
          if (unit.inactif && (unit.buildQueue?.length ?? 0) > 0) unit.continueBuildingQueue?.()
        },
        500,
        'unit.resumeBuildQueue'
      )
      return
    }

    const lostBuildTarget =
      unit.work === WORK_TYPES.builder &&
      unit.action === ACTION_TYPES.build &&
      (!dest || !unit.getActionCondition?.(dest, ACTION_TYPES.build))

    if (lostBuildTarget) {
      if (unit.previousDest || unit.previousWork) {
        unit.goBackToPrevious?.()
        return
      }

      if (this.sendToPostBuildResource()) return

      const unitAsInstance = unit
      const targets = findInstancesInSight<UnitEntity, RuntimeEntity>(unitAsInstance, instance =>
        Boolean(unit.getActionCondition?.(instance, ACTION_TYPES.build))
      )
      if (targets.length) {
        const target = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(unitAsInstance, targets)
        if (target) {
          unit.setDest?.(target.instance)
          unit.setPath?.(target.path)
          return
        }
      }

      unit.stop?.()
      unit.work = null
      return
    }

    if (unit.previousDest && unit.action !== ACTION_TYPES.delivery) {
      unit.goBackToPrevious?.()
      return
    }
    let handleSuccess = false
    if (
      unit.type === UNIT_TYPES.villager &&
      (unit.action === ACTION_TYPES.takemeat || unit.action === ACTION_TYPES.hunt)
    ) {
      handleSuccess = Boolean(unit.handleAffectNewDestHunter?.())
    } else if (!dest || dest.family !== FAMILY_TYPES.animal) {
      const unitAsInstance = unit
      const targets = findInstancesInSight<UnitEntity, RuntimeEntity>(unitAsInstance, instance =>
        Boolean(unit.getActionCondition?.(instance))
      )
      if (targets.length) {
        const target = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(unitAsInstance, targets)
        if (target) {
          unit.setDest?.(target.instance)
          if (instanceContactInstance(unitAsInstance, target.instance)) {
            unit.degree = getInstanceDegree(unitAsInstance, target.instance.x, target.instance.y)
            unit.getAction?.(unit.action)
            return
          }
          unit.setPath?.(target.path)
          return
        }
      }
    }
    if (!handleSuccess) {
      const notDeliveryWork = [WORK_TYPES.builder, WORK_TYPES.attacker, WORK_TYPES.healer]
      if (unit.loading && unit.work === WORK_TYPES.builder && unit.previousWork) {
        unit.goBackToPrevious?.()
      } else if (unit.loading && unit.work && !notDeliveryWork.includes(unit.work)) {
        unit.sendToDelivery?.()
      } else if (resumeVillagerAutonomy?.(unit)) {
        return
      } else {
        showConfusionFeedback(unit)
        unit.stop?.()
      }
    }
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
