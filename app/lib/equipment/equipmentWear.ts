import { notifyVillageWorkChanged } from '../units/village/villageWorkEvents'
import { getEquippedWorkTool, toolFamilyForWork, workToolFamily, workToolUse } from './workTools'
import { hasNpcWeaponInventory, getNpcWeaponChoice } from '../units/combat/npcWeapons'
import type { UnitEntity } from '../../types/entities'
import {
  equipmentBaseKey,
  getEquipmentDurability,
  getEquipmentRemainingUses,
  withEquipmentRemainingUses,
} from './equipmentCondition'
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
  const before = getEquipmentRemainingUses(item)
  if (before == null || before <= 0) return
  const next = withEquipmentRemainingUses(item, before - 1)
  replace(next)
  if (before === 1) {
    if (unit.owner) notifyVillageWorkChanged(unit.owner)
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
export function wearEquippedWeapon(unit: UnitEntity, kind: 'melee' | 'ranged', selectedIndex?: number): void {
  if (hasNpcWeaponInventory(unit)) {
    const choice = getNpcWeaponChoice(unit)
    const index = selectedIndex ?? (choice.kind === kind ? choice.index : -1)
    if (index === -2) {
      wearEquippedTool(unit)
      return
    }
    const bag = unit.inventory?.equipment
    const item = bag?.[index]
    if (item && bag)
      worn(unit, item, next => {
        bag[index] = next
      })
    return
  }
  if (usesInventory(unit)) {
    const slots = unit.inventory?.activeWeapons
    if (
      kind === 'melee' &&
      toolFamilyForWork(unit.work) &&
      toolFamilyForWork(unit.work) === workToolFamily(getEquippedWorkTool(unit))
    ) {
      wearEquippedTool(unit)
      return
    }
    const item = slots?.[kind]
    if (slots && item)
      worn(unit, item, next => {
        slots[kind] = next
      })
    return
  }
  wearNpcItem(unit, item =>
    kind === 'ranged'
      ? equipmentBaseKey(item) === 'slingshot' || item.startsWith('bow')
      : item.startsWith('spear_') ||
        item.startsWith('mace_') ||
        item.startsWith('club_') ||
        item.startsWith('sword_') ||
        item.startsWith('dagger_')
  )
}

export function wearEquippedArmor(unit: UnitEntity): void {
  if (usesInventory(unit)) {
    const slots = unit.inventory?.equipped
    for (const slot of ['armor', 'shoulders'] as const) {
      const item = slots?.[slot]
      if (slots && item)
        worn(unit, item, next => {
          slots[slot] = next
        })
    }
    return
  }
  wearNpcItem(unit, item => item.startsWith('armor_'))
  wearNpcItem(unit, item => item.startsWith('shoulder_'))
}

export function wearEquippedTool(unit: UnitEntity, action?: string | null): void {
  const item = getEquippedWorkTool(unit)
  const targetType = (unit.dest as { type?: string } | null | undefined)?.type
  if (!item || (action && workToolUse(unit, action, targetType) !== 'tool')) return
  worn(unit, item, next => {
    unit.inventory!.activeWeapons!.tool = next
  })
}

/** Guard wears the item actually held, independently of the worker's current job. */
export function wearEquippedGuard(unit: UnitEntity, slot: 'tool' | 'melee'): void {
  const slots = unit.inventory?.activeWeapons
  const item = slots?.[slot]
  if (slots && item)
    worn(unit, item, next => {
      slots[slot] = next
    })
}
