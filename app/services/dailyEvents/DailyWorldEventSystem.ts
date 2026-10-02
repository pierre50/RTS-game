import { RpgVillageSystem } from '../world/RpgVillageSystem'
import { DailyWorldReport } from './DailyWorldReport'
import { flushVillageSimulation, planDistantVillages } from '../../lib/units/villageActivity'
import { NaturalRegrowthSystem } from '../NaturalRegrowthSystem'
import { MarketRestockSystem } from '../world/MarketRestockSystem'
import { TrapHarvestSystem } from '../world/TrapHarvestSystem'
import { VillagerArrivalSystem } from '../world/VillagerArrivalSystem'
import { VillagerUpkeepSystem } from '../world/VillagerUpkeepSystem'
import type { GameContextLike } from '../../types/context'
import type { DailyWorldEvent, DailyWorldEventHandler } from './DailyWorldEventTypes'

export type { DailyWorldEvent, DailyWorldEventHandler } from './DailyWorldEventTypes'

export class DailyWorldEventSystem {
  context: GameContextLike
  handlers: DailyWorldEventHandler[]
  unsubscribeDayChange: (() => void) | null
  private readonly meals: VillagerUpkeepSystem

  constructor(context: GameContextLike) {
    this.context = context
    this.handlers = []
    this.unsubscribeDayChange =
      context.dayNight?.onDayChange?.((day, previousDay) => this.handleDayChange({ day, previousDay })) ?? null
    this.register(new NaturalRegrowthSystem(context))
    this.register(new TrapHarvestSystem(context))
    this.register(new MarketRestockSystem(context))
    this.register(new RpgVillageSystem(context))
    this.meals = new VillagerUpkeepSystem(context)
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
    const report = new DailyWorldReport(this.context)
    const eventWithReport = { ...event, report }
    // Settle yesterday's work before arrivals read stocks. Each event
    // stays owned by this runtime, never replayed by the distant worker engine.
    flushVillageSimulation(this.context)
    for (const handler of this.handlers) handler.handleDailyWorldEvent(eventWithReport)
    planDistantVillages(this.context)
    this.context.updateWorldEconomy?.()
    report.flush()
  }

  destroy(): void {
    this.unsubscribeDayChange?.()
    this.unsubscribeDayChange = null
    this.meals.destroy()
    for (const handler of this.handlers) handler.destroy?.()
    this.handlers = []
  }
}
