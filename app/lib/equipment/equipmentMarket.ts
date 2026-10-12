import {
  MARKET_GOLD_TARGETS,
  MARKET_DAILY_GOLD_FRACTION,
  MARKET_RESOURCE_BUY_MULTIPLIER,
  MARKET_TOOL_COUNTS,
  MARKET_EQUIPMENT_COUNTS,
  MARKET_LEATHER_EQUIPMENT_COUNT,
  MARKET_ARROW_COUNTS,
  MARKET_RESOURCE_COUNTS,
  MARKET_MATERIAL_MIN_LEVEL,
  MARKET_EQUIPMENT_MIN_LEVEL,
  MARKET_USED_VALUE_FLOOR,
  METAL_TIER_GOLD_VALUES,
  RESOURCE_GOLD_VALUES,
  EQUIPMENT_BASE_GOLD_VALUES,
  EQUIPMENT_RESALE_PERCENT,
} from '../../config/market'
import { getBuildingLevel } from '../buildings/buildingLevel'
import { getUnitResourceCarryRemaining } from '../resources/resourceDelivery'
import { isCurrentEquipment } from './equipmentMaterials'
import { SOLDIER_CIVILIZATION_DECORATION_EQUIPMENT } from '../lpc/civilizationHelmetDecorations'
import { isEquipmentEnabledForCivilization } from '../lpc/equipmentData'
import { isRemovedCape } from './armorVariants'
import { isHelmetDecoration, equipmentVisualParts, decorateHelmet } from './helmetVariants'
import { equipmentBaseKey, getEquipmentDurability } from './equipmentCondition'
import { FORGE_FAMILIES } from './forgeUpgrades'
import { UNIT_TYPES } from '../../constants'
import type { ResourceAmount } from '../../types/common'
import {
  DYNAMIC_EQUIPMENT_KEYS,
  dynamicEquipmentForUnit,
  dynamicEquipmentForWork,
  type DynamicEquipmentKey,
} from '../lpc/equipment'
import { addHeroInventoryItem, getHeroInventory, removeHeroInventoryItem } from './equipmentLoot'
import type { BuildingEntity, UnitEntity } from '../../types/entities'

export type MarketEquipmentOffer = {
  equipment: string
  goldValue: number
  count: number
}

export type MarketEquipmentOfferOptions = {
  civilization?: string
  buildingLevel?: number
}

export { MARKET_RESTOCK_INTERVAL_DAYS, MARKET_GOLD_TARGETS } from '../../config/market'
export function getMarketLevel(market: { buildingLevel?: number; assetLevel?: unknown }): number {
  return Math.min(MARKET_GOLD_TARGETS.length - 1, getBuildingLevel(market))
}
export function getMarketGoldTarget(market: MarketWallet): number {
  return MARKET_GOLD_TARGETS[getMarketLevel(market)]!
}

export function getMarketDailyGold(market: MarketWallet): number {
  return Math.floor(getMarketGoldTarget(market) * MARKET_DAILY_GOLD_FRACTION)
}

export type MarketWallet = Pick<BuildingEntity, 'marketGold'> &
  Partial<Pick<BuildingEntity, 'owner' | 'marketStock' | 'marketResourceStock' | 'buildingLevel' | 'assetLevel'>>

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

const MARKET_BLOCKED_EQUIPMENT = new Set(['quiver', 'longstick'])
const MARKET_BLOCKED_PREFIXES: string[] = []

function getMarketEquipmentOfferCount(equipment: string, level: number): number {
  if (equipment.startsWith('arrow_')) return MARKET_ARROW_COUNTS[level]!
  if (equipmentVisualParts(equipment).some(part => equipmentBaseKey(part).split('_').includes('leather')))
    return MARKET_LEATHER_EQUIPMENT_COUNT
  return /^(axe|pickaxe|hammer|scythe)_/.test(equipment) ? MARKET_TOOL_COUNTS[level]! : MARKET_EQUIPMENT_COUNTS[level]!
}

export function marketEquipmentUnlocked(equipment: string, level: number): boolean {
  return equipmentVisualParts(equipment).every(part => {
    const key = equipmentBaseKey(part)
    const materialLevel = Math.max(
      0,
      ...Object.entries(MARKET_MATERIAL_MIN_LEVEL)
        .filter(([material]) => key.split('_').includes(material))
        .map(([, minimum]) => minimum)
    )
    const required = Math.max(materialLevel, MARKET_EQUIPMENT_MIN_LEVEL[key] ?? 0)
    return level >= required
  })
}

function getStockCount(stock: readonly string[], equipment: string): number {
  return stock.filter(item => item === equipment).length
}

function removeFromMarketStock(stock: string[], equipment: string, count: number): number {
  let removed = 0
  for (let index = stock.length - 1; index >= 0 && removed < count; index--) {
    if (stock[index] !== equipment) continue
    stock.splice(index, 1)
    removed++
  }
  return removed
}

function metalTierValue(equipment: string): number {
  // Arrows use per-material unit prices instead of the full equipment surcharge.
  if (equipment.startsWith('arrow_')) return 0
  const tier = Object.keys(METAL_TIER_GOLD_VALUES).find(key => equipment.includes(`_${key}`))
  return tier ? METAL_TIER_GOLD_VALUES[tier] : 0
}

