import type { UnitEntity } from '../../types/entities'
import { equipmentBaseKey, getEquipmentDurability, withEquipmentDurability } from './equipmentCondition'
import { getConfiguredEntityEquipment, refreshUnitEquipmentStats } from './equipmentStats'
import { formatEquipmentLootLabel } from './equipmentSlots'
import { t } from '../lang'

function usesInventory(unit: UnitEntity): boolean {
  return Boolean(
    unit.inventory &&
      (unit.inventory.activeWeapons ||
        unit.inventory.equipped ||
        unit.type === 'Hero' ||
        unit.controlMode === 'hero' ||
        unit.context?.controls?.heroUnit === unit)
  )
}
function worn(unit: UnitEntity, item: string, replace: (next: string) => void): void {
  const before = getEquipmentDurability(item)
  if (before == null || before <= 0) return
  const next = withEquipmentDurability(item, before - 1)
  replace(next)
  if (before === 1) {
    refreshUnitEquipmentStats(unit)
    if (unit.context?.controls?.heroUnit === unit) {
      unit.context.menu?.showMessage?.(t('equipmentBrokenMessage', { item: formatEquipmentLootLabel(item) }), 'warning')
    }
  }
  if (unit.context?.controls?.heroUnit === unit) unit.context.menu?.updateHeroStatus?.(unit)
}
function wearNpcItem(unit: UnitEntity, matches: (item: string) => boolean): void {
  const item = getConfiguredEntityEquipment(unit).find(matches)
  if (!item) return
  worn(unit, item, next => {
    unit.equipmentDurability ??= {}
    unit.equipmentDurability[equipmentBaseKey(item)] = getEquipmentDurability(next) ?? 100
  })
}

/** One point per successful contact / arrow released, never for swinging into empty air. */
export function wearEquippedWeapon(unit: UnitEntity, kind: 'melee' | 'ranged'): void {
  if (usesInventory(unit)) {
    const slots = unit.inventory?.activeWeapons
    const item = slots?.[kind]
    if (slots && item)
      worn(unit, item, next => {
        slots[kind] = next
      })
    return
  }
  wearNpcItem(unit, item =>
    kind === 'ranged' ? item.startsWith('bow') : item.startsWith('sword_') || equipmentBaseKey(item) === 'longsword'
  )
}

export function wearEquippedArmor(unit: UnitEntity): void {
  if (usesInventory(unit)) {
    const slots = unit.inventory?.equipped
    const item = slots?.armor
    if (slots && item)
      worn(unit, item, next => {
        slots.armor = next
      })
    return
  }
  wearNpcItem(unit, item => item.startsWith('armor_'))
}
