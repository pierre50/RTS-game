import type { GameContextLike, SchedulerTaskId } from '../../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import {
  getRestReturnTask,
  putRestingUnitToSleep,
  sendUnitToRest,
  settleUnitRestForTimeJump,
  wakeUnit,
} from './UnitRestLifecycle'
import {
  shouldVillagerBeAsleep,
  shouldVillagerReturnHome,
  shouldVillagerWork,
} from '../../lib/units/villagerSchedule'
import { keepSleepingOutsideVisual, playSleepingOutsideVisual, playSleepingWakeVisual } from './UnitSleepVisuals'
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
  evacuateUnitsFromShelter,
  evacuateUnitsIfShelterUnsafe,
  isVillager,
  settleSleepState,
  shouldRouteUnitToInteriorExit,
  updateMovingRestUnit,
  wakeRestingUnitInstant,
} from './UnitRestStateTransitions'
import {
  findHeroRestAlertTarget,
  findPropagatedRestAlertSleepers,
  handleShelterAttack,
  handleUnitDanger,
  reactUnitToDanger,
} from './UnitRestDanger'

type RestUnitBuckets = {
  livingUnits: UnitEntity[]
  restUnits: UnitEntity[]
  villagers: UnitEntity[]
}

export class UnitRestSystem {
  context: GameContextLike
  taskId: SchedulerTaskId | null

  constructor(context: GameContextLike) {
    this.context = context
    this.taskId = null
    this.taskId = context.scheduler.add(() => this.update(), REST_CHECK_INTERVAL_MS, 'unit.rest')
    this.update()
  }

  update(): void {
    const { livingUnits, restUnits } = this.collectUnits()
    if (!livingUnits.length) return

    for (const unit of restUnits) clearExpiredUnitRestAlert(unit)
    if (isSleepTime(this.context)) this.updateRestAlerts(restUnits)
    for (const unit of restUnits) this.updateScheduledRest(unit)
    this.updateSleepingOutsideVisuals(restUnits)
  }

  private shouldReturnHome(unit: UnitEntity): boolean {
    return isVillager(unit) ? shouldVillagerReturnHome(unit) : isSleepTime(this.context)
  }

  private shouldSleep(unit: UnitEntity): boolean {
    return isVillager(unit) ? shouldVillagerBeAsleep(unit) : isSleepTime(this.context)
  }

  private shouldWake(unit: UnitEntity): boolean {
    return isVillager(unit) ? shouldVillagerWork(unit) : !isSleepTime(this.context)
  }

  private restoreInterruptedSleep(unit: UnitEntity): boolean {
    const suspended = unit.suspendedRestState
    if (!suspended || isUnitRestWakeLocked(unit) || unit.lookingAtHero || !this.shouldReturnHome(unit)) return false
    unit.suspendedRestState = null
    unit.shelterState = suspended
    if (this.shouldSleep(unit)) putRestingUnitToSleep(unit)
    return true
  }

  private updateScheduledRest(unit: UnitEntity): void {
    if (this.shouldWake(unit)) {
      unit.suspendedRestState = null
      if (unit.shelterState && unit.shelterState.status !== 'wakingUp') this.wakeRestingUnit(unit)
      else if (unit.shelterState) this.updateRestingUnit(unit)
      return
    }

    if (!unit.shelterState) {
      if (this.restoreInterruptedSleep(unit)) return
      if (this.shouldReturnHome(unit) && shouldRest(unit) && sendUnitToRest(unit, 'sleep')) {
        this.updateRestingUnit(unit)
      }
      return
    }

    this.updateRestingUnit(unit)
    const state = unit.shelterState
    if (
      state?.reason === 'sleep' &&
      (state.status === 'inside' || state.status === 'outside') &&
      this.shouldSleep(unit) &&
      unit.sleepVisualState !== 'sleeping' &&
      !isUnitRestWakeLocked(unit) &&
      !unit.lookingAtHero
    ) {
      putRestingUnitToSleep(unit)
    }
  }

  private collectUnits(): RestUnitBuckets {
    const buckets: RestUnitBuckets = {
      livingUnits: [],
      restUnits: [],
      villagers: [],
    }
    for (const player of this.context.players ?? []) {
      for (const unit of player.units ?? []) {
        if (unit.isDead || unit.isDestroyed) continue
        buckets.livingUnits.push(unit)
        if (isVillager(unit)) buckets.villagers.push(unit)
        if (canUseUnitRest(unit) || unit.shelterState) buckets.restUnits.push(unit)
      }
    }
    return buckets
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

  wakeSleepingUnitForOrder(unit: UnitEntity, onComplete?: () => void): boolean {
    if (unit.shelterState?.reason !== 'sleep' || unit.sleepVisualState !== 'sleeping') return false
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
    if (unit.shelterState?.reason === 'sleep') playSleepingOutsideVisual(unit)
  }

  sendUnitToSleep(unit: UnitEntity): boolean {
    return sendUnitToRest(unit, 'sleep')
  }

  synchronizeAfterTimeJump(): void {
    const { livingUnits, restUnits } = this.collectUnits()
    if (!livingUnits.length) return

    for (const unit of restUnits) {
      if (isVillager(unit)) {
        if (shouldVillagerWork(unit)) wakeRestingUnitInstant(this.context, unit)
        else settleUnitRestForTimeJump(unit, shouldVillagerBeAsleep(unit))
      } else if (isSleepTime(this.context)) {
        settleSleepState(unit)
      } else {
        wakeRestingUnitInstant(this.context, unit)
      }
    }
    this.updateSleepingOutsideVisuals(restUnits)
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
    for (const unit of units) {
      if (unit.shelterState?.status !== 'outside') continue
      if (unit.sleepVisualState !== 'sleeping') continue
      keepSleepingOutsideVisual(unit)
    }
  }

  private wakeRestingUnit(unit: UnitEntity): void {
    const routeToInteriorExit = shouldRouteUnitToInteriorExit(this.context, unit)
    const returnTask = routeToInteriorExit ? getRestReturnTask(unit) : null
    wakeUnit(
      unit,
      routeToInteriorExit
        ? {
            mode: 'order',
            onComplete: () => this.context.routeInteriorUnitToExit?.(unit, returnTask),
          }
        : undefined
    )
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
    if (this.taskId != null) {
      this.context.scheduler.remove(this.taskId)
      this.taskId = null
    }
  }
}
