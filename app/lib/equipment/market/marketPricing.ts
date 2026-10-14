import {
  MARKET_RESOURCE_BUY_MULTIPLIER,
  MARKET_USED_VALUE_FLOOR,
  METAL_TIER_GOLD_VALUES,
  RESOURCE_GOLD_VALUES,
  EQUIPMENT_BASE_GOLD_VALUES,
  EQUIPMENT_RESALE_PERCENT,
} from '../../../config/market'
import { equipmentVisualParts } from '../helmetVariants'
import { equipmentBaseKey, getEquipmentDurability } from '../equipmentCondition'
import { DYNAMIC_EQUIPMENT_KEYS, type DynamicEquipmentKey } from '../../lpc/equipment'
import type { ResourceAmount } from '../../../types/common'

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

export function getEquipmentResaleGoldValue(equipment: string): number {
  return Math.max(1, Math.floor((getEquipmentGoldValue(equipment) * EQUIPMENT_RESALE_PERCENT) / 100))
}

export function getResourceGoldValue(resource: keyof ResourceAmount): number {
  return Math.max(0, Math.floor(RESOURCE_GOLD_VALUES[resource] ?? 0))
}

export function getMarketResourceBuyPrice(resource: keyof ResourceAmount): number {
  return getResourceGoldValue(resource) * MARKET_RESOURCE_BUY_MULTIPLIER
}
