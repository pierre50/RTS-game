import { BUILDING_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { isChiefUnit } from '../lib/chief'
import { sameMapSpace } from '../lib/mapSpaces'
import { scheduleUnitWalkAround } from '../lib/units/walkAround'
import { UnitWalkAroundPatrolController } from './UnitWalkAroundPatrolController'
import type { GameContextLike } from '../types/context'
import type { UnitEntity } from '../types/entities'

const IDLE_PATROL_SCAN_INTERVAL_MS = 3000
const IDLE_PATROL_DELAY_MIN_MS = 14000
const IDLE_PATROL_DELAY_MAX_MS = 32000
const IDLE_PATROL_RANGE = 2

function chiefPatrolAnchor(unit: UnitEntity) {
  if (!unit.owner?.isPlayed || !isChiefUnit(unit)) return null
  return unit.owner.buildings?.find(building =>
    building.type === BUILDING_TYPES.townCenter && building.isBuilt && !building.isDead &&
    !building.isDestroyed && sameMapSpace(unit, building)
  ) ?? null
}

function canIdlePatrol(unit: UnitEntity): boolean {
  return Boolean(
    unit.type !== UNIT_TYPES.hero &&
      unit.controlMode !== 'hero' &&
      !unit.followingHero &&
      (!unit.work || (Boolean(chiefPatrolAnchor(unit)) && unit.work === WORK_TYPES.attacker)) &&
      !unit.autonomousJob &&
      !unit.lookingAtHero &&
      !unit.actionLocked &&
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
      anchor: target => chiefPatrolAnchor(target) ?? target,
      canMove: canIdlePatrol,
      delayMaxMs: target => chiefPatrolAnchor(target) ? 12000 : IDLE_PATROL_DELAY_MAX_MS,
      delayMinMs: target => chiefPatrolAnchor(target) ? 6000 : IDLE_PATROL_DELAY_MIN_MS,
      onTaskId,
      range: target => chiefPatrolAnchor(target) ? 6 : IDLE_PATROL_RANGE,
      shouldContinue: isIdlePatrolUnit,
      taskName: 'unitIdle.patrol',
    })
  }

  destroy(): void {
    this.patrols.destroy()
  }
}
