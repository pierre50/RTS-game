import { BUILDING_TYPES } from '../constants'
import type { AnimalEntity, BuildingEntity, UnitEntity } from '../types/entities'

export const STABLE_HORSE_CAPACITY = 5

export type StableHorse = {
  horseColor?: string
}

type StableHorseBuilding = BuildingEntity & {
  horseAmount?: number
  stableHorses?: StableHorse[]
}

function isStable(building: BuildingEntity): building is StableHorseBuilding {
  return building.type === BUILDING_TYPES.stable
}

export function getStableHorses(building: BuildingEntity): StableHorse[] {
  if (!isStable(building)) return []
  const fallbackAmount = Math.max(0, Math.min(STABLE_HORSE_CAPACITY, Number(building.horseAmount) || 0))
  const horses = Array.isArray(building.stableHorses)
    ? building.stableHorses
    : Array.from({ length: fallbackAmount }, () => ({}))
  building.stableHorses = horses.slice(0, STABLE_HORSE_CAPACITY)
  building.horseAmount = building.stableHorses.length
  return building.stableHorses
}

export function getStableHorseAmount(building: BuildingEntity): number {
  return getStableHorses(building).length
}

export function canStoreStableHorse(building: BuildingEntity): boolean {
  return isStable(building) && getStableHorseAmount(building) < STABLE_HORSE_CAPACITY
}

export function storeStableHorse(building: BuildingEntity, horse: Pick<AnimalEntity, 'horseColor'>): boolean {
  if (!canStoreStableHorse(building)) return false
  const horses = getStableHorses(building)
  horses.push({ horseColor: horse.horseColor })
  building.horseAmount = horses.length
  return true
}

export function consumeStableHorse(building: BuildingEntity): StableHorse | null {
  if (!isStable(building)) return null
  const horses = getStableHorses(building)
  const horse = horses.shift() ?? null
  building.horseAmount = horses.length
  return horse
}

export function returnStableHorse(building: BuildingEntity, horse: StableHorse | null | undefined): void {
  if (!horse || !isStable(building)) return
  getStableHorses(building).unshift(horse)
  building.stableHorses = getStableHorses(building).slice(0, STABLE_HORSE_CAPACITY)
  building.horseAmount = building.stableHorses.length
}

export function heroHasLinkedHorse(hero: Pick<UnitEntity, 'companionHorseColor' | 'mountedOnHorse'> | null | undefined): boolean {
  return Boolean(hero?.mountedOnHorse || hero?.companionHorseColor)
}

export function assignStableHorseToHero(building: BuildingEntity, hero: UnitEntity | null | undefined): StableHorse | null {
  if (!hero || heroHasLinkedHorse(hero)) return null
  const horse = consumeStableHorse(building)
  if (!horse) return null
  hero.companionHorseColor = horse.horseColor ?? 'brown'
  hero.horseColor = hero.companionHorseColor
  return horse
}
