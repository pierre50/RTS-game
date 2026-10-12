import { Assets } from 'pixi.js'
import type { EquipmentStats } from '../../types/config'
import { equipmentBaseKey, isEquipmentBroken } from './equipmentCondition'
import { migrateEquipmentMaterial } from './equipmentMaterials'
import { equipmentVisualParts } from './helmetVariants'

export type EquipmentCombatStats = {
  weaponPower: number
  armor: number
}

const FALLBACK_EQUIPMENT_STATS: Record<string, EquipmentStats> = {
  axe_ceramic: { weapon: { power: 2 } },
  axe_bronze: { weapon: { power: 4 } },
  axe_iron: { weapon: { power: 5 } },
  pickaxe_ceramic: { weapon: { power: 2 } },
  pickaxe_bronze: { weapon: { power: 4 } },
  pickaxe_iron: { weapon: { power: 5 } },
  hammer_ceramic: { weapon: { power: 2 } },
  hammer_bronze: { weapon: { power: 4 } },
  hammer_iron: { weapon: { power: 5 } },
  scythe_ceramic: { weapon: { power: 2 } },
  scythe_bronze: { weapon: { power: 4 } },
  scythe_iron: { weapon: { power: 5 } },
  slingshot: { weapon: { power: 2, range: 3 } },
  bow: { weapon: { power: 5, range: 4 } },
  bow_great: { weapon: { power: 7, range: 5 } },
  bow_recurve: { weapon: { power: 9, range: 6 } },
  arrow_ceramic: { weapon: { power: 1 } },
  arrow_bronze: { weapon: { power: 3 } },
  arrow_iron: { weapon: { power: 4 } },
  dagger_bronze: { weapon: { power: 6 } },
  dagger_iron: { weapon: { power: 8 } },
  spear_ceramic: { weapon: { power: 4 } },
  spear_bronze: { weapon: { power: 8 } },
  spear_iron: { weapon: { power: 10 } },
  mace_bronze: { weapon: { power: 10 } },
  mace_iron: { weapon: { power: 12 } },
  sword_bronze: { weapon: { power: 10 } },
  sword_iron: { weapon: { power: 12 } },
  armor_leather: { armor: 1 },
  armor_mail_iron: { armor: 4 },
  armor_legion_bronze: { armor: 4 },
  armor_legion_iron: { armor: 5 },
  helmet_pointed_leather: { armor: 1 },
  helmet_pointed_bronze: { armor: 2 },
  helmet_pointed_iron: { armor: 2 },
  helmet_barbuta_bronze: { armor: 2 },
  helmet_barbuta_iron: { armor: 5 },
  helmet_legion_bronze: { armor: 2 },
  helmet_legion_iron: { armor: 4 },
  helmet_nasal_bronze: { armor: 2 },
  helmet_nasal_iron: { armor: 3 },
  helmet_bascinet_round_bronze: { armor: 2 },
  helmet_bascinet_round_iron: { armor: 3 },
  helmet_norman_bronze: { armor: 2 },
  helmet_norman_iron: { armor: 3 },
  helmet_barbarian_leather: { armor: 1 },
  helmet_barbarian_nasal_leather: { armor: 1 },
  shoulder_legion_leather: { armor: 1 },
  shoulder_legion_bronze: { armor: 2 },
  shoulder_legion_iron: { armor: 2 },
  bracers_leather: { armor: 1 },
  bracers_bronze: { armor: 2 },
  bracers_iron: { armor: 2 },
  leg_armor_leather: { armor: 1 },
  leg_armor_bronze: { armor: 2 },
  leg_armor_iron: { armor: 2 },
  longsword: { weapon: { power: 11 } },
  round_shield_wood_slash: { armor: 1 },
  round_shield_bronze_slash: { armor: 2 },
  round_shield_iron_slash: { armor: 3 },
  cane: { weapon: { power: 1 } },
  longstick: { weapon: { power: 1 } },
  catchingPole: { weapon: { power: 1 } },
  boar_tusks: { weapon: { power: 3 } },
  wolf_bite: { weapon: { power: 4 } },
  watch_tower_arrow: { weapon: { power: 3 } },
}

export function loadedEquipmentStats(): Record<string, EquipmentStats> {
  return (
    (Assets.cache.get('config') as { equipment?: Record<string, EquipmentStats> } | undefined)?.equipment ||
    (Assets.cache.get('equipmentData') as Record<string, EquipmentStats> | undefined) ||
    FALLBACK_EQUIPMENT_STATS
  )
}

function emptyStats(): EquipmentCombatStats {
  return { weaponPower: 0, armor: 0 }
}

export function getWeaponRangeFromEquipment(
  equipment: readonly string[] = [],
  definitions: Record<string, EquipmentStats> = loadedEquipmentStats()
): number | undefined {
  let bestRange = 0
  for (const key of equipment) {
    if (isEquipmentBroken(key)) continue
    const itemRange = definitions[equipmentBaseKey(migrateEquipmentMaterial(key))]?.weapon?.range
    if (typeof itemRange === 'number' && itemRange > bestRange) {
      bestRange = itemRange
    }
  }
  return bestRange > 0 ? bestRange : undefined
}

export function getEquipmentCombatStats(
  equipment: readonly string[] = [],
  definitions: Record<string, EquipmentStats> = loadedEquipmentStats()
): EquipmentCombatStats {
  const stats = emptyStats()
  for (const key of equipment) {
    if (isEquipmentBroken(key)) continue
    for (const part of equipmentVisualParts(migrateEquipmentMaterial(key))) {
      const item = definitions[part]
      if (!item) continue
      stats.weaponPower += item.weapon?.power ?? 0
      stats.armor += item.armor ?? 0
    }
  }
  return stats
}
