import { UNIT_TYPES } from '../constants'

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

export function getBestUnitFromTechs(technologies, upgrades, fallback) {
  const found = upgrades.find(([tech]) => technologies.includes(tech))
  return found ? found[1] : fallback
}

export function isAliveUnit(unit) {
  return unit.hitPoints > 0
}

export function isInfantryUnit(unit) {
  return isAliveUnit(unit) && INFANTRY_UNIT_TYPES.includes(unit.type)
}

export function isArcherUnit(unit) {
  return isAliveUnit(unit) && ARCHER_UNIT_TYPES.includes(unit.type)
}

export function isCavalryUnit(unit) {
  return isAliveUnit(unit) && unit.type === UNIT_TYPES.scout
}

export function isHopliteUnit(unit) {
  return isAliveUnit(unit) && unit.type === 'Hoplite'
}

export function classifyMilitaryUnits(units) {
  return {
    infantry: units.filter(isInfantryUnit),
    archers: units.filter(isArcherUnit),
    cavalry: units.filter(isCavalryUnit),
    hoplites: units.filter(isHopliteUnit),
  }
}
