import { DAILY_CONSUMPTION_PER_VILLAGER } from '../../constants'
import { getPlayerResourceTotals, withdrawChestResources } from '../../lib/resources/playerResourceTotals'
import { summarizeVillagerAssignments } from '../../lib/units/villagerAssignments'
import type { ResourceAmount } from '../../types/common'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { DailyWorldEvent, DailyWorldEventHandler } from '../DailyWorldEventTypes'

export class VillagerUpkeepSystem implements DailyWorldEventHandler {
  context: GameContextLike

  constructor(context: GameContextLike) {
    this.context = context
  }

  handleDailyWorldEvent(_event: DailyWorldEvent): void {
    for (const player of this.context.players ?? []) {
      const villagerCount = summarizeVillagerAssignments(player.units ?? []).total
      if (villagerCount > 0) this.consumeDailyUpkeep(player, villagerCount)
    }
  }

  private consumeDailyUpkeep(player: PlayerLike, villagerCount: number): void {
    const totals = getPlayerResourceTotals(player)
    for (const [resource, rate] of Object.entries(DAILY_CONSUMPTION_PER_VILLAGER) as [keyof ResourceAmount, number][]) {
      const needed = rate * villagerCount
      const available = totals[resource] ?? 0
      const toConsume = Math.min(needed, available)
      if (toConsume > 0) withdrawChestResources(player, { [resource]: toConsume })
    }
    if (player.isPlayed) this.context.menu?.updateTopbar?.()
  }

  destroy(): void {}
}
