import { isBanditUnit } from '../../lib/combat/bandits'
import { isSoldierUnit } from '../../lib/units/village/villagerSchedule'
import { FAMILY_TYPES, UNIT_TYPES } from '../../constants'
import type { EntityLightSourceConfig, RuntimeEntity, UnitEntity } from '../../types/entities'

export function isLampCarryingUnit(unit: RuntimeEntity): unit is UnitEntity {
  if (unit.family !== FAMILY_TYPES.unit) return false
  const carriesLamp = (unit.type === UNIT_TYPES.villager && unit.owner?.isPlayed === true) || isSoldierUnit(unit)
  return carriesLamp && !isBanditUnit(unit as UnitEntity)
}

export function shouldUseUnitLight(unit: RuntimeEntity): boolean {
  if (!isLampCarryingUnit(unit)) return false
  if (isSleepingUnitLightSuppressed(unit)) return false
  return !(unit.shelterState?.status === 'outside' && unit.shelterState.reason === 'sleep')
}

export function shouldFadeMissingUnitLight(unit: UnitEntity): boolean {
  return unit.shelterState?.location !== 'shelter'
}

export function isSleepingUnitLightSuppressed(instance: RuntimeEntity): boolean {
  return Boolean(instance.family === FAMILY_TYPES.unit && (instance as UnitEntity).sleepVisualState === 'sleeping')
}

const DEFAULT_ENTITY_LIGHT_COLOR = '255,172,76'

export function normalizeLightColor(color?: string): string {
  if (!color) return DEFAULT_ENTITY_LIGHT_COLOR
  const hex = color.trim().match(/^#?([0-9a-f]{6})$/i)
  if (!hex) return color
  const value = Number.parseInt(hex[1], 16)
  return `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}`
}

export function isLightSourceConfig(value: unknown): value is EntityLightSourceConfig {
  return Boolean(value && typeof value === 'object')
}
