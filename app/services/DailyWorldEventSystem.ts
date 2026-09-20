import { DailyWorldReport } from './DailyWorldReport'
import { invalidateEconomicKnowledge } from './world/EconomicKnowledgeUpdates'
import { NaturalRegrowthSystem } from './NaturalRegrowthSystem'
import { MarketRestockSystem } from './world/MarketRestockSystem'
import { TrapHarvestSystem } from './world/TrapHarvestSystem'
import { VillagerArrivalSystem } from './world/VillagerArrivalSystem'
import { VillagerUpkeepSystem } from './world/VillagerUpkeepSystem'
import { getActiveColonyAlerts } from '../lib/world/regionAlerts'
import type { GameContextLike } from '../types/context'
import type { DailyWorldEvent, DailyWorldEventHandler } from './DailyWorldEventTypes'

export type { DailyWorldEvent, DailyWorldEventHandler } from './DailyWorldEventTypes'

export class DailyWorldEventSystem {
  context: GameContextLike
  handlers: DailyWorldEventHandler[]
  unsubscribeDayChange: (() => void) | null
  // In-memory only (not saved): which colony alerts were already active as of the last day
  // change, so the report only calls out newly-appeared ones instead of repeating every day.
  private seenColonyAlertKeys = new Set<string>()

  constructor(context: GameContextLike) {
    this.context = context
    this.handlers = []
    this.unsubscribeDayChange =
      context.dayNight?.onDayChange?.((day, previousDay) => this.handleDayChange({ day, previousDay })) ?? null
    this.register(new NaturalRegrowthSystem(context))
    this.register(new TrapHarvestSystem(context))
    this.register(new MarketRestockSystem(context))
    this.register(new VillagerUpkeepSystem(context))
    this.register(new VillagerArrivalSystem(context))
  }

  register(handler: DailyWorldEventHandler): () => void {
    this.handlers.push(handler)
    return () => {
      const index = this.handlers.indexOf(handler)
      if (index >= 0) this.handlers.splice(index, 1)
    }
  }

  handleDayChange(event: DailyWorldEvent): void {
    if (this.context.isTutorialActive?.()) {
      // Advance the remote clocks without simulating the skipped tutorial days.
      this.context.updateWorldEconomy?.()
      return
    }
    const report = new DailyWorldReport(this.context, event.day)
    const eventWithReport = { ...event, report }
    for (const handler of this.handlers) handler.handleDailyWorldEvent(eventWithReport)
    invalidateEconomicKnowledge(this.context.map)
    this.context.updateWorldEconomy?.()
    const newColonyAlerts = this.detectNewColonyAlerts()
    if (newColonyAlerts > 0 && this.context.player) {
      report.add({ count: newColonyAlerts, player: this.context.player, type: 'colony-alert' })
    }
    report.flush()
  }

  /** Only counts alerts that just turned true (weren't active on the previous day change). */
  private detectNewColonyAlerts(): number {
    const current = new Set(getActiveColonyAlerts(this.context).map(({ regionId, type }) => `${regionId}:${type}`))
    let newCount = 0
    for (const key of current) if (!this.seenColonyAlertKeys.has(key)) newCount++
    this.seenColonyAlertKeys = current
    return newCount
  }

  destroy(): void {
    this.unsubscribeDayChange?.()
    this.unsubscribeDayChange = null
    for (const handler of this.handlers) handler.destroy?.()
    this.handlers = []
  }
}
