import type { GameContextLike, SchedulerTaskId } from '../../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import { isVillagerTiredTime } from '../../lib/units/villagerSchedule'
import {
  sendUnitToRest,
  wakeUnit,
} from './UnitRestLifecycle'
import { keepSleepingOutsideVisual, playSleepingOutsideVisual, playSleepingWakeVisual } from './UnitSleepVisuals'
import { updateVillagerTired } from './VillagerTiredIndicator'
import {
  canUseUnitRest,
  clearExpiredUnitRestAlert,
  isSleepTime,
  markUnitRestAlert,
  REST_CHECK_INTERVAL_MS,
  shouldRest,
} from './UnitRestRules'
import {
  evacuateUnitsFromShelter,
  evacuateUnitsIfShelterUnsafe,
  findHeroRestAlertTarget,
  findPropagatedRestAlertSleepers,
  handleUnitDanger,
  isVillager,
  settleSleepState,
  shouldRouteUnitToInteriorExit,
  updateMovingRestUnit,
  wakeRestingUnitInstant,
} from './UnitRestStateTransitions'

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
    const { livingUnits, restUnits, villagers } = this.collectUnits()
    if (!livingUnits.length) return

    const sleepTime = isSleepTime(this.context)
    const wakeTime = !sleepTime
    const hasShelterState = restUnits.some(unit => Boolean(unit.shelterState))
    const hasTiredState = villagers.some(unit => Boolean(unit.tired))

    if (!sleepTime && !isVillagerTiredTime(this.context) && !hasTiredState && !hasShelterState) return

    this.updateVillagerTiredStates(villagers)
    for (const unit of restUnits) clearExpiredUnitRestAlert(unit)
    if (sleepTime) this.updateRestAlerts(restUnits)
    if (sleepTime) this.sendUnitsToSleep(restUnits)
    if (wakeTime && hasShelterState) this.wakeRestingUnits(restUnits)
    this.updateSleepingOutsideVisuals(restUnits)
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

  private wakeRestUnitForAlert(unit: UnitEntity, target: RuntimeEntity, options: { propagate?: boolean } = {}): void {
    markUnitRestAlert(unit, target)
    const attackIfNeeded = () => unit.detect?.(target)
    if (unit.shelterState?.reason === 'sleep') {
      wakeUnit(unit, { force: true, mode: 'order', onComplete: attackIfNeeded })
    } else {
      attackIfNeeded()
    }
    if (options.propagate !== false) this.propagateRestAlert(unit, target)
  }

  private propagateRestAlert(source: UnitEntity, target: RuntimeEntity): void {
    const sleepers = findPropagatedRestAlertSleepers(source)
    for (const sleeper of sleepers) this.wakeRestUnitForAlert(sleeper, target, { propagate: false })
  }

  updateRestAlerts(units = this.collectUnits().restUnits): void {
    for (const unit of units) {
      if (isVillager(unit)) continue
      const target = this.findHeroRestAlertTarget(unit)
      if (!target) continue
      if (unit.shelterState?.reason === 'sleep' && unit.shelterState.status === 'outside') {
        this.wakeRestUnitForAlert(unit, target)
      } else if (!unit.shelterState) {
        markUnitRestAlert(unit, target)
        unit.detect?.(target)
      }
    }
  }

  handleUnitDanger(unit: UnitEntity, attacker: RuntimeEntity | null | undefined): boolean {
    return handleUnitDanger(unit, attacker)
  }

  wakeSleepingUnitForOrder(unit: UnitEntity, onComplete?: () => void): boolean {
    if (unit.shelterState?.reason !== 'sleep') return false
    wakeUnit(unit, { force: true, mode: 'order', onComplete })
    return true
  }

  previewSleepingUnitWake(unit: UnitEntity): void {
    if (unit.shelterState?.reason === 'sleep') playSleepingWakeVisual(unit)
  }

  restoreSleepingUnitVisual(unit: UnitEntity): void {
    if (unit.shelterState?.reason === 'sleep') playSleepingOutsideVisual(unit)
  }

  sendUnitToSleep(unit: UnitEntity): boolean {
    return sendUnitToRest(unit, 'sleep')
  }

  synchronizeAfterTimeJump(): void {
    const { livingUnits, restUnits, villagers } = this.collectUnits()
    if (!livingUnits.length) return

    if (isSleepTime(this.context)) {
      for (const unit of restUnits) settleSleepState(unit)
    } else {
      this.wakeRestingUnitsInstant(restUnits)
    }
    this.updateVillagerTiredStates(villagers)
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

  updateVillagerTiredStates(villagers = this.collectUnits().villagers): void {
    for (const unit of villagers) updateVillagerTired(unit)
  }

  updateRestingUnit(unit: UnitEntity): void {
    updateMovingRestUnit(unit)
  }

  updateSleepingOutsideVisuals(units = this.collectUnits().restUnits): void {
    for (const unit of units) {
      if (unit.shelterState?.status !== 'outside') continue
      if (unit.lookingAtHero && unit.shelterState.reason === 'sleep') continue
      keepSleepingOutsideVisual(unit)
    }
  }

  wakeRestingUnits(units = this.collectUnits().restUnits): void {
    for (const unit of units) {
      if (!unit.shelterState) continue
      const routeToInteriorExit = shouldRouteUnitToInteriorExit(this.context, unit)
      wakeUnit(
        unit,
        routeToInteriorExit
          ? {
              mode: 'order',
              onComplete: () => this.context.routeInteriorUnitToExit?.(unit),
            }
          : undefined
      )
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
