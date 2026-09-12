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
import type { MenuDetails } from '../../types/ui'

type EquipmentDetailsMode = 'inventory' | 'market-buy' | 'market-sell'
type ResourceDetailsMode = 'inventory' | 'market-sell'

type InventoryRowInfo = {
  goldValue: number
  description: string
  meta: string
  title: string
}

export function formatGold(amount: number): string {
  return `${amount} ${t('goldShort')}`
}

function getEquipmentKindLabel(equipment: string): string {
  if (getWeaponSlot(equipment)) return t('detailsEquipmentWeapon')
  if (getEquipmentSlot(equipment)) return t('detailsEquipmentArmor')
  return t('detailsEquipmentItem')
}

function getResourceDescription(resource: keyof ResourceAmount): string {
  return t(`resourceDescription_${resource}`)
}

function createResourceDetails(
  resource: keyof ResourceAmount,
  amount = 1,
  mode: ResourceDetailsMode = 'inventory'
): MenuDetails {
  const goldValue = getResourceGoldValue(resource)
  const totalValue = goldValue * Math.max(1, Math.floor(amount))
  return {
    title: amount > 1 ? `${t(resource)} x${amount}` : t(resource),
    description: getResourceDescription(resource),
    meta: [
      t('detailsResourceIngredient'),
      goldValue > 0
        ? t(mode === 'market-sell' ? 'detailsSellValue' : 'detailsValue', { gold: formatGold(totalValue) })
        : null,
    ],
  }
}

export function createResourceRowInfo(
  resource: keyof ResourceAmount,
  amount = 1,
  mode: ResourceDetailsMode = 'inventory',
  options: { showValue?: boolean } = {}
): InventoryRowInfo {
  const details = createResourceDetails(resource, amount, mode)
  const showValue = options.showValue ?? true
  const totalValue = getResourceGoldValue(resource) * Math.max(1, Math.floor(amount))
  const hiddenMeta = new Set<string>()
  if (!showValue && totalValue > 0) {
    hiddenMeta.add(t(mode === 'market-sell' ? 'detailsSellValue' : 'detailsValue', { gold: formatGold(totalValue) }))
  }
  return {
    goldValue: totalValue,
    title: t(resource),
    description: details.description ?? '',
    meta: details.meta?.filter(item => item && !hiddenMeta.has(item)).join(' | ') ?? '',
  }
}

function createEquipmentDetails(
  equipment: string,
  count = 1,
  mode: EquipmentDetailsMode = 'inventory'
): MenuDetails {
  const stats = getEquipmentCombatStats([equipment])
  const value = getEquipmentGoldValue(equipment)
  const amount = Math.max(1, Math.floor(count))
  return {
    title: formatEquipmentStackLabel(equipment, amount),
    description: getEquipmentKindLabel(equipment),
    meta: [
      stats.weaponPower > 0 ? t('detailsDamage', { value: stats.weaponPower }) : null,
      stats.weaponPower > 0 && stats.weaponPower < 2 ? t('detailsLowDamageNote') : null,
      stats.meleeArmor > 0 ? t('detailsMeleeDefense', { value: stats.meleeArmor }) : null,
      stats.pierceArmor > 0 ? t('detailsPierceDefense', { value: stats.pierceArmor }) : null,
      value > 0 && mode !== 'market-sell'
        ? t(mode === 'market-buy' ? 'detailsBuyValue' : 'detailsValue', { gold: formatGold(value * amount) })
        : null,
    ],
  }
}

export function createEquipmentRowInfo(
  equipment: string,
  count = 1,
  mode: EquipmentDetailsMode = 'inventory',
  options: { showValue?: boolean } = {}
): InventoryRowInfo {
  const details = createEquipmentDetails(equipment, count, mode)
  const showValue = options.showValue ?? true
  const value = getEquipmentGoldValue(equipment)
  const amount = Math.max(1, Math.floor(count))
  const hiddenMeta = new Set<string>()
  if (!showValue && value > 0) {
    hiddenMeta.add(t(mode === 'market-buy' ? 'detailsBuyValue' : 'detailsValue', { gold: formatGold(value * amount) }))
  }
  return {
    goldValue: value * amount,
    title: formatEquipmentLootLabel(equipment),
    description: details.description ?? '',
    meta: details.meta?.filter(item => item && !hiddenMeta.has(item)).join(' | ') ?? '',
  }
}
