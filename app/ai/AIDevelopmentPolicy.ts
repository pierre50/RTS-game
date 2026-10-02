import { BUILDING_TYPES, VILLAGER_ARRIVAL_CONFIG } from '../constants'

function expectedVillageArrivals(population: number): number {
  return population > 0
    ? Math.min(
        VILLAGER_ARRIVAL_CONFIG.maxArrivalsPerDay,
        Math.max(1, Math.floor(population * VILLAGER_ARRIVAL_CONFIG.growthRate))
      )
    : 0
}

export function villageBuildingNeeds(input: {
  storagePitNeeded: boolean
  population: number
  populationMax: number
  residentHouseholds?: number
  phase: string
  desiredBarracks: number
  buildings: readonly { type: string; isBuilt?: boolean; isDead?: boolean; isDestroyed?: boolean }[]
}): Record<string, boolean> {
  const buildings = input.buildings.filter(b => !b.isDead && !b.isDestroyed)
  const count = (type: string) => buildings.filter(b => b.type === type).length
  return {
    [BUILDING_TYPES.storagePit]: input.storagePitNeeded === true,
    [BUILDING_TYPES.granary]: count(BUILDING_TYPES.granary) === 0,
    [BUILDING_TYPES.barracks]: input.phase !== 'economy' && count(BUILDING_TYPES.barracks) < input.desiredBarracks,
    // Storage pits are optional logistics projects, not a prerequisite for village development.
    [BUILDING_TYPES.market]: count(BUILDING_TYPES.granary) > 0 && count(BUILDING_TYPES.market) === 0,
    [BUILDING_TYPES.house]:
      count(BUILDING_TYPES.house) <
        (input.residentHouseholds ?? Math.ceil(input.population / 2)) + expectedVillageArrivals(input.population) + 1 &&
      !buildings.some(b => b.type === BUILDING_TYPES.house && !b.isBuilt),
    [BUILDING_TYPES.archeryRange]: count(BUILDING_TYPES.barracks) > 0,
    [BUILDING_TYPES.stable]: count(BUILDING_TYPES.barracks) > 0,
    [BUILDING_TYPES.watchTower]: true,
    [BUILDING_TYPES.temple]: count(BUILDING_TYPES.temple) === 0,
    // A single decorative forge is a late village project, never an economic prerequisite.
    [BUILDING_TYPES.forge]:
      count(BUILDING_TYPES.forge) === 0 &&
      !input.storagePitNeeded &&
      input.population + expectedVillageArrivals(input.population) + 2 <= input.populationMax &&
      !buildings.some(building => !building.isBuilt) &&
      [BUILDING_TYPES.granary, BUILDING_TYPES.market, BUILDING_TYPES.barracks].every(type => count(type) > 0),
  }
}

export function villagePhase(current: string, workers: number, militaryThreshold: number): string {
  if (current === 'economy' && workers >= militaryThreshold) return 'military_build'
  if (current === 'military_build' && workers < Math.floor(militaryThreshold * 0.6)) return 'economy'
  return current === 'attack' ? 'military_build' : current
}
