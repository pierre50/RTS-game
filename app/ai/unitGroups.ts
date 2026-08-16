import type { AIEntityLike } from './types'

export const ARCHER_TECH_UPGRADES: string[][] = []

const INFANTRY_UNIT_TYPES = ['Fantassin']
const ARCHER_UNIT_TYPES = ['Bowman']

export function getBestUnitFromTechs(technologies: string[], upgrades: string[][], fallback: string): string {
  const found = upgrades.find(([tech]) => technologies.includes(tech))
  return found ? found[1] : fallback
}

export function isAliveUnit(unit: Pick<AIEntityLike, 'hitPoints'>): boolean {
  return (unit.hitPoints ?? 0) > 0
}

function isInfantryUnit(unit: AIEntityLike): boolean {
  return isAliveUnit(unit) && INFANTRY_UNIT_TYPES.includes(unit.type)
}

function isArcherUnit(unit: AIEntityLike): boolean {
  return isAliveUnit(unit) && ARCHER_UNIT_TYPES.includes(unit.type)
}

function isCavalryUnit(_unit: AIEntityLike): boolean {
  return false
}

export function classifyMilitaryUnits<TUnit extends AIEntityLike>(units: TUnit[]) {
  return {
    infantry: units.filter(isInfantryUnit),
    archers: units.filter(isArcherUnit),
    cavalry: units.filter(isCavalryUnit),
  }
}
