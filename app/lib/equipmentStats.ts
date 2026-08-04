import { Assets } from 'pixi.js'
import { UNIT_TYPES } from '../constants'
import { dynamicEquipmentForUnit, dynamicEquipmentForWork } from './lpc/equipment'
import type { EquipmentStats, UnitConfig } from '../types/config'
import type { UnitEntity } from '../types/entities'

const COMBAT_STAT_KEYS = ['meleeAttack', 'pierceAttack', 'meleeArmor', 'pierceArmor'] as const
type CombatStatKey = (typeof COMBAT_STAT_KEYS)[number]

// Real weapons that can parry an incoming blow. 'axe' is the Axeman's actual weapon
// (see UNIT_EQUIPMENT in lpc/equipment.ts) as well as a villager work tool — villagers
// are excluded by type below rather than by dropping 'axe' from this set, so the Axeman
// still qualifies.
const MELEE_WEAPON_EQUIPMENT_KEYS = new Set(['axe', 'dagger', 'broadsword', 'longsword', 'halberd', 'cane'])

const FALLBACK_EQUIPMENT_STATS: Record<string, EquipmentStats> = {
  axe: { meleeAttack: 5 },
  pickaxe: { meleeAttack: 2 },
  hammer: { meleeAttack: 2 },
  scythe: { meleeAttack: 3 },
  bow: { pierceAttack: 4 },
  bow_great: { pierceAttack: 6 },
  bow_recurve: { pierceAttack: 8 },
  halberd: { meleeAttack: 17 },
  dagger: { meleeAttack: 7 },
  broadsword: { meleeAttack: 9 },
  longsword: { meleeAttack: 11 },
  round_shield_brass_slash: { meleeArmor: 1 },
  round_shield_silver_slash: { meleeArmor: 2 },
  cane: { meleeAttack: 1 },
}

function loadedEquipmentStats(): Record<string, EquipmentStats> {
  return (
    (Assets.cache.get('config') as { equipment?: Record<string, EquipmentStats> } | undefined)?.equipment ||
    (Assets.cache.get('equipmentData') as Record<string, EquipmentStats> | undefined) ||
    FALLBACK_EQUIPMENT_STATS
  )
}

function emptyStats(): Required<EquipmentStats> {
  return { meleeAttack: 0, pierceAttack: 0, meleeArmor: 0, pierceArmor: 0 }
}

export function getEquipmentCombatStats(equipment: readonly string[] = []): Required<EquipmentStats> {
  const definitions = loadedEquipmentStats()
  const stats = emptyStats()
  for (const key of equipment) {
    const item = definitions[key]
    if (!item) continue
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
): Required<EquipmentStats> {
  const equipment = work ? getUnitWorkEquipment(work) : getUnitEquipment(unitType, config)
  if (equipment.length) return getEquipmentCombatStats(equipment)

  return {
    meleeAttack: config.meleeAttack ?? 0,
    pierceAttack: config.pierceAttack ?? 0,
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
