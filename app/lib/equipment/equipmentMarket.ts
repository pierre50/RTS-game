import { MARKET_RESOURCE_COUNTS } from '../../config/market'
import { getUnitResourceCarryRemaining } from '../resources/resourceDelivery'
import type { ResourceAmount } from '../../types/common'
import { addHeroInventoryItem, getHeroInventory, removeHeroInventoryItem } from './equipmentLoot'
import type { UnitEntity } from '../../types/entities'
import { getMarketGold, getMarketLevel, type MarketWallet } from './market/marketWallet'
import {
  getEquipmentGoldValue,
  getEquipmentResaleGoldValue,
  getMarketResourceBuyPrice,
  getResourceGoldValue,
} from './market/marketPricing'
import {
  getMarketEquipmentOffers,
  getStockCount,
  isMarketPurchasableEquipment,
  marketEquipmentUnlocked,
  type MarketEquipmentOfferOptions,
} from './market/marketCatalog'

// Public market API: wallet, pricing and catalogue live in ./market/, trading and stock live here.
export { MARKET_RESTOCK_INTERVAL_DAYS } from '../../config/market'
export {
  getMarketLevel,
  getMarketGoldTarget,
  getMarketDailyGold,
  getMarketGold,
  replenishMarketGold,
  type MarketWallet,
} from './market/marketWallet'
export {
  getEquipmentGoldValue,
  getEquipmentResaleGoldValue,
  getResourceGoldValue,
  getMarketResourceBuyPrice,
} from './market/marketPricing'
export { getMarketEquipmentOffers, type MarketEquipmentOfferOptions } from './market/marketCatalog'

function removeFromMarketStock(stock: string[], equipment: string, count: number): number {
  let removed = 0
  for (let index = stock.length - 1; index >= 0 && removed < count; index--) {
    if (stock[index] !== equipment) continue
    stock.splice(index, 1)
    removed++
  }
  return removed
}

function createMarketEquipmentStock(options: MarketEquipmentOfferOptions = {}): string[] {
  return getMarketEquipmentOffers(options).flatMap(offer => Array.from({ length: offer.count }, () => offer.equipment))
}

export function resetMarketEquipmentStock(
  market: MarketWallet | null | undefined,
  options: MarketEquipmentOfferOptions = {}
): string[] {
  if (!market) return []
  market.marketStock = createMarketEquipmentStock({
    ...options,
    civilization: market.owner?.civ ?? options.civilization,
    buildingLevel: getMarketLevel(market),
  })
  market.marketResourceStock = createMarketResourceStock(market)
  return market.marketStock
}

export function ensureMarketEquipmentStock(
  market: MarketWallet | null | undefined,
  options: MarketEquipmentOfferOptions = {}
): string[] {
  if (!market) return []
  if (!Array.isArray(market.marketStock)) return resetMarketEquipmentStock(market, options)
  return market.marketStock
}

export function getHeroGold(hero: UnitEntity | null | undefined): number {
  return Math.max(0, Math.floor(hero?.inventory?.resources?.gold ?? 0))
}

export function buyMarketEquipment(
  hero: UnitEntity | null | undefined,
  market: MarketWallet,
  equipment: string,
  requestedCount = 1,
  stock?: string[]
): number {
  if (!Number.isFinite(requestedCount)) return 0
  if (!hero || !marketEquipmentUnlocked(equipment, getMarketLevel(market)) || !isMarketPurchasableEquipment(equipment))
    return 0
  stock ??= ensureMarketEquipmentStock(market)
  const goldValue = getEquipmentGoldValue(equipment)
  if (goldValue <= 0) return 0
  const inventory = getHeroInventory(hero)
  const gold = Math.max(0, Math.floor(inventory.resources?.gold ?? 0))
  const availableStock = stock ? getStockCount(stock, equipment) : Number.POSITIVE_INFINITY
  const count = Math.min(Math.max(1, Math.floor(requestedCount)), Math.floor(gold / goldValue), availableStock)
  if (count <= 0) return 0
  if (!addHeroInventoryItem(hero, equipment, count)) return 0
  if (stock && removeFromMarketStock(stock, equipment, count) !== count) return 0
  market.marketGold = getMarketGold(market) + goldValue * count
  inventory.resources!.gold = gold - goldValue * count
  if (inventory.resources!.gold <= 0) delete inventory.resources!.gold
  return count
}

