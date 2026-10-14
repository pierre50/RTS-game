import { migrateEquipmentMaterial } from './equipmentMaterials'
import { equipmentVisualParts } from './helmetVariants'
import { equipmentBaseKey } from './equipmentCondition'

export const FORGE_FAMILIES = ['axes', 'pickaxes', 'hammers', 'weapons', 'arrows', 'armor'] as const
export type ForgeFamily = (typeof FORGE_FAMILIES)[number]
export type ForgeUpgrades = Partial<Record<ForgeFamily, number>>
export type ForgeUpgradeOwner = { forgeUpgrades?: ForgeUpgrades }

// Keep retired tier 1 for decoding saves; migrated equipment never exposes copper gear.
export const FORGE_MATERIALS = ['ceramic', 'copper', 'bronze', 'iron'] as const
export function getForgeTier(owner: ForgeUpgradeOwner | null | undefined, family: ForgeFamily): number {
  const value = owner?.forgeUpgrades?.[family]
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(3, Math.floor(value))) : 0
}

/** Normalize explicit forge state; old save conversion lives at the serialization boundary. */
export function normalizeForgeUpgrades(owner: ForgeUpgradeOwner): ForgeUpgrades {
  return Object.fromEntries(FORGE_FAMILIES.map(family => [family, getForgeTier(owner, family)]))
}

function forgeFamilyForEquipment(equipment: string): ForgeFamily | undefined {
  if (equipment.startsWith('axe_')) return 'axes'
  if (equipment.startsWith('pickaxe_')) return 'pickaxes'
  if (equipment.startsWith('hammer_')) return 'hammers'
  if (
    equipment.startsWith('sword_') ||
    equipment.startsWith('dagger_') ||
    equipment.startsWith('mace_') ||
    equipment.startsWith('club_') ||
    equipment.startsWith('spear_')
  )
    return 'weapons'
  if (equipment.startsWith('arrow_') || equipment === 'bow') return 'arrows'
  if (/^(armor_|helmet_|shoulder_|bracers_|leg_armor_|round_shield_)/.test(equipment)) return 'armor'
  return undefined
}

export function resolveForgeEquipment(equipment: string, owner?: ForgeUpgradeOwner | null): string {
  const family = forgeFamilyForEquipment(equipment)
  if (!family) return migrateEquipmentMaterial(equipment)
  const tier = getForgeTier(owner, family)
  if (equipment === 'bow') return tier >= 2 ? 'bow_recurve' : 'bow'
  if (equipment === 'club_ceramic') return equipment
  if (/^(dagger|mace)_/.test(equipment)) return equipment.replace(/_(bronze|iron)$/, tier >= 3 ? '_iron' : '_bronze')
  if (equipment.startsWith('spear_'))
    return equipment.replace(/_(ceramic|bronze|iron)$/, tier >= 3 ? '_iron' : tier >= 1 ? '_bronze' : '_ceramic')
  const candidate = equipment.replace(/_(ceramic|copper|bronze|iron|leather|wood)(?=_|$)/, `_${FORGE_MATERIALS[tier]}`)
  // A plain leather torso and leather barbarian helmets do not gain metal variants.
  if (equipment === 'armor_leather') return equipment
  if (equipment.startsWith('helmet_barbarian_')) return migrateEquipmentMaterial(equipment)
  return migrateEquipmentMaterial(candidate)
}

/** Corpses keep the equipment captured at death, even after a village upgrade. */
export function resolveUnitForgeEquipment(
  equipment: string,
  unit: {
    type?: string
    isDead?: boolean
    lootEquipment?: string[]
    owner?: ForgeUpgradeOwner | null
  }
): string {
  if (unit.type === 'Hero' && !['axes', 'pickaxes', 'hammers'].includes(forgeFamilyForEquipment(equipment) ?? ''))
    return migrateEquipmentMaterial(equipment)
  if (unit.isDead && unit.lootEquipment) {
    const familyKey = (item: string) => {
      const key = equipmentBaseKey(item)
      if (/^(sword|axe|dagger|mace|club|spear)_/.test(key)) return 'melee'
      if (/^armor_/.test(key)) return 'torso'
      if (/^helmet_/.test(key)) return 'helmet'
      return key.replace(/_(ceramic|copper|bronze|iron|leather|wood)(?=_|$)/, '_material')
    }
    const saved = unit.lootEquipment
      .flatMap(equipmentVisualParts)
      .find(item => familyKey(item) === familyKey(equipment))
    if (saved) return equipmentBaseKey(migrateEquipmentMaterial(saved))
  }
  return resolveForgeEquipment(equipment, unit.owner)
}
