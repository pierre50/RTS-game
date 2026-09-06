import { DailyWorldReport } from './DailyWorldReport'
import { NaturalRegrowthSystem } from './NaturalRegrowthSystem'
import { MarketRestockSystem } from './world/MarketRestockSystem'
import { TrapHarvestSystem } from './world/TrapHarvestSystem'
import { VillagerArrivalSystem } from './world/VillagerArrivalSystem'
import { VillagerUpkeepSystem } from './world/VillagerUpkeepSystem'
import type { GameContextLike } from '../types/context'
import type { DailyWorldEvent, DailyWorldEventHandler } from './DailyWorldEventTypes'

export type { DailyWorldEvent, DailyWorldEventHandler } from './DailyWorldEventTypes'

export class DailyWorldEventSystem {
  context: GameContextLike
  handlers: DailyWorldEventHandler[]
  unsubscribeDayChange: (() => void) | null

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
    const report = new DailyWorldReport(this.context, event.day)
    const eventWithReport = { ...event, report }
    for (const handler of this.handlers) handler.handleDailyWorldEvent(eventWithReport)
    report.flush()
  }

  destroy(): void {
    this.unsubscribeDayChange?.()
    this.unsubscribeDayChange = null
    for (const handler of this.handlers) handler.destroy?.()
    this.handlers = []
  }
}
