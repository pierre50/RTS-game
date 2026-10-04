import { isDistantOwner } from '../../lib/units/village/villageActivity'
import { configureVillageNightWatch } from '../../lib/units/village/villageNightWatch'
import { sameMapSpace } from '../../lib/mapSpaces'
import { VillageScheduleGate } from '../../lib/units/village/villageScheduleGate'
import { syncUnitSittingPose } from '../../lib/units/visuals/unitSittingPose'
import { hasDailyRestSchedule } from '../../lib/units/village/villagerSchedule'
import type { GameContextLike, SchedulerTaskId } from '../../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import { assignAvailableBeds } from './UnitRestAvailableBeds'
import {
  findHeroRestAlertTarget,
  findPropagatedRestAlertSleepers,
  handleShelterAttack,
  handleUnitDanger,
  reactUnitToDanger,
} from './UnitRestDanger'
import { putRestingUnitToSleep, sendUnitToRest, wakeUnit } from './UnitRestLifecycle'
import { canClaimPendingBed, needsUnitRestChecks, shouldUnitSleep } from './UnitRestPhase'
import {
  canUseUnitRest,
  clearExpiredUnitRestAlert,
  delayUnitRestAfterActivity,
  isSleepTime,
  isUnitRestWakeLocked,
  markUnitRestAlert,
  REST_CHECK_INTERVAL_MS,
  shouldRest,
} from './UnitRestRules'
import {
  collectRestUnits,
  updateOutsideSleepVisuals,
  wakeRestingUnitAtExit,
  type RestUnitBuckets,
} from './UnitRestRuntimeHelpers'
import { updateScheduledUnitRest } from './UnitRestScheduledUpdate'
import {
  evacuateUnitsFromShelter,
  evacuateUnitsIfShelterUnsafe,
  isVillager,
  settleSleepState,
  updateMovingRestUnit,
  wakeRestingUnitInstant,
} from './UnitRestStateTransitions'
import { synchronizeVillageRestUnits } from './UnitRestVillageSync'
import { playSleepingWakeVisual } from './UnitSleepVisuals'

export class UnitRestSystem {
  context: GameContextLike
  taskId: SchedulerTaskId | null
  private schedule = new VillageScheduleGate()
  private activeRest = false
  private cachedUnits: RestUnitBuckets | null = null
  private pendingBeds = new Set<BuildingEntity>()

  constructor(context: GameContextLike, synchronize = false) {
    this.context = context
    this.taskId = null
    this.taskId = context.scheduler.add(() => this.update(false), REST_CHECK_INTERVAL_MS, 'unit.rest')
    // Reconcile restored evening rest states once; pending notifications are not saved.
    for (const player of context.players ?? []) {
      for (const building of player.buildings ?? []) this.notifyBedAvailable(building)
    }
    if (synchronize) this.synchronizeAfterTimeJump()
    else this.update()
  }

  update(force = true): void {
    const reschedule = force || this.schedule.due(this.context)
    if (!reschedule && !this.activeRest && !this.pendingBeds.size) return
    const { livingUnits, restUnits } = this.refreshRoster(reschedule)
    if (!livingUnits.length) {
      this.pendingBeds.clear()
      this.activeRest = false
      this.schedule.settle(this.context)
      return
    }
    this.updateRestUnits(restUnits)
    if (reschedule) this.schedule.settle(this.context)
  }

  private refreshRoster(reschedule: boolean): RestUnitBuckets {
    if (reschedule)
      for (const owner of this.context.players ?? []) if (!isDistantOwner(owner)) configureVillageNightWatch(owner)
    if (reschedule || !this.cachedUnits) this.cachedUnits = this.collectUnits()
    return this.cachedUnits
  }

