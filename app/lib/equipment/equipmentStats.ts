import { getBuildingCombatProfile } from '../buildings/towerCombat'
import type { UnitConfig } from '../../types/config'
import type { UnitEntity } from '../../types/entities'
import { FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { dynamicEquipmentForUnit, dynamicEquipmentForWork } from '../lpc/equipment'
import { type MiningActor } from '../resources/miningEquipment'
import {
  getNpcActiveCombatEquipment,
  getNpcWeaponChoice,
  hasNpcWeaponInventory,
  isNpcWeaponItem,
} from '../units/combat/npcWeapons'
import { isInactiveArcherWeapon, isNpcArcher, usesArcherDagger } from '../units/combat/unitArrows'
import {
  getEnergyRegenLevelMultiplier,
  getEnergyTotalLevelMultiplier,
  getReflexAttackRecoveryMultiplier,
  getUnitEquipmentTier,
  setLevelUpRefreshHandler,
} from '../units/unitExperience'
import {
  getEquipmentCombatStats,
  getWeaponRangeFromEquipment,
  loadedEquipmentStats,
  type EquipmentCombatStats,
} from './equipmentCombatStats'
import { equipmentBaseKey, isEquipmentBroken, withEquipmentDurability } from './equipmentCondition'
import { migrateEquipmentMaterial } from './equipmentMaterials'
import type { ForgeUpgradeOwner } from './forgeUpgrades'
import {
  getHeroInventoryActiveWeaponEquipment,
  getHeroInventoryCombatEquipment,
  usesHeroInventoryEquipment,
  type EquipmentEntityLike,
} from './heroCombatEquipment'
import { rangedWeaponEquipment } from './rangedWeapon'
import { getEquippedWorkTool, toolFamilyForWork, workToolFamily } from './workTools'
export { getEquipmentCombatStats, type EquipmentCombatStats } from './equipmentCombatStats'

const COMBAT_STAT_KEYS = ['armor'] as const
type CombatStatKey = (typeof COMBAT_STAT_KEYS)[number]

export const UNARMED_UNIT_WEAPON_POWER = 0.5

export type HeroInventoryWeaponCombatStats = {
  meleeWeaponPower: number
  rangedWeaponPower: number
}

const MELEE_WEAPON_EQUIPMENT_KEYS = new Set([
  'axe_ceramic',
  'axe_bronze',
  'axe_iron',
  'sword_ceramic',
  'sword_copper',
  'sword_bronze',
  'dagger_bronze',
  'dagger_iron',
  'spear_ceramic',
  'spear_bronze',
  'spear_iron',
  'mace_bronze',
  'mace_iron',
  'sword_iron',
  'longsword',
  'cane',
  'longstick',
  'catchingPole',
])

export function hasHeroInventoryEquipment(entity: EquipmentEntityLike): boolean {
  return usesHeroInventoryEquipment(entity)
}

export function getUnitEquipment(
  unitType: string,
  config?: Pick<UnitConfig, 'equipment'>,
  owner: ForgeUpgradeOwner = {},
  level = 0,
  civilization?: string
): string[] {
  return (
    config?.equipment ? [...config.equipment] : dynamicEquipmentForUnit(unitType, owner, level, civilization)
  ).filter(item => !equipmentBaseKey(item).startsWith('cape_'))
}

export function getUnitWorkEquipment(work: string | null | undefined, unit?: MiningActor): string[] {
  const equipment = dynamicEquipmentForWork(work, unit?.owner ?? {})
  if (!unit) return equipment
  return equipment.flatMap(item => {
    if (!workToolFamily(item)) return [item]
    const tool = getEquippedWorkTool(unit)
    return tool && workToolFamily(tool) === toolFamilyForWork(work) ? [tool] : []
  })
}

function getUnitEffectiveCombatStats(
  unitType: string,
  config: Pick<UnitConfig, 'category' | 'equipment' | CombatStatKey>,
  work?: string | null,
  owner: ForgeUpgradeOwner = {},
  level = 0,
  civilization?: string
): EquipmentCombatStats {
  const workEquipment = work ? dynamicEquipmentForWork(work, owner) : []
  const equipment = workEquipment.length
    ? workEquipment
    : getUnitEquipment(unitType, config, owner, level, civilization)
  if (equipment.length)
    return getEquipmentCombatStats(equipment.filter(item => !isInactiveArcherWeapon({ type: unitType }, item)))

  return {
    weaponPower: UNARMED_UNIT_WEAPON_POWER,
    armor: config.armor ?? 0,
  }
}

function getHeroInventoryEffectiveCombatStats(
  hero: EquipmentEntityLike,
  config?: Pick<UnitConfig, 'armor'>
): EquipmentCombatStats {
  const equipmentStats = getEquipmentCombatStats(getHeroInventoryCombatEquipment(hero), hero.owner?.config.equipment)
  return {
    weaponPower: equipmentStats.weaponPower || UNARMED_UNIT_WEAPON_POWER,
    armor: (config?.armor ?? 0) + equipmentStats.armor,
  }
}

export function getHeroInventoryWeaponCombatStats(hero: EquipmentEntityLike): HeroInventoryWeaponCombatStats {
  const activeWeapons = hero.inventory?.activeWeapons ?? {}
  return {
    meleeWeaponPower: activeWeapons.melee
      ? getEquipmentCombatStats([activeWeapons.melee], hero.owner?.config.equipment).weaponPower
      : 0,
    rangedWeaponPower:
      activeWeapons.ranged && !isEquipmentBroken(activeWeapons.ranged)
        ? getEquipmentCombatStats(
            rangedWeaponEquipment(activeWeapons.ranged, hero.inventory?.equipped?.arrow),
            hero.owner?.config.equipment
          ).weaponPower
        : 0,
  }
}

export function getUnitRuntimeCombatStats(unit: UnitEntity, config: UnitConfig): EquipmentCombatStats {
  if (usesHeroInventoryEquipment(unit)) return getHeroInventoryEffectiveCombatStats(unit, config)
  if (unit.equipmentDurability || isNpcArcher(unit)) return getEquipmentCombatStats(getConfiguredEntityEquipment(unit))
  return getUnitEffectiveCombatStats(
    unit.type,
    config,
    unit.work,
    unit.owner ?? {},
    getUnitEquipmentTier(unit, config.category),
    unit.owner?.civ
  )
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
  if (hasNpcWeaponInventory(unit)) {
    const choice = getNpcWeaponChoice(unit)
    return choice.kind === 'melee' && Boolean(choice.weapon)
  }
  if ((unit.projectile && !usesArcherDagger(unit)) || unit.type === UNIT_TYPES.villager) return false
  const config = unit.owner?.config.units[unit.type]
  const equipment = getUnitEquipment(
    unit.type,
    config,
    unit.owner ?? {},
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
  if (unit.equipmentDurability && Object.keys(unit.equipmentDurability).length) {
    const stats = getEquipmentCombatStats(getConfiguredEntityEquipment(unit))
    for (const stat of COMBAT_STAT_KEYS) unit[stat] = stats[stat]
    return
  }
  const useWorkEquipment = unit.type === UNIT_TYPES.villager && Boolean(unit.work)
  const stats = getUnitEffectiveCombatStats(
    unit.type,
    config,
    useWorkEquipment ? unit.work : undefined,
    unit.owner ?? {},
    getUnitEquipmentTier(unit, config.category),
    unit.owner?.civ
  )
  for (const stat of COMBAT_STAT_KEYS) {
    unit[stat] = stats[stat]
  }
}

// Break the circular import between this module and unitExperience.ts: grantUnitXp calls this
// handler on level-up so reflex/energy/equipment-tier caches stay in sync without a level-up
// happening only at the next spawn or loot refresh.
setLevelUpRefreshHandler(refreshUnitEquipmentStats)

export function getUnitCombatRange(unit: UnitEntity, target = unit.dest): number | undefined {
  if (hasNpcWeaponInventory(unit)) return getNpcWeaponChoice(unit, target).range
  if (usesArcherDagger(unit)) return undefined
  const owner = unit.owner ?? {}
  const config = unit.owner?.config.units[unit.type]

  if (usesHeroInventoryEquipment(unit)) {
    return getWeaponRangeFromEquipment(getHeroInventoryActiveWeaponEquipment(unit), unit.owner?.config.equipment)
  }

  const explicitEquipment = Array.isArray(unit.equipment) && unit.equipment.length ? unit.equipment : []
  const explicitRange = getWeaponRangeFromEquipment(explicitEquipment)
  if (explicitRange != null) return explicitRange

  if (unit.work) {
    const workEquipment = getUnitWorkEquipment(unit.work, unit)
    const workRange = getWeaponRangeFromEquipment(workEquipment)
    if (workRange != null) return workRange
  }

  const level = getUnitEquipmentTier(unit, config?.category)
  const unitEquipment = getUnitEquipment(unit.type, config, owner, level, unit.owner?.civ)
  return getWeaponRangeFromEquipment(unitEquipment)
}

export function getConfiguredEntityEquipment(entity: EquipmentEntityLike): string[] {
  if (usesHeroInventoryEquipment(entity)) return getHeroInventoryCombatEquipment(entity)
  if (hasNpcWeaponInventory(entity)) {
    const armor = getRawEntityEquipment(entity)
      .filter(item => !isNpcWeaponItem(item, entity) && !item.startsWith('arrow_') && item !== 'quiver')
      .map(item => {
        const durability = entity.equipmentDurability?.[equipmentBaseKey(item)]
        return durability == null ? item : withEquipmentDurability(item, durability)
      })
    return [...armor, ...getNpcActiveCombatEquipment(entity)]
  }
  return getRawEntityEquipment(entity)
    .filter(item => !isInactiveArcherWeapon(entity, item))
    .map(item => {
      const durability = entity.equipmentDurability?.[equipmentBaseKey(item)]
      return durability == null ? item : withEquipmentDurability(item, durability)
    })
}

function getRawEntityEquipment(entity: EquipmentEntityLike): string[] {
  if (entity.type === UNIT_TYPES.villager && entity.work) return getUnitWorkEquipment(entity.work, entity)
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
        entity.owner ?? {},
        getUnitEquipmentTier(entity as UnitEntity, config?.category),
        entity.owner?.civ
      )
    : []
}

export function getEntityMeleeWeapon(entity: EquipmentEntityLike): string | undefined {
  const definitions = loadedEquipmentStats()
  return getConfiguredEntityEquipment(entity).find(key => {
    if (key.startsWith('arrow_')) return false
    if (isEquipmentBroken(key)) return false
    const weapon = definitions[equipmentBaseKey(migrateEquipmentMaterial(key))]?.weapon
    return Boolean(weapon && !weapon.range)
  })
}

export function getEntityWeaponPower(entity?: EquipmentEntityLike | null): number {
  if (!entity) return 0
  const tower = getBuildingCombatProfile(entity)
  if (tower) return tower.power
  const weaponPower = getEquipmentCombatStats(
    getConfiguredEntityEquipment(entity),
    entity.owner?.config.equipment
  ).weaponPower
  return weaponPower > 0 ? weaponPower : entity.family === FAMILY_TYPES.unit ? UNARMED_UNIT_WEAPON_POWER : 0
}
