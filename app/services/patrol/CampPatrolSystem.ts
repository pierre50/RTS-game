import {
  beginIdlePatrolVisit,
  nextIdlePatrolTime,
  settleIdlePatrolVisit,
  OUTPOST_PATROL_LIMIT,
  type IdlePatrolVisit,
} from './IdlePatrolCycle'
import { getEntitySpaceId } from '../../lib/mapSpaces'
import { isCampPaused } from '../../lib/units/campActivity'
import { setUnitSuspension } from '../../lib/units/unitSuspension'
import { cancelEnergyWait } from '../../lib/units/unitEnergy'
import { CampInterest } from './CampInterest'
import { CampRespawnSystem } from './CampRespawnSystem'
import { ACTION_TYPES, FAMILY_TYPES } from '../../constants'
import { findInstancesInSight, instancesDistance } from '../../lib'
import { showAlertFeedback } from '../../lib/combat/combatFeedback'
import { campAnchor, canCampPursue } from '../../lib/units/campBehavior'
import { canUnitStartAmbientWalk, findUnitWalkAroundDestination } from '../../lib/units/autonomy/walkAround'
import { isUnitRestWakeLocked } from '../rest/UnitRestRules'
import { CampLeashController } from './CampLeashController'
import type { SchedulerTaskId, GameContextLike } from '../../types/context'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

type Timing = { nextCheck: number; nextPatrol: number; awakeUntil: number }
const CHECK_BUDGET = 4
const TICK_MS = 100
const CHECK_INTERVAL_MS = 500

export class CampPatrolSystem {
  private units = new Map<UnitEntity, Timing>()
  private visits = new Map<UnitEntity, IdlePatrolVisit>()
  private nextDeparture = 0
  private task: SchedulerTaskId | null = null
  private refreshAt = 0
  private interestAt = 0
  private reportAt = 0
  private cursor = 0
  private activeUnits: UnitEntity[] = []
  private interest: CampInterest
  private respawns: CampRespawnSystem
  private leash: CampLeashController

  constructor(private context: GameContextLike) {
    this.interest = new CampInterest(context)
    this.respawns = new CampRespawnSystem(context)
    this.leash = new CampLeashController(context)
    if (!context.editor)
      this.task = context.scheduler.add(() => this.updateAggro(), TICK_MS, 'campPatrol.aggro', { maxRunsPerTick: 1 })
  }

  updateAggro(): void {
    if (this.context.editor) return
    const now = this.context.scheduler.elapsedMs
    // Reconcile spawned/converted units infrequently; no per-unit scheduler tasks.
    if (now >= this.refreshAt) {
      this.refreshAt = now + 5000
      this.respawns.update()
      const active = new Set<UnitEntity>()
      for (const player of this.context.players ?? [])
        for (const unit of player.units ?? []) {
          if (
            !unit.isDead &&
            !unit.isDestroyed &&
            (unit.campPatrolAnchor || unit.banditCampAnchor) &&
            !player.isPlayed
          ) {
            active.add(unit)
            if (!this.units.has(unit))
              this.units.set(unit, {
                nextCheck: now + (this.units.size % 5) * TICK_MS,
                nextPatrol: nextIdlePatrolTime(this.context),
                awakeUntil: 0,
              })
          }
        }
      for (const unit of this.units.keys())
        if (!active.has(unit)) {
          this.wake(unit, false)
          this.units.delete(unit)
          this.visits.delete(unit)
        }
    }
    if (now >= this.interestAt) {
      this.interestAt = now + 500
      const relevant = this.interest.collect(this.units.keys())
      for (const [unit, timing] of this.units) {
        if (unit.isDead || unit.isDestroyed || unit.owner?.isPlayed) {
          this.wake(unit, false)
          continue
        }
        const fighting =
          unit.action === ACTION_TYPES.attack || unit.campBehavior?.phase === 'pursue' || unit.spacePortalState
        const settlingRest = unit.shelterState && !['inside', 'outside'].includes(unit.shelterState.status)
        if (fighting || settlingRest || unit.actionLocked || now < timing.awakeUntil || relevant.has(unit))
          this.wake(unit)
        else this.pause(unit)
      }
      this.activeUnits = [...this.units.keys()].filter(
        unit => !isCampPaused(unit) && !unit.isDead && !unit.isDestroyed && !unit.owner?.isPlayed
      )
      if (now >= this.reportAt) {
        this.reportAt = now + 5000
        this.context.performance?.markEvent?.('camp.activity', {
          active: this.activeUnits.length,
          paused: this.units.size - this.activeUnits.length,
        })
      }
    }
    let checked = 0
    const count = this.activeUnits.length
    for (let visited = 0; visited < count && checked < CHECK_BUDGET; visited++) {
      this.cursor %= count
      const unit = this.activeUnits[this.cursor++]
      const timing = this.units.get(unit)
      if (
        !timing ||
        isCampPaused(unit) ||
        unit.isDead ||
        unit.isDestroyed ||
        unit.owner?.isPlayed ||
        now < timing.nextCheck
      )
        continue
      checked++
      timing.nextCheck = now + CHECK_INTERVAL_MS
      if (
        this.leash.update(unit) ||
        isUnitRestWakeLocked(unit) ||
        unit.shelterState?.reason === 'sleep' ||
        (unit.action === ACTION_TYPES.attack && unit.dest)
      ) {
        this.endVisit(unit, timing)
        continue
      }
      const target = this.findAggroTarget(unit)
      if (target) {
        this.endVisit(unit, timing)
        showAlertFeedback(unit)
        unit.sendToAttack?.(target)
      } else this.updatePatrol(unit, timing, now)
    }
  }

