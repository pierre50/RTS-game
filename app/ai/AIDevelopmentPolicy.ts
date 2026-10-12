import { calculateVillagerArrivals } from '../lib/buildings/townCenter'
import { getBuildingLevel } from '../lib/buildings/buildingLevel'
import { BUILDING_TYPES } from '../constants'

export function villageBuildingNeeds(input: {
  storagePitNeeded: boolean
  population: number
  populationMax: number
  phase: string
  desiredBarracks: number
  buildings: readonly {
    type: string
    buildingLevel?: number
    assetLevel?: unknown
    isBuilt?: boolean
    isDead?: boolean
    isDestroyed?: boolean
  }[]
}): Record<string, boolean> {
  const buildings = input.buildings.filter(b => !b.isDead && !b.isDestroyed)
  const level = Math.max(0, ...buildings.filter(b => b.type === 'TownCenter' && b.isBuilt).map(getBuildingLevel))
  const expected = calculateVillagerArrivals({
    population: input.population,
    populationMax: Infinity,
    buildingLevel: level,
  })
  const count = (type: string) => buildings.filter(b => b.type === type).length
  return {
    [BUILDING_TYPES.storagePit]: input.storagePitNeeded === true,
    [BUILDING_TYPES.granary]: count(BUILDING_TYPES.granary) === 0,
    [BUILDING_TYPES.barracks]: input.phase !== 'economy' && count(BUILDING_TYPES.barracks) < input.desiredBarracks,
    // Storage pits are optional logistics projects, not a prerequisite for village development.
    [BUILDING_TYPES.market]: count(BUILDING_TYPES.granary) > 0 && count(BUILDING_TYPES.market) === 0,
    [BUILDING_TYPES.house]:
      input.populationMax < input.population + expected + 1 &&
      !buildings.some(b => b.type === BUILDING_TYPES.house && !b.isBuilt),
    [BUILDING_TYPES.archeryRange]: count(BUILDING_TYPES.barracks) > 0,
    [BUILDING_TYPES.stable]: count(BUILDING_TYPES.barracks) > 0,
    [BUILDING_TYPES.watchTower]: true,
    [BUILDING_TYPES.temple]: count(BUILDING_TYPES.temple) === 0,
    // A single decorative forge is a late village project, never an economic prerequisite.
    [BUILDING_TYPES.forge]:
      count(BUILDING_TYPES.forge) === 0 &&
      !input.storagePitNeeded &&
      input.population + expected + 2 <= input.populationMax &&
      !buildings.some(building => !building.isBuilt) &&
      [BUILDING_TYPES.granary, BUILDING_TYPES.market, BUILDING_TYPES.barracks].every(type => count(type) > 0),
  }
}

export function villagePhase(current: string, workers: number, militaryThreshold: number): string {
  if (current === 'economy' && workers >= militaryThreshold) return 'military_build'
  if (current === 'military_build' && workers < Math.floor(militaryThreshold * 0.6)) return 'economy'
  return current === 'attack' ? 'military_build' : current
}
