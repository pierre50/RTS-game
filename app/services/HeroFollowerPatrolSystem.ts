import { UNIT_TYPES } from '../constants'
import { sameMapSpace } from '../lib/mapSpaces'
import { scheduleUnitWalkAround } from '../lib/units/walkAround'
import { UnitWalkAroundPatrolController } from './UnitWalkAroundPatrolController'
import type { GameContextLike } from '../types/context'
import type { UnitEntity } from '../types/entities'

const FOLLOWER_PATROL_SCAN_INTERVAL_MS = 2000
const FOLLOWER_PATROL_DELAY_MIN_MS = 10000
const FOLLOWER_PATROL_DELAY_MAX_MS = 22000
const FOLLOWER_PATROL_RANGE = 2

function getHero(context: GameContextLike): UnitEntity | null {
  return context.controls?.heroUnit ?? null
}

function isHeroFollowerInfantry(unit: UnitEntity, hero: UnitEntity | null): boolean {
  return Boolean(
    hero &&
      unit !== hero &&
      unit.type === UNIT_TYPES.infantry &&
      unit.followingHero &&
      !unit.isDead &&
      !unit.isDestroyed &&
      sameMapSpace(unit, hero)
  )
}

function canFollowerPatrol(unit: UnitEntity): boolean {
  return Boolean(!unit.lookingAtHero && !unit.waitingForEnergyAction)
}

export class HeroFollowerPatrolSystem {
  context: GameContextLike
  private patrols: UnitWalkAroundPatrolController

  constructor(context: GameContextLike) {
    this.context = context
    this.patrols = new UnitWalkAroundPatrolController({
      clearTaskId: unit => {
        unit.heroFollowerPatrolTaskId = null
      },
      context,
      getCleanupUnits: () => (context.players ?? []).flatMap(player => player.units ?? []),
      getTaskId: unit => unit.heroFollowerPatrolTaskId,
      getUnits: () => {
        const hero = getHero(context)
        if (!hero || hero.isDead || hero.isDestroyed) return []
        return hero.owner?.units ?? []
      },
      isEligible: unit => isHeroFollowerInfantry(unit, getHero(context)),
      scanIntervalMs: FOLLOWER_PATROL_SCAN_INTERVAL_MS,
      scanTaskName: 'heroFollower.patrol.scan',
      scheduleUnit: (unit, onTaskId) => this.scheduleNextPatrol(unit, onTaskId),
      setTaskId: (unit, taskId) => {
        unit.heroFollowerPatrolTaskId = taskId
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
    const hero = getHero(this.context)
    if (!isHeroFollowerInfantry(unit, hero)) return

    scheduleUnitWalkAround(unit, {
      anchor: () => getHero(this.context),
      canMove: canFollowerPatrol,
      delayMaxMs: () => FOLLOWER_PATROL_DELAY_MAX_MS,
      delayMinMs: () => FOLLOWER_PATROL_DELAY_MIN_MS,
      onTaskId,
      range: () => FOLLOWER_PATROL_RANGE,
      shouldContinue: target => isHeroFollowerInfantry(target, getHero(this.context)),
      taskName: 'heroFollower.patrol',
    })
  }

  destroy(): void {
    this.patrols.destroy()
  }
}
