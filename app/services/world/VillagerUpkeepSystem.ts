import { isRpgVillager } from '../../config/rpgVillages'
import { isStaticSettlement } from '../../config/settlementProfiles'
import { isUnitSuspended } from '../../lib/units/unitSuspension'
import { VillageScheduleGate, villageCalendarMinute } from '../../lib/units/village/villageScheduleGate'
import { notifyVillageWorkChanged } from '../../lib/units/village/villageWorkEvents'
import { flushVillageSimulation } from '../../lib/units/village/villageActivity'
import { consumeVillagerMeals } from '../../lib/economy/villagerMeals'
import type { GameContextLike } from '../../types/context'

export class VillagerUpkeepSystem {
  private schedule = new VillageScheduleGate()
  private taskId: number | null = null
  private previousMinute: number | undefined

  constructor(public context: GameContextLike) {
    this.taskId = context.scheduler?.add(() => this.update(false), 1000, 'villager.meals') ?? null
    this.update()
  }

  update(force = true): void {
    if (!force && !this.schedule.due(this.context)) return
    const clock = this.context.dayNight
    if (!clock) return
    const now = villageCalendarMinute(this.context)
    const from = Math.min(this.previousMinute ?? now, now)
    this.previousMinute = now
    if (this.context.isTutorialActive?.()) return
    let changed = false
    let flushed = false
    for (const player of this.context.players ?? []) {
      for (const unit of player.units ?? []) {
        if (isRpgVillager(unit) || (isStaticSettlement(player) && isUnitSuspended(unit))) {
          unit.lastMealAt = now
          continue
        }
        const meal = consumeVillagerMeals(unit, from, now, unit.lastMealAt == null, () => {
          if (!flushed) {
            flushed = true
            flushVillageSimulation(this.context)
          }
        })
        if (!meal.consumed) continue
        notifyVillageWorkChanged(player)
        changed = true
      }
    }
    this.schedule.settle(this.context)
    if (changed) {
      this.context.menu?.refreshInventory?.()
      this.context.menu?.updateTopbar?.()
    }
  }

  destroy(): void {
    if (this.taskId != null) this.context.scheduler?.remove(this.taskId)
    this.taskId = null
  }
}
