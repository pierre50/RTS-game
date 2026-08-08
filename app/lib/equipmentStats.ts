import { Assets } from 'pixi.js'
import { FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { dynamicEquipmentForUnit, dynamicEquipmentForWork } from './lpc/equipment'
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
  family?: string
  owner?: Pick<PlayerLike, 'config'> | null
  type?: string
  work?: string | null
}

// Real weapons that can parry an incoming blow. 'axe' is the Axeman's actual weapon
// (see UNIT_EQUIPMENT in lpc/equipment.ts) as well as a villager work tool — villagers
// are excluded by type below rather than by dropping 'axe' from this set, so the Axeman
// still qualifies.
const MELEE_WEAPON_EQUIPMENT_KEYS = new Set(['axe', 'dagger', 'broadsword', 'longsword', 'halberd', 'cane'])

const FALLBACK_EQUIPMENT_STATS: Record<string, EquipmentStats> = {
  axe: { weapon: { power: 5 } },
  pickaxe: { weapon: { power: 2 } },
  hammer: { weapon: { power: 2 } },
  scythe: { weapon: { power: 3 } },
  bow: { weapon: { power: 4 } },
  bow_great: { weapon: { power: 6 } },
  bow_recurve: { weapon: { power: 8 } },
  halberd: { weapon: { power: 17 } },
  dagger: { weapon: { power: 7 } },
  broadsword: { weapon: { power: 9 } },
  longsword: { weapon: { power: 11 } },
  round_shield_brass_slash: { meleeArmor: 1 },
  round_shield_silver_slash: { meleeArmor: 2 },
  cane: { weapon: { power: 1 } },
  boar_tusks: { weapon: { power: 3 } },
  wolf_bite: { weapon: { power: 4 } },
  watch_tower_arrow: { weapon: { power: 3 } },
  sentry_tower_arrow: { weapon: { power: 4 } },
  guard_tower_arrow: { weapon: { power: 6 } },
  ballista_tower_bolt: { weapon: { power: 20 } },
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

export function getEquipmentCombatStats(
  equipment: readonly string[] = [],
  definitions: Record<string, EquipmentStats> = loadedEquipmentStats()
): EquipmentCombatStats {
  const stats = emptyStats()
  for (const key of equipment) {
    const item = definitions[key]
    if (!item) continue
    stats.weaponPower += item.weapon?.power ?? 0
    for (const stat of COMBAT_STAT_KEYS) {
      stats[stat] += item[stat] ?? 0
    }
  }
  return stats
}

export function getUnitEquipment(unitType: string, config?: Pick<UnitConfig, 'equipment'>): string[] {
  return config?.equipment ? [...config.equipment] : dynamicEquipmentForUnit(unitType)
}

export function getUnitWorkEquipment(work: string | null | undefined): string[] {
  return dynamicEquipmentForWork(work)
}

export function getUnitEffectiveCombatStats(
  unitType: string,
  config: Pick<UnitConfig, 'equipment' | CombatStatKey>,
  work?: string | null
): EquipmentCombatStats {
  const equipment = work ? getUnitWorkEquipment(work) : getUnitEquipment(unitType, config)
  if (equipment.length) return getEquipmentCombatStats(equipment)

  return {
    weaponPower: UNARMED_UNIT_WEAPON_POWER,
    meleeArmor: config.meleeArmor ?? 0,
    pierceArmor: config.pierceArmor ?? 0,
  }
}

export function applyEquipmentStatsToUnitConfig(unitType: string, config: UnitConfig): void {
  const equipment = getUnitEquipment(unitType, config)
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
  const equipment = getUnitEquipment(unit.type, config)
  return equipment.some(key => MELEE_WEAPON_EQUIPMENT_KEYS.has(key))
}

export function refreshUnitEquipmentStats(unit: UnitEntity): void {
  const config = unit.owner?.config.units[unit.type]
  if (!config) return
  const useWorkEquipment = unit.type === UNIT_TYPES.villager && Boolean(unit.work)
  const stats = getUnitEffectiveCombatStats(unit.type, config, useWorkEquipment ? unit.work : undefined)
  for (const stat of COMBAT_STAT_KEYS) {
    unit[stat] = stats[stat]
  }
}

function getConfiguredEntityEquipment(entity: EquipmentEntityLike): string[] {
  if (entity.type === UNIT_TYPES.villager && entity.work) return getUnitWorkEquipment(entity.work)
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
  return entity.type ? dynamicEquipmentForUnit(entity.type) : []
}

export function getEntityWeaponPower(entity?: EquipmentEntityLike | null): number {
  if (!entity) return 0
  const weaponPower = getEquipmentCombatStats(getConfiguredEntityEquipment(entity), entity.owner?.config.equipment).weaponPower
  return weaponPower > 0 ? weaponPower : entity.family === FAMILY_TYPES.unit ? UNARMED_UNIT_WEAPON_POWER : 0
}