  private updateRestUnits(restUnits: UnitEntity[]): void {
    for (const unit of restUnits) clearExpiredUnitRestAlert(unit)
    if (isSleepTime(this.context) || restUnits.some(unit => unit.shelterState)) this.updateRestAlerts(restUnits)
    this.updateAvailableBeds()
    for (const unit of restUnits) updateScheduledUnitRest(this.context, unit)
    this.updateSleepingOutsideVisuals(restUnits)
    this.activeRest = restUnits.some(unit => needsUnitRestChecks(this.context, unit))
  }

  notifyBedAvailable(building: BuildingEntity): void {
    if (building.type === 'CampBedroll' && building.isBuilt && !building.isDead && !building.isDestroyed)
      this.pendingBeds.add(building)
  }

  private updateAvailableBeds(): void {
    assignAvailableBeds(this.pendingBeds, unit => canClaimPendingBed(this.context, unit))
  }

  /** Reconcile only the returning base, before any suspended walking order resumes. */
  synchronizeVillageRest(units: UnitEntity[]): void {
    synchronizeVillageRestUnits(this.context, units)
    this.cachedUnits = null
  }

  private collectUnits(): RestUnitBuckets {
    return collectRestUnits(this.context)
  }

  private findHeroRestAlertTarget(unit: UnitEntity): RuntimeEntity | null {
    return findHeroRestAlertTarget(this.context, unit)
  }

  private reactToRestAlert(unit: UnitEntity, target: RuntimeEntity): void {
    if (isVillager(unit) && canUseUnitRest(unit)) {
      reactUnitToDanger(unit, target)
      return
    }
    unit.detect?.(target)
  }

  private wakeRestUnitForAlert(unit: UnitEntity, target: RuntimeEntity, options: { propagate?: boolean } = {}): void {
    markUnitRestAlert(unit, target)
    const react = () => this.reactToRestAlert(unit, target)
    if (unit.shelterState?.reason === 'sleep') {
      wakeUnit(unit, { force: true, mode: 'order', onComplete: react })
    } else {
      react()
    }
    if (options.propagate !== false) this.propagateRestAlert(unit, target)
  }

  private propagateRestAlert(source: UnitEntity, target: RuntimeEntity): void {
    const sleepers = findPropagatedRestAlertSleepers(source)
    for (const sleeper of sleepers) this.wakeRestUnitForAlert(sleeper, target, { propagate: false })
  }

  // No ownership/villager exclusion here: findHeroRestAlertTarget only ever returns a target for
  // units hostile to the hero, so this only ever wakes enemy sleepers (bandit, soldier, or
  // villager alike) — never the player's own or an allied faction's.
  updateRestAlerts(units = this.collectUnits().restUnits): void {
    for (const unit of units) {
      const target = this.findHeroRestAlertTarget(unit)
      if (!target) continue
      if (unit.shelterState?.reason === 'sleep' && unit.shelterState.status === 'outside') {
        this.wakeRestUnitForAlert(unit, target)
      } else if (!unit.shelterState) {
        markUnitRestAlert(unit, target)
        this.reactToRestAlert(unit, target)
      }
    }
  }

  interruptRestForCombat(unit: UnitEntity, target: RuntimeEntity): boolean {
    if (!unit.shelterState || unit.isDead || unit.isDestroyed) return false
    markUnitRestAlert(unit, target)
    wakeUnit(unit, {
      force: true,
      mode: 'order',
      onComplete: () => {
        if (unit.isDead || unit.isDestroyed || target.isDead || target.isDestroyed) return
        if (!sameMapSpace(unit, target) && this.context.routeInteriorUnitToExit) {
          this.context.routeInteriorUnitToExit(unit, {
            dest: target,
            action: 'attack',
            work: 'attacker',
            autonomousJob: null,
          })
        } else unit.sendToEvt?.(target, 'attack')
      },
    })
    return true
  }

  handleUnitDanger(unit: UnitEntity, attacker: RuntimeEntity | null | undefined): boolean {
    return handleUnitDanger(unit, attacker)
  }

  handleShelterAttack(building: BuildingEntity, attacker: RuntimeEntity | null | undefined): boolean {
    return handleShelterAttack(building, attacker)
  }

