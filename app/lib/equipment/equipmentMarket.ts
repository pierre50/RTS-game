import { UNIT_TYPES, type RESOURCE_STORAGE_NAMES } from '../../constants'
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
  equipment: DynamicEquipmentKey
  goldValue: number
  count: number
}

export type MarketEquipmentOfferOptions = {
  age?: number
  civilization?: string
}

type ResourceStorageName = (typeof RESOURCE_STORAGE_NAMES)[number]

export const MARKET_RESTOCK_INTERVAL_DAYS = 3

const METAL_TIER_GOLD_VALUES: Record<string, number> = {
  ceramic: 45,
  leather: 70,
  copper: 95,
  bronze: 160,
  iron: 260,
}

const RESOURCE_GOLD_VALUES: Record<ResourceStorageName, number> = {
  wood: 1,
  berry: 1,
  meat: 2,
  wheat: 1,
  herb: 3,
  toxicHerb: 5,
  fiber: 2,
  feather: 4,
  leather: 6,
  sinew: 8,
  stone: 2,
  gold: 1,
  copper: 3,
  iron: 5,
}

const EQUIPMENT_BASE_GOLD_VALUES: Record<string, number> = {
  arrow: 4,
  bow: 180,
  bow_great: 280,
  bow_recurve: 420,
  sword: 140,
  longsword: 520,
  halberd: 620,
  armor_leather: 180,
  armor_mail: 340,
  armor_legion: 520,
  helmet: 140,
  shoulder_legion: 160,
  bracers: 120,
  leg_armor: 140,
  round_shield: 180,
  cape_solid: 220,
  crest: 160,
  centurion_crest: 320,
  centurion_plumage: 340,
  legion_plumage: 260,
  plumage: 160,
  helmet_wings: 260,
  upward_horns_white: 220,
  upward_horns_ceramic: 260,
  sack_cloth_hood_leather: 180,
  cane: 120,
}

const EQUIPMENT_RESALE_PERCENT = 35

const MARKET_BLOCKED_EQUIPMENT = new Set(['quiver'])
const MARKET_BLOCKED_PREFIXES = ['axe_', 'pickaxe_', 'hammer_', 'scythe_']

function getMarketEquipmentOfferCount(equipment: string): number {
  return equipment.startsWith('arrow_') ? 20 : 1
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
    !MARKET_BLOCKED_EQUIPMENT.has(equipment) && !MARKET_BLOCKED_PREFIXES.some(prefix => equipment.startsWith(prefix))
  )
}

export function getEquipmentGoldValue(equipment: string): number {
  if (!DYNAMIC_EQUIPMENT_KEYS.includes(equipment as DynamicEquipmentKey)) return 0
  const key = equipment as DynamicEquipmentKey
  return Math.max(1, Math.floor(equipmentBaseValue(key) + metalTierValue(key)))
}

export function getResourceGoldValue(resource: keyof ResourceAmount): number {
  return Math.max(0, Math.floor(RESOURCE_GOLD_VALUES[resource as ResourceStorageName] ?? 0))
}

function getMarketEquipmentKeys(options: MarketEquipmentOfferOptions = {}): DynamicEquipmentKey[] {
  const { age = 0, civilization } = options
  const equipment = new Set<string>()
  dynamicEquipmentForWork('heroSword', age).forEach(item => equipment.add(item))
  for (const unitType of [UNIT_TYPES.chief, UNIT_TYPES.infantry, UNIT_TYPES.bowman, UNIT_TYPES.priest]) {
    dynamicEquipmentForUnit(unitType, age, Number.POSITIVE_INFINITY, civilization).forEach(item => equipment.add(item))
  }
  return [...equipment].filter(
    (item): item is DynamicEquipmentKey =>
      DYNAMIC_EQUIPMENT_KEYS.includes(item as DynamicEquipmentKey) && isMarketPurchasableEquipment(item)
  )
}