function equipmentBaseValue(equipment: DynamicEquipmentKey): number {
  const specific = EQUIPMENT_BASE_GOLD_VALUES[equipment]
  if (specific != null) return specific

  const matchingPrefix = Object.keys(EQUIPMENT_BASE_GOLD_VALUES)
    .filter(prefix => equipment === prefix || equipment.startsWith(`${prefix}_`))
    .sort((a, b) => b.length - a.length)[0]
  return matchingPrefix ? EQUIPMENT_BASE_GOLD_VALUES[matchingPrefix] : 10
}

function isMarketPurchasableEquipment(equipment: string): boolean {
  return (
    isCurrentEquipment(equipment) &&
    !isHelmetDecoration(equipment) &&
    !isRemovedCape(equipment) &&
    !MARKET_BLOCKED_EQUIPMENT.has(equipment) &&
    !MARKET_BLOCKED_PREFIXES.some(prefix => equipment.startsWith(prefix))
  )
}

export function getEquipmentGoldValue(equipment: string): number {
  const parts = equipmentVisualParts(equipment)
  const conditionFactor =
    MARKET_USED_VALUE_FLOOR + (1 - MARKET_USED_VALUE_FLOOR) * ((getEquipmentDurability(equipment) ?? 100) / 100)
  if (parts.length > 1)
    return Math.max(1, Math.floor(parts.reduce((sum, part) => sum + getEquipmentGoldValue(part), 0) * conditionFactor))
  equipment = equipmentBaseKey(equipment)
  if (!DYNAMIC_EQUIPMENT_KEYS.includes(equipment as DynamicEquipmentKey)) return 0
  const key = equipment as DynamicEquipmentKey
  return Math.max(1, Math.floor((equipmentBaseValue(key) + metalTierValue(key)) * conditionFactor))
}

export function getResourceGoldValue(resource: keyof ResourceAmount): number {
  return Math.max(0, Math.floor(RESOURCE_GOLD_VALUES[resource] ?? 0))
}

export function getMarketResourceBuyPrice(resource: keyof ResourceAmount): number {
  return getResourceGoldValue(resource) * MARKET_RESOURCE_BUY_MULTIPLIER
}

function getMarketEquipmentKeys(options: MarketEquipmentOfferOptions = {}): string[] {
  const { civilization } = options
  const level = getMarketLevel(options)
  const equipment = new Set<string>([
    'mace_bronze',
    'mace_iron',
    'slingshot',
    'spear_ceramic',
    'spear_bronze',
    'spear_iron',
  ])
  for (const family of ['axe', 'pickaxe', 'hammer', 'scythe']) {
    for (const material of ['ceramic', 'bronze', 'iron']) equipment.add(`${family}_${material}`)
  }
  for (const tier of [0, 1, 2, 3]) {
    const owner = { forgeUpgrades: Object.fromEntries(FORGE_FAMILIES.map(family => [family, tier])) }
    dynamicEquipmentForWork('heroSword', owner).forEach(item => equipment.add(item))
    dynamicEquipmentForWork('stoneminer', owner).forEach(item => equipment.add(item))
    for (const unitType of [UNIT_TYPES.chief, UNIT_TYPES.infantry, UNIT_TYPES.bowman, UNIT_TYPES.priest]) {
      dynamicEquipmentForUnit(unitType, owner, Number.POSITIVE_INFINITY, civilization).forEach(item =>
        equipment.add(item)
      )
    }
  }
  const baseItems = [...equipment].filter(
    (item): item is DynamicEquipmentKey =>
      DYNAMIC_EQUIPMENT_KEYS.includes(item as DynamicEquipmentKey) && isMarketPurchasableEquipment(item)
  )
  const decoration = SOLDIER_CIVILIZATION_DECORATION_EQUIPMENT.find(
    entry => typeof entry !== 'string' && isEquipmentEnabledForCivilization(entry, civilization)
  )
  return baseItems
    .flatMap(item =>
      item.startsWith('helmet_') && decoration && typeof decoration !== 'string'
        ? [item, decorateHelmet(item, [decoration.equipment])]
        : [item]
    )
    .filter(item => marketEquipmentUnlocked(item, level))
}

export function getMarketEquipmentOffers(
  options: MarketEquipmentOfferOptions = {},
  stock?: readonly string[]
): MarketEquipmentOffer[] {
  if (stock) {
    return [...new Set(stock)]
      .filter(equipment => {
        const parts = equipmentVisualParts(equipment)
        return (
          parts.length > 0 &&
          parts.every(part => DYNAMIC_EQUIPMENT_KEYS.includes(part as DynamicEquipmentKey)) &&
          isMarketPurchasableEquipment(equipment) &&
          marketEquipmentUnlocked(equipment, getMarketLevel(options))
        )
      })
      .map(equipment => ({
        count: getStockCount(stock, equipment),
        equipment,
        goldValue: getEquipmentGoldValue(equipment),
      }))
      .filter(offer => offer.count > 0 && offer.goldValue > 0)
  }

  return getMarketEquipmentKeys(options)
    .map(equipment => ({
      count: getMarketEquipmentOfferCount(equipment, getMarketLevel(options)),
      equipment,
      goldValue: getEquipmentGoldValue(equipment),
    }))
    .filter(offer => offer.goldValue > 0)
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

export function getEquipmentResaleGoldValue(equipment: string): number {
  return Math.max(1, Math.floor((getEquipmentGoldValue(equipment) * EQUIPMENT_RESALE_PERCENT) / 100))
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
