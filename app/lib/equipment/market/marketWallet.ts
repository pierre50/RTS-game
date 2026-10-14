import { MARKET_GOLD_TARGETS, MARKET_DAILY_GOLD_FRACTION } from '../../../config/market'
import { getBuildingLevel } from '../../buildings/buildingLevel'
import type { BuildingEntity } from '../../../types/entities'

export type MarketWallet = Pick<BuildingEntity, 'marketGold'> &
  Partial<Pick<BuildingEntity, 'owner' | 'marketStock' | 'marketResourceStock' | 'buildingLevel' | 'assetLevel'>>

export function getMarketLevel(market: { buildingLevel?: number; assetLevel?: unknown }): number {
  return Math.min(MARKET_GOLD_TARGETS.length - 1, getBuildingLevel(market))
}

export function getMarketGoldTarget(market: MarketWallet): number {
  return MARKET_GOLD_TARGETS[getMarketLevel(market)]!
}

export function getMarketDailyGold(market: MarketWallet): number {
  return Math.floor(getMarketGoldTarget(market) * MARKET_DAILY_GOLD_FRACTION)
}

export function getMarketGold(market: MarketWallet): number {
  const gold = market.marketGold
  market.marketGold =
    gold == null || !Number.isFinite(gold) ? getMarketGoldTarget(market) : Math.max(0, Math.floor(gold))
  return market.marketGold
}

export function replenishMarketGold(market: MarketWallet): void {
  const gold = getMarketGold(market)
  const target = getMarketGoldTarget(market)
  if (gold < target) market.marketGold = Math.min(target, gold + getMarketDailyGold(market))
}