export function getMarketEquipmentOffers(
  options: MarketEquipmentOfferOptions = {},
  stock?: readonly string[]
): MarketEquipmentOffer[] {
  if (stock) {
    return [...new Set(stock)]
      .filter(
        (equipment): equipment is DynamicEquipmentKey =>
          DYNAMIC_EQUIPMENT_KEYS.includes(equipment as DynamicEquipmentKey) && isMarketPurchasableEquipment(equipment)
      )
      .map(equipment => ({
        count: getStockCount(stock, equipment),
        equipment,
        goldValue: getEquipmentGoldValue(equipment),
      }))
      .filter(offer => offer.count > 0 && offer.goldValue > 0)
  }

  return getMarketEquipmentKeys(options)
    .map(equipment => ({
      count: getMarketEquipmentOfferCount(equipment),
      equipment,
      goldValue: getEquipmentGoldValue(equipment),
    }))
    .filter(offer => offer.goldValue > 0)
}

function createMarketEquipmentStock(options: MarketEquipmentOfferOptions = {}): DynamicEquipmentKey[] {
  return getMarketEquipmentOffers(options).flatMap(offer => Array.from({ length: offer.count }, () => offer.equipment))
}

export function resetMarketEquipmentStock(
  market: Pick<BuildingEntity, 'marketStock'> | null | undefined,
  options: MarketEquipmentOfferOptions = {}
): string[] {
  if (!market) return []
  market.marketStock = createMarketEquipmentStock(options)
  return market.marketStock
}

export function ensureMarketEquipmentStock(
  market: Pick<BuildingEntity, 'marketStock'> | null | undefined,
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
  equipment: string,
  requestedCount = 1,
  stock?: string[]
): number {
  if (!hero) return 0
  const goldValue = getEquipmentGoldValue(equipment)
  if (goldValue <= 0) return 0
  const inventory = getHeroInventory(hero)
  const gold = Math.max(0, Math.floor(inventory.resources?.gold ?? 0))
  const availableStock = stock ? getStockCount(stock, equipment) : Number.POSITIVE_INFINITY
  const count = Math.min(Math.max(1, Math.floor(requestedCount)), Math.floor(gold / goldValue), availableStock)
  if (count <= 0) return 0
  if (!addHeroInventoryItem(hero, equipment, count)) return 0
  if (stock && removeFromMarketStock(stock, equipment, count) !== count) return 0
  inventory.resources!.gold = gold - goldValue * count
  if (inventory.resources!.gold <= 0) delete inventory.resources!.gold
  return count
}

export function sellHeroEquipment(hero: UnitEntity | null | undefined, equipment: string, count = 1): number {
  if (!hero) return 0
  const goldValue = getEquipmentResaleGoldValue(equipment)
  if (goldValue <= 0) return 0
  const amount = Math.max(1, Math.floor(count))
  let sold = 0
  for (let index = 0; index < amount; index++) {
    if (!removeHeroInventoryItem(hero, equipment)) break
    sold++
  }
  if (sold <= 0) return 0
  const inventory = getHeroInventory(hero)
  inventory.resources!.gold = (inventory.resources!.gold ?? 0) + sold * goldValue
  return sold
}

export function sellHeroResource(
  hero: UnitEntity | null | undefined,
  resource: keyof ResourceAmount,
  requestedAmount?: number
): number {
  if (!hero || resource === 'gold') return 0
  const goldValue = getResourceGoldValue(resource)
  if (goldValue <= 0) return 0
  const inventory = getHeroInventory(hero)
  const resources = inventory.resources!
  const available = Math.max(0, Math.floor(resources[resource] ?? 0))
  const amount = requestedAmount == null ? available : Math.min(available, Math.max(0, Math.floor(requestedAmount)))
  if (amount <= 0) return 0
  resources[resource] = available - amount
  if ((resources[resource] ?? 0) <= 0) delete resources[resource]
  resources.gold = (resources.gold ?? 0) + amount * goldValue
  return amount
}
