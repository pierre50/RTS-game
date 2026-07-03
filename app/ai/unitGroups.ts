import { UNIT_TYPES } from '../constants'

type AnyRecord = Record<string, any>

export const INFANTRY_TECH_UPGRADES = [
  ['LongSword', 'LongSwordsman'],
  ['BroadSword', 'BroadSwordsman'],
  ['ShortSword', 'ShortSwordsman'],
  ['BattleAxe', 'Axeman'],
]

export const ARCHER_TECH_UPGRADES = [
  ['CompositeBow', 'CompositeBowman'],
  ['ImprovedBow', 'ImprovedBowman'],
]

export const INFANTRY_UNIT_TYPES = ['Clubman', 'Axeman', 'ShortSwordsman', 'BroadSwordsman', 'LongSwordsman']
export const ARCHER_UNIT_TYPES = ['Bowman', 'ImprovedBowman', 'CompositeBowman']

export function getBestUnitFromTechs(technologies: string[], upgrades: string[][], fallback: string): string {
  const found = upgrades.find(([tech]) => technologies.includes(tech))
  return found ? found[1] : fallback
}

export function isAliveUnit(unit: AnyRecord): boolean {
  return unit.hitPoints > 0
}

export function isInfantryUnit(unit: AnyRecord): boolean {
  return isAliveUnit(unit) && INFANTRY_UNIT_TYPES.includes(unit.type)
}

export function isArcherUnit(unit: AnyRecord): boolean {
  return isAliveUnit(unit) && ARCHER_UNIT_TYPES.includes(unit.type)
}

export function isCavalryUnit(unit: AnyRecord): boolean {
  return isAliveUnit(unit) && unit.type === UNIT_TYPES.scout
}

export function isHopliteUnit(unit: AnyRecord): boolean {
  return isAliveUnit(unit) && unit.type === 'Hoplite'
}

export function classifyMilitaryUnits(units: AnyRecord[]) {
  return {
    infantry: units.filter(isInfantryUnit),
    archers: units.filter(isArcherUnit),
    cavalry: units.filter(isCavalryUnit),
    hoplites: units.filter(isHopliteUnit),
  }
}