  private endVisit(unit: UnitEntity, timing: Timing): void {
    this.visits.delete(unit)
    timing.nextPatrol = nextIdlePatrolTime(this.context)
  }

  private updatePatrol(unit: UnitEntity, timing: Timing, now: number): void {
    if (
      unit.action ||
      unit.actionLocked ||
      unit.shelterState ||
      unit.pendingOrder ||
      unit.spacePortalState ||
      unit.combatMode
    ) {
      this.endVisit(unit, timing)
      return
    }
    const visit = this.visits.get(unit)
    if (visit) {
      const diverted = unit.dest && unit.dest !== visit.destination
      if (diverted || (visit.phase === 'travel' && now > visit.until)) {
        this.endVisit(unit, timing)
        return
      }
      if (!canUnitStartAmbientWalk(unit)) return
      if (visit.phase === 'travel') {
        if (unit.i === visit.destination?.i && unit.j === visit.destination?.j)
          settleIdlePatrolVisit(this.context, visit)
        else this.endVisit(unit, timing)
      } else if (now >= visit.until) this.endVisit(unit, timing)
      return
    }
    if (!canUnitStartAmbientWalk(unit)) {
      timing.nextPatrol = nextIdlePatrolTime(this.context)
      return
    }
    if (now < timing.nextPatrol || now < this.nextDeparture) return
    const anchor = campAnchor(unit)
    const visitors = [...this.visits.keys()].filter(other => {
      const otherAnchor = campAnchor(other)
      return (
        other.owner === unit.owner &&
        getEntitySpaceId(other) === getEntitySpaceId(unit) &&
        otherAnchor?.i === anchor?.i &&
        otherAnchor?.j === anchor?.j
      )
    })
    if (visitors.length >= OUTPOST_PATROL_LIMIT) return
    timing.nextPatrol = nextIdlePatrolTime(this.context)
    const cell = findUnitWalkAroundDestination(unit, anchor, 4)
    if (!cell) return
    unit.sendToEvt?.(cell, null, { preserveAutonomy: true })
    if (!unit.dest) return
    this.visits.set(unit, beginIdlePatrolVisit(this.context, unit))
    // Match the village patrol's staggered departures without slowing enemy detection.
    this.nextDeparture = now + 3000
  }

  private pause(unit: UnitEntity): void {
    if (isCampPaused(unit)) return
    const timing = this.units.get(unit)
    if (timing) this.endVisit(unit, timing)
    setUnitSuspension(unit, {
      reason: 'camp-paused',
      wake: () => {
        const timing = this.units.get(unit)
        if (timing) timing.awakeUntil = this.context.scheduler.elapsedMs + 2000
        this.wake(unit, false)
      },
    })
    unit.stopInterval?.()
    unit.stopTimeout?.()
    cancelEnergyWait(unit)
    unit.path = []
    unit.sprite?.stop?.()
  }

  private wake(unit: UnitEntity, resume = true): void {
    if (!isCampPaused(unit)) return
    setUnitSuspension(unit)
    // Resume routes through the bounded patrol queue, not a burst on zone entry.
    if (resume && unit.dest && !unit.action) unit.dest = null
    if (!unit.isDead && !unit.isDestroyed && !unit.shelterState) unit.sprite?.play?.()
  }

  findAggroTarget(unit: UnitEntity): RuntimeEntity | null {
    const targets = findInstancesInSight<UnitEntity, RuntimeEntity>(
      unit,
      target =>
        Boolean(
          target !== unit &&
            !target.isDead &&
            !target.isDestroyed &&
            (target.family === FAMILY_TYPES.unit || target.family === FAMILY_TYPES.building) &&
            unit.owner?.isEnemy?.(target.owner) &&
            canCampPursue(unit, target) &&
            unit.getActionCondition?.(target, ACTION_TYPES.attack)
        ),
      { useInsightRange: true }
    )
    return targets.reduce<RuntimeEntity | null>(
      (closest, target) =>
        !closest || instancesDistance(unit, target) < instancesDistance(unit, closest) ? target : closest,
      null
    )
  }

  destroy(): void {
    if (this.task != null) this.context.scheduler.remove(this.task)
    this.task = null
    for (const unit of this.units.keys()) this.wake(unit, false)
    this.units.clear()
    this.visits.clear()
    this.activeUnits = []
  }
}
