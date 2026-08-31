import { UNIT_TYPES } from '../constants'
import { scheduleUnitWalkAround } from '../lib/units/walkAround'
import { UnitWalkAroundPatrolController } from './UnitWalkAroundPatrolController'
import type { GameContextLike } from '../types/context'
import type { UnitEntity } from '../types/entities'

const IDLE_PATROL_SCAN_INTERVAL_MS = 3000
const IDLE_PATROL_DELAY_MIN_MS = 14000
const IDLE_PATROL_DELAY_MAX_MS = 32000
const IDLE_PATROL_RANGE = 2

function canIdlePatrol(unit: UnitEntity): boolean {
  return Boolean(
    unit.type !== UNIT_TYPES.hero &&
      unit.controlMode !== 'hero' &&
      !unit.followingHero &&
      !unit.work &&
      !unit.autonomousJob &&
      !unit.lookingAtHero &&
      !unit.waitingForEnergyAction &&
      !unit.trainingTargetType &&
      unit.combatMode !== 'attack' &&
      unit.combatMode !== 'recover' &&
      unit.combatMode !== 'flee'
  )
}

function isIdlePatrolUnit(unit: UnitEntity | null | undefined): unit is UnitEntity {
  return Boolean(unit && !unit.isDead && !unit.isDestroyed && canIdlePatrol(unit))
}

export class IdleUnitPatrolSystem {
  context: GameContextLike
  private patrols: UnitWalkAroundPatrolController

  constructor(context: GameContextLike) {
    this.context = context
    this.patrols = new UnitWalkAroundPatrolController({
      clearTaskId: unit => {
        unit.idlePatrolTaskId = null
      },
      context,
      getTaskId: unit => unit.idlePatrolTaskId,
      getUnits: () => (context.players ?? []).flatMap(player => player.units ?? []),
      isEligible: isIdlePatrolUnit,
      scanIntervalMs: IDLE_PATROL_SCAN_INTERVAL_MS,
      scanTaskName: 'unitIdle.patrol.scan',
      scheduleUnit: (unit, onTaskId) => this.scheduleNextPatrol(unit, onTaskId),
      setTaskId: (unit, taskId) => {
        unit.idlePatrolTaskId = taskId
      },
    })
    this.start()
  }

  start(): void {
    this.patrols.start()
  }

  update(): void {
    this.patrols.update()
  }

  scheduleNextPatrol(unit: UnitEntity, onTaskId?: (unit: UnitEntity, taskId: number | null) => void): void {
    if (!isIdlePatrolUnit(unit)) return

    scheduleUnitWalkAround(unit, {
      anchor: target => target,
      canMove: canIdlePatrol,
      delayMaxMs: () => IDLE_PATROL_DELAY_MAX_MS,
      delayMinMs: () => IDLE_PATROL_DELAY_MIN_MS,
      onTaskId,
      range: () => IDLE_PATROL_RANGE,
      shouldContinue: isIdlePatrolUnit,
      taskName: 'unitIdle.patrol',
    })
  }

  destroy(): void {
    this.patrols.destroy()
  }
}
