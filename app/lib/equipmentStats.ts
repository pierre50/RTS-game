import { Assets } from 'pixi.js'
import { FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { dynamicEquipmentForUnit, dynamicEquipmentForWork } from './lpc/equipment'
import { getUnitEquipmentLevel } from './unitExperience'
import type { EquipmentStats, UnitConfig } from '../types/config'
import type { UnitEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'

const COMBAT_STAT_KEYS = ['meleeArmor', 'pierceArmor'] as const
type CombatStatKey = (typeof COMBAT_STAT_KEYS)[number]

export const UNARMED_UNIT_WEAPON_POWER = 0.5

export type EquipmentCombatStats = {
  weaponPower: number
  meleeArmor: number
  pierceArmor: number
}

type EquipmentEntityLike = {
  equipment?: string[]
  experience?: UnitEntity['experience']
  family?: string
  owner?: Pick<PlayerLike, 'age' | 'config'> | null
  type?: string
  work?: string | null
}

const MELEE_WEAPON_EQUIPMENT_KEYS = new Set([
  'axe_ceramic',
  'axe_copper',
  'axe_bronze',
  'axe_iron',
  'sword_ceramic',
  'sword_copper',
  'sword_bronze',
  'sword_iron',
  'longsword',
  'halberd',
  'cane',
])

const FALLBACK_EQUIPMENT_STATS: Record<string, EquipmentStats> = {
  axe_copper: { weapon: { power: 6 } },
  axe_ceramic: { weapon: { power: 3 } },
  axe_bronze: { weapon: { power: 8 } },
  axe_iron: { weapon: { power: 10 } },
  pickaxe_copper: { weapon: { power: 3 } },
  pickaxe_ceramic: { weapon: { power: 1 } },
  pickaxe_bronze: { weapon: { power: 5 } },
  pickaxe_iron: { weapon: { power: 7 } },
  hammer_copper: { weapon: { power: 3 } },
  hammer_ceramic: { weapon: { power: 1 } },
  hammer_bronze: { weapon: { power: 5 } },
  hammer_iron: { weapon: { power: 7 } },
  scythe_copper: { weapon: { power: 4 } },
  scythe_ceramic: { weapon: { power: 2 } },
  scythe_bronze: { weapon: { power: 6 } },
  scythe_iron: { weapon: { power: 8 } },
  bow: { weapon: { power: 4, range: 4 } },
  bow_great: { weapon: { power: 6, range: 5 } },
  bow_recurve: { weapon: { power: 8, range: 6 } },
  halberd: { weapon: { power: 17 } },
  sword_copper: { weapon: { power: 6 } },
  sword_ceramic: { weapon: { power: 4 } },
  sword_bronze: { weapon: { power: 8 } },
  sword_iron: { weapon: { power: 10 } },
  armor_leather: { armor: { melee: 1 } },
  armor_mail_ceramic: { armor: { melee: 2 } },
  armor_mail_copper: { armor: { melee: 2, pierce: 1 } },
  armor_mail_bronze: { armor: { melee: 3, pierce: 1 } },
  armor_mail_iron: { armor: { melee: 4, pierce: 2 } },
  armor_legion_ceramic: { armor: { melee: 2, pierce: 1 } },
  armor_legion_copper: { armor: { melee: 3, pierce: 1 } },
  armor_legion_bronze: { armor: { melee: 4, pierce: 2 } },
  armor_legion_iron: { armor: { melee: 5, pierce: 3 } },
  helmet_pointed_ceramic: { armor: { melee: 1 } },
  helmet_pointed_copper: { armor: { melee: 1, pierce: 1 } },
  helmet_pointed_bronze: { armor: { melee: 2, pierce: 1 } },
  helmet_pointed_iron: { armor: { melee: 2, pierce: 2 } },
  helmet_barbuta_ceramic: { armor: { melee: 1, pierce: 1 } },
  helmet_barbuta_copper: { armor: { melee: 2, pierce: 1 } },
  helmet_barbuta_bronze: { armor: { melee: 2, pierce: 2 } },
  helmet_barbuta_iron: { armor: { melee: 3, pierce: 2 } },
  shoulder_legion_ceramic: { armor: { melee: 1 } },
  shoulder_legion_copper: { armor: { melee: 1 } },
  shoulder_legion_bronze: { armor: { melee: 2, pierce: 1 } },
  shoulder_legion_iron: { armor: { melee: 2, pierce: 2 } },
  bracers_ceramic: { armor: { melee: 1 } },
  bracers_copper: { armor: { melee: 1, pierce: 1 } },
  bracers_bronze: { armor: { melee: 2, pierce: 1 } },
  bracers_iron: { armor: { melee: 2, pierce: 2 } },
  leg_armor_ceramic: { armor: { melee: 1 } },
  leg_armor_copper: { armor: { melee: 1, pierce: 1 } },
  leg_armor_bronze: { armor: { melee: 2, pierce: 1 } },
  leg_armor_iron: { armor: { melee: 2, pierce: 2 } },
  longsword: { weapon: { power: 11 } },
  round_shield_ceramic_slash: { armor: { melee: 1, pierce: 1 } },
  round_shield_copper_slash: { armor: { melee: 2, pierce: 1 } },
  round_shield_bronze_slash: { armor: { melee: 2, pierce: 2 } },
  round_shield_iron_slash: { armor: { melee: 3, pierce: 2 } },
  cane: { weapon: { power: 1 } },
  boar_tusks: { weapon: { power: 3 } },
  wolf_bite: { weapon: { power: 4 } },
  watch_tower_arrow: { weapon: { power: 3 } },
  stone_thrower_stone: { weapon: { power: 50 } },
  catapult_stone: { weapon: { power: 50 } },
  ballista_bolt: { weapon: { power: 40 } },
}

function loadedEquipmentStats(): Record<string, EquipmentStats> {
  return (
    (Assets.cache.get('config') as { equipment?: Record<string, EquipmentStats> } | undefined)?.equipment ||
    (Assets.cache.get('equipmentData') as Record<string, EquipmentStats> | undefined) ||
    FALLBACK_EQUIPMENT_STATS
  )
}

function emptyStats(): EquipmentCombatStats {
  return { weaponPower: 0, meleeArmor: 0, pierceArmor: 0 }
}

function getWeaponRangeFromEquipment(
  equipment: readonly string[] = [],
  definitions: Record<string, EquipmentStats> = loadedEquipmentStats()
): number | undefined {
  let bestRange = 0
  for (const key of equipment) {
    const itemRange = definitions[key]?.weapon?.range
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
    const item = definitions[key]
    if (!item) continue
    stats.weaponPower += item.weapon?.power ?? 0
    stats.meleeArmor += item.armor?.melee ?? item.meleeArmor ?? 0
    stats.pierceArmor += item.armor?.pierce ?? item.pierceArmor ?? 0
  }
  return stats
}

export function getUnitEquipment(unitType: string, config?: Pick<UnitConfig, 'equipment'>, age = 0, level = 0): string[] {
  return config?.equipment ? [...config.equipment] : dynamicEquipmentForUnit(unitType, age, level)
}

export function getUnitWorkEquipment(work: string | null | undefined, age = 0): string[] {
  return dynamicEquipmentForWork(work, age)
}

export function getUnitEffectiveCombatStats(
  unitType: string,
  config: Pick<UnitConfig, 'category' | 'equipment' | CombatStatKey>,
  work?: string | null,
  age = 0,
  level = 0
): EquipmentCombatStats {
  const workEquipment = work ? getUnitWorkEquipment(work, age) : []
  const equipment = workEquipment.length ? workEquipment : getUnitEquipment(unitType, config, age, level)
  if (equipment.length) return getEquipmentCombatStats(equipment)

  return {
    weaponPower: UNARMED_UNIT_WEAPON_POWER,
    meleeArmor: config.meleeArmor ?? 0,
    pierceArmor: config.pierceArmor ?? 0,
  }
}

export function applyEquipmentStatsToUnitConfig(unitType: string, config: UnitConfig): void {
  const equipment = Array.isArray(config.equipment) ? [...config.equipment] : []
  if (!equipment.length) return

  const stats = getEquipmentCombatStats(equipment)
  config.equipment = equipment
  for (const stat of COMBAT_STAT_KEYS) {
    config[stat] = stats[stat]
  }
}

export function isUnitMeleeWeaponEquipped(unit: UnitEntity): boolean {
  if (unit.projectile || unit.type === UNIT_TYPES.villager) return false
  const config = unit.owner?.config.units[unit.type]
  const equipment = getUnitEquipment(unit.type, config, unit.owner?.age, getUnitEquipmentLevel(unit, config?.category))
  return equipment.some(key => MELEE_WEAPON_EQUIPMENT_KEYS.has(key))
}

export function refreshUnitEquipmentStats(unit: UnitEntity): void {
  const config = unit.owner?.config.units[unit.type]
  if (!config) return
  const useWorkEquipment = unit.type === UNIT_TYPES.villager && Boolean(unit.work)
  const stats = getUnitEffectiveCombatStats(
    unit.type,
    config,
    useWorkEquipment ? unit.work : undefined,
    unit.owner?.age,
    getUnitEquipmentLevel(unit, config.category)
  )
  for (const stat of COMBAT_STAT_KEYS) {
    unit[stat] = stats[stat]
  }
}

export function getUnitCombatRange(unit: UnitEntity): number | undefined {
  const age = unit.owner?.age ?? 0
  const config = unit.owner?.config.units[unit.type]

  const explicitEquipment = Array.isArray(unit.equipment) && unit.equipment.length ? unit.equipment : []
  const explicitRange = getWeaponRangeFromEquipment(explicitEquipment)
  if (explicitRange != null) return explicitRange

  if (unit.work) {
    const workEquipment = getUnitWorkEquipment(unit.work, age)
    const workRange = getWeaponRangeFromEquipment(workEquipment)
    if (workRange != null) return workRange
  }

  const level = getUnitEquipmentLevel(unit, config?.category)
  const unitEquipment = getUnitEquipment(unit.type, config, age, level)
  return getWeaponRangeFromEquipment(unitEquipment)
}

function getConfiguredEntityEquipment(entity: EquipmentEntityLike): string[] {
  if (entity.type === UNIT_TYPES.villager && entity.work) return getUnitWorkEquipment(entity.work, entity.owner?.age)
  if (Array.isArray(entity.equipment)) return [...entity.equipment]

  const config =
    entity.family === FAMILY_TYPES.building
      ? entity.owner?.config.buildings?.[entity.type ?? '']
      : entity.family === FAMILY_TYPES.animal
        ? entity.owner?.config.animals?.[entity.type ?? '']
        : entity.owner?.config.units?.[entity.type ?? '']

  const configuredEquipment = config?.equipment
  if (Array.isArray(configuredEquipment) && configuredEquipment.every(item => typeof item === 'string')) {
    return [...(configuredEquipment as string[])]
  }
  return entity.type
    ? dynamicEquipmentForUnit(entity.type, entity.owner?.age, getUnitEquipmentLevel(entity as UnitEntity, config?.category))
    : []
}

export function getEntityWeaponPower(entity?: EquipmentEntityLike | null): number {
  if (!entity) return 0
  const weaponPower = getEquipmentCombatStats(getConfiguredEntityEquipment(entity), entity.owner?.config.equipment).weaponPower
  return weaponPower > 0 ? weaponPower : entity.family === FAMILY_TYPES.unit ? UNARMED_UNIT_WEAPON_POWER : 0
}
