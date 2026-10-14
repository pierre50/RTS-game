import {
  MARKET_TOOL_COUNTS,
  MARKET_EQUIPMENT_COUNTS,
  MARKET_LEATHER_EQUIPMENT_COUNT,
  MARKET_ARROW_COUNTS,
  MARKET_MATERIAL_MIN_LEVEL,
  MARKET_EQUIPMENT_MIN_LEVEL,
} from '../../../config/market'
import { isCurrentEquipment } from '../equipmentMaterials'
import { SOLDIER_CIVILIZATION_DECORATION_EQUIPMENT } from '../../lpc/civilizationHelmetDecorations'
import { isEquipmentEnabledForCivilization } from '../../lpc/equipmentData'
import { isRemovedCape } from '../armorVariants'
import { isHelmetDecoration, equipmentVisualParts, decorateHelmet } from '../helmetVariants'
import { equipmentBaseKey } from '../equipmentCondition'
import { FORGE_FAMILIES } from '../forgeUpgrades'
import { UNIT_TYPES } from '../../../constants'
import {
  DYNAMIC_EQUIPMENT_KEYS,
  dynamicEquipmentForUnit,
  dynamicEquipmentForWork,
  type DynamicEquipmentKey,
} from '../../lpc/equipment'
import { getMarketLevel } from './marketWallet'
import { getEquipmentGoldValue } from './marketPricing'

type MarketEquipmentOffer = {
  equipment: string
  goldValue: number
  count: number
}

export type MarketEquipmentOfferOptions = {
  civilization?: string
  buildingLevel?: number
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

export function getStockCount(stock: readonly string[], equipment: string): number {
  return stock.filter(item => item === equipment).length
}

export function isMarketPurchasableEquipment(equipment: string): boolean {
  return (
    isCurrentEquipment(equipment) &&
    !isHelmetDecoration(equipment) &&
    !isRemovedCape(equipment) &&
    !MARKET_BLOCKED_EQUIPMENT.has(equipment) &&
    !MARKET_BLOCKED_PREFIXES.some(prefix => equipment.startsWith(prefix))
  )
}

function getMarketEquipmentKeys(options: MarketEquipmentOfferOptions = {}): string[] {
  const { civilization } = options
  const level = getMarketLevel(options)
  const equipment = new Set<string>([
    'mace_bronze',
    'mace_iron',
    'club_ceramic',
    'slingshot',
    'spear_ceramic',
    'spear_bronze',
    'spear_iron',
    'sword_curved_bronze',
    'sword_curved_iron',
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
