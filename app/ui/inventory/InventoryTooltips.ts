import { getEquipmentSlot, getWeaponSlot, formatEquipmentStackLabel } from '../../lib/equipment/equipmentLoot'
import {
  getEquipmentGoldValue,
  getEquipmentResaleGoldValue,
  getResourceGoldValue,
} from '../../lib/equipment/equipmentMarket'
import { getEquipmentCombatStats } from '../../lib/equipment/equipmentStats'
import { t } from '../../lib/lang'
import type { ResourceAmount } from '../../types/common'
import type { TooltipContent } from '../../types/ui'

type EquipmentTooltipMode = 'inventory' | 'market-buy' | 'market-sell'
type ResourceTooltipMode = 'inventory' | 'market-sell'

function formatGold(amount: number): string {
  return `${amount} ${t('goldShort')}`
}

function getEquipmentKindLabel(equipment: string): string {
  if (getWeaponSlot(equipment)) return t('tooltipEquipmentWeapon')
  if (getEquipmentSlot(equipment)) return t('tooltipEquipmentArmor')
  return t('tooltipEquipmentItem')
}

function getResourceDescription(resource: keyof ResourceAmount): string {
  return t(`resourceDescription_${resource}`)
}

export function createResourceTooltip(
  resource: keyof ResourceAmount,
  amount = 1,
  mode: ResourceTooltipMode = 'inventory'
): TooltipContent {
  const goldValue = getResourceGoldValue(resource)
  const totalValue = goldValue * Math.max(1, Math.floor(amount))
  return {
    title: amount > 1 ? `${t(resource)} x${amount}` : t(resource),
    description: getResourceDescription(resource),
    meta: [
      t('tooltipResourceIngredient'),
      goldValue > 0
        ? t(mode === 'market-sell' ? 'tooltipSellValue' : 'tooltipValue', { gold: formatGold(totalValue) })
        : null,
    ],
  }
}

export function createEquipmentTooltip(
  equipment: string,
  count = 1,
  mode: EquipmentTooltipMode = 'inventory'
): TooltipContent {
  const stats = getEquipmentCombatStats([equipment])
  const value = getEquipmentGoldValue(equipment)
  const resaleValue = getEquipmentResaleGoldValue(equipment)
  const amount = Math.max(1, Math.floor(count))
  return {
    title: formatEquipmentStackLabel(equipment, amount),
    description: getEquipmentKindLabel(equipment),
    meta: [
      stats.weaponPower > 0 ? t('tooltipDamage', { value: stats.weaponPower }) : null,
      stats.weaponPower > 0 && stats.weaponPower < 2 ? t('tooltipLowDamageNote') : null,
      stats.meleeArmor > 0 ? t('tooltipMeleeDefense', { value: stats.meleeArmor }) : null,
      stats.pierceArmor > 0 ? t('tooltipPierceDefense', { value: stats.pierceArmor }) : null,
      value > 0 && mode !== 'market-sell'
        ? t(mode === 'market-buy' ? 'tooltipBuyValue' : 'tooltipValue', { gold: formatGold(value * amount) })
        : null,
      resaleValue > 0 ? t('tooltipResaleValue', { gold: formatGold(resaleValue * amount) }) : null,
    ],
  }
}
