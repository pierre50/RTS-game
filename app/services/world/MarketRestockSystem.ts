import { BUILDING_TYPES } from '../../constants'
import {
  MARKET_RESTOCK_INTERVAL_DAYS,
  resetMarketEquipmentStock,
  type MarketEquipmentOfferOptions,
} from '../../lib/equipment/equipmentMarket'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { DailyWorldEvent, DailyWorldEventHandler } from '../DailyWorldEventTypes'

function shouldRestockMarket(day: number): boolean {
  return MARKET_RESTOCK_INTERVAL_DAYS > 0 && day > 0 && day % MARKET_RESTOCK_INTERVAL_DAYS === 0
}

function marketOfferOptions(market: BuildingEntity, player: PlayerLike): MarketEquipmentOfferOptions {
  const owner = market.owner ?? player
  return {
    age: owner.age,
    civilization: owner.civ,
  }
}

export class MarketRestockSystem implements DailyWorldEventHandler {
  context: GameContextLike

  constructor(context: GameContextLike) {
    this.context = context
  }

  handleDailyWorldEvent(event: DailyWorldEvent): void {
    if (!shouldRestockMarket(event.day)) return

    let restockedPlayedMarket = false
    for (const player of this.context.players ?? []) {
      let restocked = 0
      for (const market of this.getRestockableMarkets(player)) {
        resetMarketEquipmentStock(market, marketOfferOptions(market, player))
        restocked++
        restockedPlayedMarket ||= Boolean(player.isPlayed)
      }
      if (restocked > 0) event.report?.add({ count: restocked, player, type: 'market-restocked' })
    }

    if (restockedPlayedMarket) {
      this.context.menu?.refreshHeroBuildingMenu?.()
    }
  }

  private getRestockableMarkets(player: PlayerLike): BuildingEntity[] {
    return (player.buildings ?? []).filter(
      building =>
        building.type === BUILDING_TYPES.market &&
        building.isBuilt &&
        !building.isDead &&
        !building.isDestroyed
    )
  }

  destroy(): void {}
}
