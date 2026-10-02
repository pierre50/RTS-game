import { isWheatMature } from '../../lib/combat/resourceActionConditions'
import {
  isRpgVillage,
  isRpgVillager,
  RPG_VILLAGE_TICK_MS,
  RPG_VILLAGE_DECISION_MS,
  RPG_VILLAGE_WORKERS,
} from '../../config/rpgVillages'
import { isDistantOwner } from '../../lib/units/villageActivity'
import { isUnitSuspended } from '../../lib/units/unitSuspension'
import { canUnitStartAmbientWalk } from '../../lib/units/walkAround'
import { shouldVillagerWork } from '../../lib/units/villagerSchedule'
import { cancelVillagerExplorationResume } from '../../lib/units/autonomy/villagerExploration'
import { canUnitUseCellAsIdleDestination } from '../../lib/buildings/passageCells'
import { replenishRpgVillage } from './RpgVillageSupplies'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity, RuntimeEntity } from '../../types/entities'
import type { DailyWorldEvent } from '../dailyEvents/DailyWorldEventTypes'

/** Small local activity budget; stock availability does not drive individual worker searches. */
export class RpgVillageSystem {
  private task: number | null = null
  private readyAt = new WeakMap<UnitEntity, number>()
  private initialized = new WeakSet<UnitEntity>()
  private cursor = 0
  constructor(private context: GameContextLike) {
    if (!context.editor) this.task = context.scheduler.add(() => this.update(), RPG_VILLAGE_TICK_MS, 'village.rpg')
  }

  handleDailyWorldEvent(event: DailyWorldEvent): void {
    for (const owner of this.context.players ?? []) replenishRpgVillage(owner, event.day)
  }

  update(): void {
    const owners = (this.context.players ?? []).filter(owner => isRpgVillage(owner) && !isDistantOwner(owner))
    const now = this.context.scheduler.elapsedMs
    for (let count = 0; count < owners.length; count++) {
      const owner = owners[this.cursor++ % owners.length]
      const residents = owner.units.filter(unit => isRpgVillager(unit) && !unit.isDead && !unit.isDestroyed)
      const type = owner.settlementType ?? 'village'
      for (const unit of residents) {
        if (
          this.initialized.has(unit) ||
          isUnitSuspended(unit) ||
          unit.lookingAtHero ||
          unit.pendingOrder ||
          unit.actionLocked ||
          unit.waitingForEnergyAction ||
          unit.combatMode ||
          unit.action === 'attack' ||
          unit.action === 'flee' ||
          unit.shelterState ||
          unit.trainingTargetType ||
          unit.resourceDeliveryState ||
          unit.spacePortalState
        )
          continue
        this.initialized.add(unit)
        cancelVillagerExplorationResume(unit)
        unit.autonomousJob = null
        unit.collectiveTask = null
        unit.autonomyBlockedJob = null
        unit.previousDest = null
        unit.previousWork = null
        unit.stop?.()
        unit.work = null
      }
      const workers = RPG_VILLAGE_WORKERS[type]
      const active = residents.slice(0, workers)
      for (const [index, unit] of active.entries()) {
        if (
          !this.initialized.has(unit) ||
          isUnitSuspended(unit) ||
          !shouldVillagerWork(unit) ||
          !canUnitStartAmbientWalk(unit) ||
          unit.lookingAtHero ||
          unit.actionLocked ||
          unit.trainingTargetType ||
          (unit.spaceId && unit.spaceId !== 'outside') ||
          now < (this.readyAt.get(unit) ?? 0)
        )
          continue
        this.readyAt.set(unit, now + RPG_VILLAGE_DECISION_MS + index * 3000)
        if (this.act(unit)) return // At most one new order across all villages per tick.
      }
    }
    this.cursor %= Math.max(1, owners.length)
  }

  private act(unit: UnitEntity): boolean {
    const grid = this.context.map.grid
    const home = unit.villageHome ?? unit
    let wheat: RuntimeEntity | undefined
    for (let di = -10; di <= 10; di++)
      for (let dj = -10; dj <= 10; dj++) {
        const target = grid[unit.i + di]?.[unit.j + dj]?.has
        if (
          target?.type !== 'Wheat' ||
          !isWheatMature(target) ||
          target.isDead ||
          ('isUsedBy' in target && target.isUsedBy && target.isUsedBy !== unit) ||
          target.isDestroyed ||
          (target.quantity ?? 0) <= 0 ||
          Math.hypot(target.i - home.i, target.j - home.j) > 24
        )
          continue
        if (!wheat || Math.hypot(di, dj) < Math.hypot(wheat.i - unit.i, wheat.j - unit.j)) wheat = target
      }
    if (wheat && Math.max(Math.abs(wheat.i - unit.i), Math.abs(wheat.j - unit.j)) <= 1 && unit.sendToFarm) {
      unit.sendToFarm(wheat)
      return true
    }
    // Only adjacent, level destinations: no far-away target or continent-wide resource search.
    const cells = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].flatMap(([di, dj]) => {
      const cell = grid[unit.i + di]?.[unit.j + dj]
      const origin = grid[unit.i]?.[unit.j]
      return cell &&
        origin &&
        Math.abs((cell.z ?? 0) - (origin.z ?? 0)) <= 1 &&
        Math.hypot(cell.i - home.i, cell.j - home.j) <= 24 &&
        canUnitUseCellAsIdleDestination(unit, cell)
        ? [cell]
        : []
    })
    const target = wheat
      ? cells.sort((a, b) => Math.hypot(a.i - wheat!.i, a.j - wheat!.j) - Math.hypot(b.i - wheat!.i, b.j - wheat!.j))[0]
      : cells[Math.floor(this.context.map.randomRange(0, Math.max(0, cells.length - 1)))]
    if (!target || !unit.sendTo) return false
    unit.sendTo(target)
    return true
  }

  destroy(): void {
    if (this.task != null) this.context.scheduler.remove(this.task)
    this.task = null
  }
}
