import { NaturalRegrowthSystem } from './NaturalRegrowthSystem'
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
    this.unsubscribeDayChange = context.dayNight?.onDayChange?.((day, previousDay) =>
      this.handleDayChange({ day, previousDay })
    ) ?? null
    this.register(new NaturalRegrowthSystem(context))
  }

  register(handler: DailyWorldEventHandler): () => void {
    this.handlers.push(handler)
    return () => {
      const index = this.handlers.indexOf(handler)
      if (index >= 0) this.handlers.splice(index, 1)
    }
  }

  handleDayChange(event: DailyWorldEvent): void {
    for (const handler of this.handlers) handler.handleDailyWorldEvent(event)
  }

  destroy(): void {
    this.unsubscribeDayChange?.()
    this.unsubscribeDayChange = null
    for (const handler of this.handlers) handler.destroy?.()
    this.handlers = []
  }
}