  // True while a unit is up on "borrowed time" after a talk/danger-triggered wake — it'll settle
  // back into rest on its own once this expires, so callers shouldn't resume old activity for it.
  isRestWakeLockActive(unit: UnitEntity): boolean {
    return isUnitRestWakeLocked(unit)
  }

  wakeRestingUnitForOrder(unit: UnitEntity, onComplete?: () => void): boolean {
    if (unit.shelterState?.reason !== 'sleep') return false
    // Keeps the unit up for a while after a talk-triggered wake with no follow-up order, instead
    // of it dozing back off mid-conversation on the next sleep tick.
    delayUnitRestAfterActivity(unit)
    wakeUnit(unit, { force: true, mode: 'order', onComplete })
    return true
  }

  previewSleepingUnitWake(unit: UnitEntity): void {
    if (unit.shelterState?.reason === 'sleep' && unit.sleepVisualState === 'sleeping') playSleepingWakeVisual(unit)
  }

  restoreSleepingUnitVisual(unit: UnitEntity): void {
    if (unit.shelterState?.reason !== 'sleep') return
    // Evening waiting uses the same rest reason as sleep: resume the phase due now.
    if (shouldUnitSleep(this.context, unit)) putRestingUnitToSleep(unit)
    else {
      updateScheduledUnitRest(this.context, unit)
      syncUnitSittingPose(unit)
    }
  }

  sendUnitToSleep(unit: UnitEntity): boolean {
    return sendUnitToRest(unit, 'sleep')
  }

  synchronizeAfterTimeJump(): void {
    const { livingUnits, restUnits } = this.collectUnits()
    if (!livingUnits.length) return
    this.synchronizeVillageRest(restUnits)

    for (const unit of restUnits) {
      if (hasDailyRestSchedule(unit)) continue
      if (isSleepTime(this.context)) {
        settleSleepState(unit)
      } else {
        wakeRestingUnitInstant(this.context, unit)
      }
    }
    this.updateSleepingOutsideVisuals(restUnits)
    this.activeRest = restUnits.some(unit => needsUnitRestChecks(this.context, unit))
    this.cachedUnits = { livingUnits, restUnits, villagers: restUnits.filter(isVillager) }
    this.schedule.settle(this.context)
  }

  evacuateUnitsFromShelter(building: BuildingEntity, options: { force?: boolean } = {}): void {
    evacuateUnitsFromShelter(building, options)
  }

  evacuateUnitsIfShelterUnsafe(building: BuildingEntity): void {
    evacuateUnitsIfShelterUnsafe(building)
  }

  sendUnitsToSleep(units = this.collectUnits().restUnits): void {
    for (const unit of units) {
      if (!shouldRest(unit) || unit.shelterState) continue
      sendUnitToRest(unit, 'sleep')
    }
    for (const unit of units) this.updateRestingUnit(unit)
  }

  updateRestingUnit(unit: UnitEntity): void {
    updateMovingRestUnit(unit)
  }

  updateSleepingOutsideVisuals(units = this.collectUnits().restUnits): void {
    return updateOutsideSleepVisuals(this.context, units)
  }

  private wakeRestingUnit(unit: UnitEntity): void {
    return wakeRestingUnitAtExit(this.context, unit)
  }

  wakeRestingUnits(units = this.collectUnits().restUnits): void {
    for (const unit of units) {
      if (!unit.shelterState) continue
      if (unit.shelterState.status === 'wakingUp') continue
      this.wakeRestingUnit(unit)
    }
  }

  wakeRestingUnitsInstant(units = this.collectUnits().restUnits): void {
    for (const unit of units) {
      if (!unit.shelterState) continue
      wakeRestingUnitInstant(this.context, unit)
    }
  }

  destroy(): void {
    this.cachedUnits = null
    this.pendingBeds.clear()
    if (this.taskId != null) {
      this.context.scheduler.remove(this.taskId)
      this.taskId = null
    }
  }
}
