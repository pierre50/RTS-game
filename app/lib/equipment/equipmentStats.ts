import { Assets } from 'pixi.js'
import { FAMILY_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { dynamicEquipmentForUnit, dynamicEquipmentForWork } from '../lpc/equipment'
import {
  getEnergyRegenLevelMultiplier,
  getEnergyTotalLevelMultiplier,
  getReflexAttackRecoveryMultiplier,
  getUnitEquipmentTier,
  setLevelUpRefreshHandler,
} from '../units/unitExperience'
import type { EquipmentStats, UnitConfig } from '../../types/config'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

const COMBAT_STAT_KEYS = ['meleeArmor', 'pierceArmor'] as const
type CombatStatKey = (typeof COMBAT_STAT_KEYS)[number]

export const UNARMED_UNIT_WEAPON_POWER = 0.5
const MAX_UNIT_EQUIPMENT_MELEE_ARMOR = 3
const MAX_UNIT_EQUIPMENT_PIERCE_ARMOR = 2

export type EquipmentCombatStats = {
  weaponPower: number
  meleeArmor: number
  pierceArmor: number
}

export type HeroInventoryWeaponCombatStats = {
  meleeWeaponPower: number
  rangedWeaponPower: number
}

type EquipmentEntityLike = {
  equipment?: string[]
  experience?: UnitEntity['experience']
  family?: string
  inventory?: UnitEntity['inventory']
  owner?: Pick<PlayerLike, 'age' | 'civ' | 'config'> | null
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
  axe_copper: { weapon: { power: 7 } },
  axe_ceramic: { weapon: { power: 5 } },
  axe_bronze: { weapon: { power: 9 } },
  axe_iron: { weapon: { power: 11 } },
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
  bow: { weapon: { power: 5, range: 4 } },
  bow_great: { weapon: { power: 7, range: 5 } },
  bow_recurve: { weapon: { power: 9, range: 6 } },
  halberd: { weapon: { power: 17 } },
  sword_copper: { weapon: { power: 8 } },
  sword_ceramic: { weapon: { power: 6 } },
  sword_bronze: { weapon: { power: 10 } },
  sword_iron: { weapon: { power: 12 } },
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
  helmet_legion_ceramic: { armor: { melee: 1, pierce: 1 } },
  helmet_legion_copper: { armor: { melee: 2, pierce: 1 } },
  helmet_legion_bronze: { armor: { melee: 2, pierce: 2 } },
  helmet_legion_iron: { armor: { melee: 3, pierce: 2 } },
  helmet_nasal_ceramic: { armor: { melee: 1, pierce: 1 } },
  helmet_nasal_copper: { armor: { melee: 2, pierce: 1 } },
  helmet_nasal_bronze: { armor: { melee: 2, pierce: 2 } },
  helmet_nasal_iron: { armor: { melee: 3, pierce: 2 } },
  helmet_bascinet_round_ceramic: { armor: { melee: 1, pierce: 1 } },
  helmet_bascinet_round_copper: { armor: { melee: 2, pierce: 1 } },
  helmet_bascinet_round_bronze: { armor: { melee: 2, pierce: 2 } },
  helmet_bascinet_round_iron: { armor: { melee: 3, pierce: 2 } },
  helmet_norman_ceramic: { armor: { melee: 1, pierce: 1 } },
  helmet_norman_copper: { armor: { melee: 2, pierce: 1 } },
  helmet_norman_bronze: { armor: { melee: 2, pierce: 2 } },
  helmet_norman_iron: { armor: { melee: 3, pierce: 2 } },
  helmet_barbarian_ceramic: { armor: { melee: 1, pierce: 1 } },
  helmet_barbarian_nasal_ceramic: { armor: { melee: 1, pierce: 1 } },
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

function capUnitEquipmentArmor(stats: EquipmentCombatStats): EquipmentCombatStats {
  return {
    ...stats,
    meleeArmor: Math.min(stats.meleeArmor, MAX_UNIT_EQUIPMENT_MELEE_ARMOR),
    pierceArmor: Math.min(stats.pierceArmor, MAX_UNIT_EQUIPMENT_PIERCE_ARMOR),
  }
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

function usesHeroInventoryEquipment(entity: EquipmentEntityLike): boolean {
  return Boolean(entity.inventory && (entity.type === UNIT_TYPES.hero || (entity as UnitEntity).controlMode === 'hero'))
}

function getHeroInventoryArmorEquipment(entity: EquipmentEntityLike): string[] {
  const { arrow, ...equippedWithoutArrow } = entity.inventory?.equipped ?? {}
  void arrow
  return Object.values(equippedWithoutArrow).filter((item): item is string => typeof item === 'string')
}

function getHeroInventoryActiveWeaponEquipment(entity: EquipmentEntityLike): string[] {
  const activeWeapons = entity.inventory?.activeWeapons ?? {}
  if (entity.work === 'heroSword') {
    return [activeWeapons.melee, activeWeapons.offhand].filter((item): item is string => typeof item === 'string')
  }
  if (entity.work === WORK_TYPES.hunter) {
    return [activeWeapons.ranged, activeWeapons.quiver, entity.inventory?.equipped?.arrow].filter(
      (item): item is string => typeof item === 'string'
    )
  }
  return [activeWeapons.lasso].filter((item): item is string => typeof item === 'string')
}

function getHeroInventoryCombatEquipment(entity: EquipmentEntityLike): string[] {
  return [...getHeroInventoryArmorEquipment(entity), ...getHeroInventoryActiveWeaponEquipment(entity)]
}

export function hasHeroInventoryEquipment(entity: EquipmentEntityLike): boolean {
  return usesHeroInventoryEquipment(entity)
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

export function getUnitEquipment(
  unitType: string,
  config?: Pick<UnitConfig, 'equipment'>,
  age = 0,
  level = 0,
  civilization?: string
): string[] {
  return config?.equipment ? [...config.equipment] : dynamicEquipmentForUnit(unitType, age, level, civilization)
}

export function getUnitWorkEquipment(work: string | null | undefined, age = 0): string[] {
  return dynamicEquipmentForWork(work, age)
}

function getUnitEffectiveCombatStats(
  unitType: string,
  config: Pick<UnitConfig, 'category' | 'equipment' | CombatStatKey>,
  work?: string | null,
  age = 0,
  level = 0,
  civilization?: string
): EquipmentCombatStats {
  const workEquipment = work ? getUnitWorkEquipment(work, age) : []
  const equipment = workEquipment.length ? workEquipment : getUnitEquipment(unitType, config, age, level, civilization)
  if (equipment.length) return capUnitEquipmentArmor(getEquipmentCombatStats(equipment))

  return {
    weaponPower: UNARMED_UNIT_WEAPON_POWER,
    meleeArmor: config.meleeArmor ?? 0,
    pierceArmor: config.pierceArmor ?? 0,
  }
}

function getHeroInventoryEffectiveCombatStats(
  hero: EquipmentEntityLike,
  config?: Pick<UnitConfig, 'meleeArmor' | 'pierceArmor'>
): EquipmentCombatStats {
  const equipmentStats = getEquipmentCombatStats(getHeroInventoryCombatEquipment(hero), hero.owner?.config.equipment)
  return {
    weaponPower: equipmentStats.weaponPower || UNARMED_UNIT_WEAPON_POWER,
    meleeArmor: (config?.meleeArmor ?? 0) + equipmentStats.meleeArmor,
    pierceArmor: (config?.pierceArmor ?? 0) + equipmentStats.pierceArmor,
  }
}

export function getHeroInventoryWeaponCombatStats(hero: EquipmentEntityLike): HeroInventoryWeaponCombatStats {
  const activeWeapons = hero.inventory?.activeWeapons ?? {}
  return {
    meleeWeaponPower: activeWeapons.melee
      ? getEquipmentCombatStats([activeWeapons.melee], hero.owner?.config.equipment).weaponPower
      : 0,
    rangedWeaponPower: activeWeapons.ranged
      ? getEquipmentCombatStats(
          [activeWeapons.ranged, hero.inventory?.equipped?.arrow].filter(
            (item): item is string => typeof item === 'string'
          ),
          hero.owner?.config.equipment
        ).weaponPower
      : 0,
  }
}

export function getUnitRuntimeCombatStats(unit: UnitEntity, config: UnitConfig): EquipmentCombatStats {
  if (usesHeroInventoryEquipment(unit)) return getHeroInventoryEffectiveCombatStats(unit, config)
  return getUnitEffectiveCombatStats(
    unit.type,
    config,
    unit.work,
    unit.owner?.age,
    getUnitEquipmentTier(unit, config.category),
    unit.owner?.civ
  )
}

export function applyEquipmentStatsToUnitConfig(unitType: string, config: UnitConfig): void {
  const equipment = Array.isArray(config.equipment) ? [...config.equipment] : []
  if (!equipment.length) return

  const stats = capUnitEquipmentArmor(getEquipmentCombatStats(equipment))
  config.equipment = equipment
  for (const stat of COMBAT_STAT_KEYS) {
    config[stat] = stats[stat]
  }
}

export function isUnitMeleeWeaponEquipped(unit: UnitEntity): boolean {
  if (unit.projectile || unit.type === UNIT_TYPES.villager) return false
  const config = unit.owner?.config.units[unit.type]
  const equipment = getUnitEquipment(
    unit.type,
    config,
    unit.owner?.age,
    getUnitEquipmentTier(unit, config?.category),
    unit.owner?.civ
  )
  return equipment.some(key => MELEE_WEAPON_EQUIPMENT_KEYS.has(key))
}

// Reflex/energy always derive from the same stable per-unit-type base (config), never from the
// unit's current (possibly already-scaled) field — recomputing from itself here would compound
// the level bonus every time this refresh runs (spawn, loot, level-up, ...).
function applyLevelDerivedUnitStats(unit: UnitEntity, config: UnitConfig): void {
  if (config.attackRecoveryMs != null) {
    unit.attackRecoveryMs = config.attackRecoveryMs * getReflexAttackRecoveryMultiplier(unit)
  }
  if (config.totalEnergy != null) {
    unit.totalEnergy = config.totalEnergy * getEnergyTotalLevelMultiplier(unit)
  }
  if (config.energyRegenRate != null) {
    unit.energyRegenRate = config.energyRegenRate * getEnergyRegenLevelMultiplier(unit)
  }
}

export function refreshUnitEquipmentStats(unit: UnitEntity): void {
  const config = unit.owner?.config.units[unit.type]
  if (!config) return
  applyLevelDerivedUnitStats(unit, config)
  if (usesHeroInventoryEquipment(unit)) {
    const stats = getHeroInventoryEffectiveCombatStats(unit, config)
    unit.weaponPower = stats.weaponPower
    for (const stat of COMBAT_STAT_KEYS) {
      unit[stat] = stats[stat]
    }
    return
  }
  const useWorkEquipment = unit.type === UNIT_TYPES.villager && Boolean(unit.work)
  const stats = getUnitEffectiveCombatStats(
    unit.type,
    config,
    useWorkEquipment ? unit.work : undefined,
    unit.owner?.age,
    getUnitEquipmentTier(unit, config.category),
    unit.owner?.civ
  )
  for (const stat of COMBAT_STAT_KEYS) {
    unit[stat] = stats[stat]
  }
}

// Break the circular import between this module and unitExperience.ts: grantUnitXp calls this
// handler on level-up so reflex/energy/equipment-tier caches stay in sync without a level-up
// happening only at the next spawn/loot/portal-travel refresh.
setLevelUpRefreshHandler(refreshUnitEquipmentStats)

export function getUnitCombatRange(unit: UnitEntity): number | undefined {
  const age = unit.owner?.age ?? 0
  const config = unit.owner?.config.units[unit.type]

  if (usesHeroInventoryEquipment(unit)) {
    return getWeaponRangeFromEquipment(getHeroInventoryActiveWeaponEquipment(unit), unit.owner?.config.equipment)
  }

  const explicitEquipment = Array.isArray(unit.equipment) && unit.equipment.length ? unit.equipment : []
  const explicitRange = getWeaponRangeFromEquipment(explicitEquipment)
  if (explicitRange != null) return explicitRange

  if (unit.work) {
    const workEquipment = getUnitWorkEquipment(unit.work, age)
    const workRange = getWeaponRangeFromEquipment(workEquipment)
    if (workRange != null) return workRange
  }

  const level = getUnitEquipmentTier(unit, config?.category)
  const unitEquipment = getUnitEquipment(unit.type, config, age, level, unit.owner?.civ)
  return getWeaponRangeFromEquipment(unitEquipment)
}

function getConfiguredEntityEquipment(entity: EquipmentEntityLike): string[] {
  if (usesHeroInventoryEquipment(entity)) return getHeroInventoryCombatEquipment(entity)
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
    ? dynamicEquipmentForUnit(
        entity.type,
        entity.owner?.age,
        getUnitEquipmentTier(entity as UnitEntity, config?.category),
        entity.owner?.civ
      )
    : []
}

export function getEntityWeaponPower(entity?: EquipmentEntityLike | null): number {
  if (!entity) return 0
  const weaponPower = getEquipmentCombatStats(
    getConfiguredEntityEquipment(entity),
    entity.owner?.config.equipment
  ).weaponPower
  return weaponPower > 0 ? weaponPower : entity.family === FAMILY_TYPES.unit ? UNARMED_UNIT_WEAPON_POWER : 0
}
