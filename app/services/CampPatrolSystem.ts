import { ACTION_TYPES, FAMILY_TYPES } from '../constants'
import { findInstancesInSight, getCellsAroundPoint, instancesDistance, scheduleAmbientMove } from '../lib'
import type { SchedulerTaskId, GameContextLike } from '../types/context'
import type { RuntimeCell } from '../types/map'
import type { RuntimeEntity, UnitEntity } from '../types/entities'

const PATROL_DELAY_MIN_MS = 3500
const PATROL_DELAY_MAX_MS = 8500
const PATROL_RANGE = 4
const AGGRO_SCAN_INTERVAL_MS = 500

function canPatrol(unit: UnitEntity): boolean {
  return Boolean(
    !unit.isDead &&
      !unit.isDestroyed &&
      !unit.action &&
      !unit.dest &&
      !(unit.path?.length) &&
      unit.combatMode !== 'attack'
  )
}

function getCampPatrolAnchor(unit: UnitEntity) {
  return unit.campPatrolAnchor ?? unit.banditCampAnchor ?? null
}

function isCampPatrolUnit(unit: UnitEntity | null | undefined): unit is UnitEntity {
  return Boolean(unit && !unit.isDead && !unit.isDestroyed && getCampPatrolAnchor(unit))
}

export class CampPatrolSystem {
  context: GameContextLike
  taskIds: Set<SchedulerTaskId>
  aggroTaskId: SchedulerTaskId | null

  constructor(context: GameContextLike) {
    this.context = context
    this.taskIds = new Set()
    this.aggroTaskId = null
    this.start()
  }

  start(): void {
    const map = this.context.map
    const scheduler = this.context.scheduler
    if (!map || !scheduler || this.context.editor) return

    for (const player of this.context.players ?? []) {
      for (const unit of player.units ?? []) {
        if (!isCampPatrolUnit(unit)) continue
        if (!unit.campPatrolAnchor && unit.banditCampAnchor) unit.campPatrolAnchor = unit.banditCampAnchor
        if (unit.campPatrolTaskId != null) continue
        this.scheduleNextPatrol(unit)
      }
    }

    this.aggroTaskId ??= scheduler.add(() => this.updateAggro(), AGGRO_SCAN_INTERVAL_MS, 'campPatrol.aggro')
  }

  scheduleNextPatrol(unit: UnitEntity): void {
    const scheduler = this.context.scheduler
    const map = this.context.map
    if (!scheduler || !map) return

    scheduleAmbientMove(unit, {
      canMove: canPatrol,
      delayMaxMs: () => PATROL_DELAY_MAX_MS,
      delayMinMs: () => PATROL_DELAY_MIN_MS,
      move: (target, destination) => {
        if (target.sendToEvt) target.sendToEvt(destination, null, { forceRepath: true })
        else target.sendTo?.(destination)
      },
      onTaskId: (target, taskId) => {
        const previousTaskId = target.campPatrolTaskId
        if (previousTaskId != null) this.taskIds.delete(previousTaskId)
        target.campPatrolTaskId = taskId
        if (taskId != null) this.taskIds.add(taskId)
      },
      pickDestination: target => this.findPatrolDestination(target),
      randomRange: (min, max) => map.randomRange(min, max),
      scheduler,
      shouldContinue: isCampPatrolUnit,
      taskName: 'campPatrol.patrol',
    })
  }

  findPatrolDestination(unit: UnitEntity): RuntimeCell | null {
    const map = this.context.map
    const anchor = getCampPatrolAnchor(unit)
    if (!map || !anchor) return null

    const cells = getCellsAroundPoint(anchor.i, anchor.j, map.grid, PATROL_RANGE, cell =>
      Boolean(
        !cell.solid &&
          !cell.has &&
          !cell.border &&
          !cell.waterBorder &&
          cell.category !== 'Water' &&
          (cell.i !== unit.i || cell.j !== unit.j)
      )
    )

    return cells.length ? map.randomItem(cells) : null
  }

  updateAggro(): void {
    if (this.context.editor) return

    for (const player of this.context.players ?? []) {
      for (const unit of player.units ?? []) {
        if (!isCampPatrolUnit(unit)) continue
        if (unit.action === ACTION_TYPES.attack && unit.dest) continue

        const target = this.findAggroTarget(unit)
        if (target) unit.sendToAttack?.(target)
      }
    }
  }

  findAggroTarget(unit: UnitEntity): RuntimeEntity | null {
    const targets = findInstancesInSight<UnitEntity, RuntimeEntity>(unit, target =>
      Boolean(
        target !== unit &&
          !target.isDead &&
          !target.isDestroyed &&
          (target.family === FAMILY_TYPES.unit || target.family === FAMILY_TYPES.building) &&
          unit.owner?.isEnemy?.(target.owner) &&
          unit.getActionCondition?.(target, ACTION_TYPES.attack)
      )
    )

    return targets.reduce<RuntimeEntity | null>(
      (closest, target) =>
        !closest || instancesDistance(unit, target) < instancesDistance(unit, closest) ? target : closest,
      null
    )
  }

  destroy(): void {
    const scheduler = this.context.scheduler
    if (scheduler) {
      for (const taskId of this.taskIds) scheduler.remove(taskId)
      if (this.aggroTaskId != null) scheduler.remove(this.aggroTaskId)
    }
    this.taskIds.clear()
    this.aggroTaskId = null
  }
}