export function sellHeroEquipment(
  hero: UnitEntity | null | undefined,
  market: MarketWallet,
  equipment: string,
  count = 1
): number {
  if (!hero) return 0
  const goldValue = getEquipmentResaleGoldValue(equipment)
  if (goldValue <= 0) return 0
  const amount = Math.min(Math.max(1, Math.floor(count)), Math.floor(getMarketGold(market) / goldValue))
  let sold = 0
  for (let index = 0; index < amount; index++) {
    if (!removeHeroInventoryItem(hero, equipment)) break
    sold++
  }
  if (sold <= 0) return 0
  const stock = ensureMarketEquipmentStock(market)
  for (let index = 0; index < sold; index++) stock.push(equipment)
  const inventory = getHeroInventory(hero)
  market.marketGold = getMarketGold(market) - sold * goldValue
  inventory.resources!.gold = (inventory.resources!.gold ?? 0) + sold * goldValue
  return sold
}

export function sellHeroResource(
  hero: UnitEntity | null | undefined,
  market: MarketWallet,
  resource: keyof ResourceAmount,
  requestedAmount?: number
): number {
  if (!hero || resource === 'gold') return 0
  const goldValue = getResourceGoldValue(resource)
  if (goldValue <= 0) return 0
  const inventory = getHeroInventory(hero)
  const resources = inventory.resources!
  const available = Math.max(0, Math.floor(resources[resource] ?? 0))
  const amount = Math.min(
    requestedAmount == null ? available : Math.min(available, Math.max(0, Math.floor(requestedAmount))),
    Math.floor(getMarketGold(market) / goldValue)
  )
  if (amount <= 0) return 0
  resources[resource] = available - amount
  if ((resources[resource] ?? 0) <= 0) delete resources[resource]
  market.marketGold = getMarketGold(market) - amount * goldValue
  resources.gold = (resources.gold ?? 0) + amount * goldValue
  return amount
}

function createMarketResourceStock(market: MarketWallet): ResourceAmount {
  const level = getMarketLevel(market)
  const stock: ResourceAmount = {}
  for (const [key, counts] of Object.entries(MARKET_RESOURCE_COUNTS)) {
    const count = counts[level]!
    if (count > 0) stock[key as keyof ResourceAmount] = count
  }
  return stock
}

export function getMarketResourceOffers(
  market: MarketWallet
): { resource: keyof ResourceAmount; count: number; goldValue: number }[] {
  market.marketResourceStock ??= createMarketResourceStock(market)
  return Object.keys(createMarketResourceStock(market)).flatMap(key => {
    const resource = key as keyof ResourceAmount
    const savedCount = market.marketResourceStock?.[resource] ?? 0
    const count = Number.isFinite(savedCount) ? Math.max(0, Math.floor(savedCount)) : 0
    return count > 0 ? [{ resource, count, goldValue: getMarketResourceBuyPrice(resource) }] : []
  })
}

export function buyMarketResource(
  hero: UnitEntity | null | undefined,
  market: MarketWallet,
  resource: keyof ResourceAmount,
  requestedCount = 1
): number {
  if (!hero || !Number.isFinite(requestedCount)) return 0
  const offer = getMarketResourceOffers(market).find(entry => entry.resource === resource)
  if (!offer) return 0
  const inventory = getHeroInventory(hero)
  const count = Math.min(
    Math.max(0, Math.floor(requestedCount)),
    offer.count,
    Math.floor(getHeroGold(hero) / offer.goldValue)
  )
  if (count <= 0) return 0
  // Paying releases the bag slots occupied by gold before the purchased resources enter it.
  const afterPayment = {
    ...hero,
    inventory: {
      ...inventory,
      resources: { ...inventory.resources, gold: getHeroGold(hero) - count * offer.goldValue },
    },
  }
  if (getUnitResourceCarryRemaining(afterPayment) < count) return 0
  inventory.resources![resource] = (inventory.resources![resource] ?? 0) + count
  inventory.resources!.gold = getHeroGold(hero) - count * offer.goldValue
  market.marketGold = getMarketGold(market) + count * offer.goldValue
  market.marketResourceStock![resource] = offer.count - count
  return count
}
