import { BUILDING_TYPES, VILLAGER_ARRIVAL_CONFIG } from '../constants'
import type { ResourceAmount } from '../types/common'

export function villageConstructionReserve(
  needs: Record<string, boolean>,
  costFor: (type: string) => ResourceAmount,
  missingBarracks = 1
): ResourceAmount {
  const result: ResourceAmount = {}
  for (const type of [
    BUILDING_TYPES.house,
    BUILDING_TYPES.storagePit,
    BUILDING_TYPES.granary,
    BUILDING_TYPES.barracks,
    BUILDING_TYPES.market,
  ]) {
    if (!needs[type]) continue
    const count = type === BUILDING_TYPES.barracks ? missingBarracks : 1
    for (const [resource, value] of Object.entries(costFor(type))) {
      const key = resource as keyof ResourceAmount
      result[key] = (result[key] ?? 0) + value * count
    }
  }
  return result
}

export function expectedVillageArrivals(population: number): number {
  return population > 0
    ? Math.min(
        VILLAGER_ARRIVAL_CONFIG.maxArrivalsPerDay,
        Math.max(1, Math.floor(population * VILLAGER_ARRIVAL_CONFIG.growthRate))
      )
    : 0
}

export function villageBuildingNeeds(input: {
  population: number
  populationMax: number
  age: number
  phase: string
  desiredBarracks: number
  buildings: readonly { type: string; isBuilt?: boolean; isDead?: boolean; isDestroyed?: boolean }[]
}): Record<string, boolean> {
  const buildings = input.buildings.filter(b => !b.isDead && !b.isDestroyed)
  const count = (type: string) => buildings.filter(b => b.type === type).length
  return {
    [BUILDING_TYPES.house]:
      input.population + expectedVillageArrivals(input.population) + 2 > input.populationMax &&
      !buildings.some(b => b.type === BUILDING_TYPES.house && !b.isBuilt),
    [BUILDING_TYPES.storagePit]: count(BUILDING_TYPES.storagePit) === 0,
    [BUILDING_TYPES.granary]: count(BUILDING_TYPES.granary) === 0,
    [BUILDING_TYPES.barracks]: input.phase !== 'economy' && count(BUILDING_TYPES.barracks) < input.desiredBarracks,
    [BUILDING_TYPES.market]:
      count(BUILDING_TYPES.storagePit) > 0 && count(BUILDING_TYPES.granary) > 0 && count(BUILDING_TYPES.market) === 0,
    [BUILDING_TYPES.archeryRange]: count(BUILDING_TYPES.barracks) > 0,
    [BUILDING_TYPES.stable]: count(BUILDING_TYPES.barracks) > 0,
    [BUILDING_TYPES.watchTower]: input.age >= 1,
  }
}

export function villagePhase(current: string, workers: number, militaryThreshold: number): string {
  if (current === 'economy' && workers >= militaryThreshold) return 'military_build'
  if (current === 'military_build' && workers < Math.floor(militaryThreshold * 0.6)) return 'economy'
  return current === 'attack' ? 'military_build' : current
}
