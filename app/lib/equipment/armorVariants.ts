import { migrateEquipmentRecord } from './equipmentMaterials'
import type { UnitEntity } from '../../types/entities'
import { equipmentBaseKey, getEquipmentDurability, withEquipmentDurability } from './equipmentCondition'
import { bundleHelmetDecorations, equipmentVisualParts, migrateHelmetInventory } from './helmetVariants'

export function isRemovedCape(item: string): boolean {
  return equipmentBaseKey(item).startsWith('cape_')
}

/** Convert old composite torsos without repairing them or losing their shoulder pieces. */
function splitLegacyArmor(item: string): string[] {
  if (isRemovedCape(item)) return []
  if (!equipmentBaseKey(item).startsWith('armor_')) return [item]
  const parts = equipmentVisualParts(item).filter(part => !isRemovedCape(part))
  const condition = getEquipmentDurability(item)
  return parts.map(part => (condition == null ? part : withEquipmentDurability(part, condition)))
}

export function bundleEquipmentParts(items: readonly string[]): string[] {
  return bundleHelmetDecorations(items.flatMap(splitLegacyArmor))
}

export function migrateEquipmentInventory(inventory: NonNullable<UnitEntity['inventory']>): void {
  migrateEquipmentRecord({ inventory })
  migrateHelmetInventory(inventory)
  const equipped = inventory.equipped
  if (equipped) {
    delete equipped.cape
    if (inventory.equippedCounts) delete inventory.equippedCounts.cape
    if (equipped.armor) {
      const [torso, ...parts] = splitLegacyArmor(equipped.armor)
      equipped.armor = torso
      for (const part of parts) {
        if (equipmentBaseKey(part).startsWith('shoulder_') && !equipped.shoulders) {
          equipped.shoulders = part
          ;(inventory.equippedCounts ??= {}).shoulders = 1
        } else (inventory.equipment ??= []).push(part)
      }
    }
  }
  if (inventory.equipment) {
    const items = bundleEquipmentParts(inventory.equipment)
    inventory.equipment.splice(0, inventory.equipment.length, ...items)
  }
}
