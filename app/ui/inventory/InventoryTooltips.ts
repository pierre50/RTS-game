import {
  formatEquipmentLootLabel,
  formatEquipmentStackLabel,
  getEquipmentSlot,
  getWeaponSlot,
} from '../../lib/equipment/equipmentLoot'
import { getEquipmentGoldValue, getResourceGoldValue } from '../../lib/equipment/equipmentMarket'
import { getEquipmentCombatStats } from '../../lib/equipment/equipmentStats'
import { t } from '../../lib/lang'
import type { ResourceAmount } from '../../types/common'
import type { TooltipContent } from '../../types/ui'

type EquipmentTooltipMode = 'inventory' | 'market-buy' | 'market-sell'
type ResourceTooltipMode = 'inventory' | 'market-sell'

type InventoryRowInfo = {
  description: string
  meta: string
  title: string
  tooltip: TooltipContent
}

export function formatGold(amount: number): string {
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

export function createResourceRowInfo(
  resource: keyof ResourceAmount,
  amount = 1,
  mode: ResourceTooltipMode = 'inventory',
  options: { showValue?: boolean } = {}
): InventoryRowInfo {
  const tooltip = createResourceTooltip(resource, amount, mode)
  const showValue = options.showValue ?? true
  const totalValue = getResourceGoldValue(resource) * Math.max(1, Math.floor(amount))
  const hiddenMeta = new Set<string>()
  if (!showValue && totalValue > 0) {
    hiddenMeta.add(t(mode === 'market-sell' ? 'tooltipSellValue' : 'tooltipValue', { gold: formatGold(totalValue) }))
  }
  return {
    title: t(resource),
    description: tooltip.description ?? '',
    meta: tooltip.meta?.filter(item => item && !hiddenMeta.has(item)).join(' | ') ?? '',
    tooltip,
  }
}

export function createEquipmentTooltip(
  equipment: string,
  count = 1,
  mode: EquipmentTooltipMode = 'inventory'
): TooltipContent {
  const stats = getEquipmentCombatStats([equipment])
  const value = getEquipmentGoldValue(equipment)
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
    ],
  }
}

export function createEquipmentRowInfo(
  equipment: string,
  count = 1,
  mode: EquipmentTooltipMode = 'inventory',
  options: { showValue?: boolean } = {}
): InventoryRowInfo {
  const tooltip = createEquipmentTooltip(equipment, count, mode)
  const showValue = options.showValue ?? true
  const value = getEquipmentGoldValue(equipment)
  const amount = Math.max(1, Math.floor(count))
  const hiddenMeta = new Set<string>()
  if (!showValue && value > 0) {
    hiddenMeta.add(t(mode === 'market-buy' ? 'tooltipBuyValue' : 'tooltipValue', { gold: formatGold(value * amount) }))
  }
  return {
    title: formatEquipmentLootLabel(equipment),
    description: tooltip.description ?? '',
    meta: tooltip.meta?.filter(item => item && !hiddenMeta.has(item)).join(' | ') ?? '',
    tooltip,
  }
}
