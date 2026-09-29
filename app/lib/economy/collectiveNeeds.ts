import { DAILY_CONSUMPTION_PER_VILLAGER, VILLAGER_ARRIVAL_CONFIG } from '../../constants'
import type { ResourceAmount } from '../../types/common'

// Stock goals, not workforce percentages. One claim represents a small useful delivery.
export const COLLECTIVE_WORK_POLICY = { foodReserveDays: 2, deliveryBatch: 30 } as const
const COLLECTIVE_RESOURCES = [
  'food',
  'wheat',
  'berry',
  'meat',
  'wood',
  'stone',
  'fiber',
  'leather',
  'gold',
  'copper',
  'iron',
  'sinew',
  'feather',
  'herb',
  'toxicHerb',
] as const

export function collectiveNeeds(population: number, projects: ResourceAmount, available: ResourceAmount) {
  const dailyFood = Math.max(0, population) * (DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0)
  const goals: ResourceAmount = {
    ...projects,
    food: Math.max(projects.food ?? 0, dailyFood * COLLECTIVE_WORK_POLICY.foodReserveDays),
  }
  return COLLECTIVE_RESOURCES.map(resource => ({
    resource,
    goal: Math.max(0, goals[resource] ?? 0),
    missing: Math.max(0, (goals[resource] ?? 0) - (available[resource] ?? 0)),
  }))
}

/** Shared sequential claims prevent every worker from claiming the whole village deficit. */
export function collectiveWorkerClaims(
  population: number,
  projects: ResourceAmount,
  available: ResourceAmount,
  workers: number
) {
  const claims: ResourceAmount = {}
  let remaining = Math.max(0, Math.floor(workers))
  for (const need of collectiveNeeds(population, projects, available)) {
    const count = Math.min(remaining, Math.ceil(need.missing / COLLECTIVE_WORK_POLICY.deliveryBatch))
    claims[need.resource] = count
    remaining -= count
  }
  return claims
}

// Cover the next upkeep payment as well as the reserve checked afterwards for arrivals.
export function villageFoodReserve(population: number, populationMax: number): number {
  if (population <= 0) return 0
  const arrivals = Math.min(
    VILLAGER_ARRIVAL_CONFIG.maxArrivalsPerDay,
    Math.max(1, Math.floor(population * VILLAGER_ARRIVAL_CONFIG.growthRate)),
    Math.max(0, populationMax - population)
  )
  return (
    (DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0) *
    (population * (VILLAGER_ARRIVAL_CONFIG.currentPopulationReserveDays + 1) +
      arrivals * VILLAGER_ARRIVAL_CONFIG.newVillagerReserveDays)
  )
}

/** Per-settlement stock targets. Additional depots add capacity, never multiply these goals. */
export const DEFAULT_VILLAGE_RESERVES = {
  materials: { wood: 50, stone: 30, gold: 10, copper: 5, iron: 5 },
  food: 100,
} as const
