import { UNIT_TYPES, WORK_TYPES } from '../constants'
import type {
  AIBuildingLike,
  AIEntityLike,
  AIFoodSources,
  AIFoodSourceType,
  AIFoodWorkerCounts,
  AIStrategyPlayerLike,
} from './types'

type FoodOpportunity = {
  type: AIFoodSourceType
  score: number
}

const FOOD_WORK_BY_TYPE: Record<AIFoodSourceType, string> = {
  berry: WORK_TYPES.forager,
  carcass: WORK_TYPES.hunter,
  farm: WORK_TYPES.farmer,
  hunt: WORK_TYPES.hunter,
}

const FALLBACK_GATHER_RATES: Record<AIFoodSourceType, number> = {
  berry: 0.45,
  carcass: 0.4725,
  farm: 0.45,
  hunt: 0.4725,
}

function manhattanDistance(a: Pick<AIEntityLike, 'i' | 'j'>, b: Pick<AIEntityLike, 'i' | 'j'>): number {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j)
}

export function getNearestDropDistance(source: AIEntityLike, dropSites: AIBuildingLike[]): number {
  if (!source || !dropSites.length) return 0
  return Math.min(...dropSites.map(site => manhattanDistance(source, site)))
}

export function getNearestWorkerDistance(source: AIEntityLike, workers: AIEntityLike[] = []): number {
  if (!source || !workers.length) return 0
  return Math.min(...workers.map(worker => manhattanDistance(source, worker)))
}

export function getFoodSourceScore(
  ai: AIStrategyPlayerLike,
  type: AIFoodSourceType,
  source: AIEntityLike,
  dropSites: AIBuildingLike[],
  slot: number = 0,
  hunterCount: number = 1,
  workerPositions: AIEntityLike[] = []
): number {
  const rates = (ai.config?.units?.[UNIT_TYPES.villager]?.gatheringRate || {}) as Record<string, number | undefined>
  const rate = Number(rates[FOOD_WORK_BY_TYPE[type]] || FALLBACK_GATHER_RATES[type])
  const quantity = Math.max(0, source.quantity ?? source.totalQuantity ?? 0)
  const quantityFactor = 0.55 + Math.min(quantity / 150, 1) * 0.45
  const distance = getNearestDropDistance(source, dropSites)
  const workerDistance = getNearestWorkerDistance(source, workerPositions)
  const travelPenalty = 1 + distance / (type === 'farm' ? 20 : 14)
  const workerTravelPenalty = 1 + workerDistance / (type === 'hunt' ? 12 : 18)
  const saturationPenalty = 1 + slot * (type === 'berry' || type === 'carcass' ? 0.25 : 0.12)
  const killPenalty = type === 'hunt' ? 1 + (source.hitPoints || 0) / Math.max(4 * hunterCount, 1) / 12 : 1
  const renewableBonus = type === 'farm' ? 1.08 : 1
  return (rate * quantityFactor * renewableBonus) / (travelPenalty * workerTravelPenalty * saturationPenalty * killPenalty)
}

export function getFoodWorkerTargets(
  ai: AIStrategyPlayerLike,
  maxWorkers: number,
  sources: AIFoodSources,
  currentCounts: AIFoodWorkerCounts
): AIFoodWorkerCounts {
  const opportunities: FoodOpportunity[] = []
  const retainedSlots: AIFoodWorkerCounts = { ...currentCounts }
  const addSlots = (
    type: AIFoodSourceType,
    source: AIEntityLike,
    count: number,
    dropSites: AIBuildingLike[],
    hunterCount: number = 1
  ) => {
    for (let slot = 0; slot < count; slot++) {
      const retentionBonus = retainedSlots[type] > 0 && type !== 'hunt' ? 1.08 : 1
      retainedSlots[type] = Math.max(0, (retainedSlots[type] || 0) - 1)
      opportunities.push({
        type,
        score: getFoodSourceScore(ai, type, source, dropSites, slot, hunterCount, sources.workerPositions) * retentionBonus,
      })
    }
  }

  for (const carcass of sources.carcasses) {
    addSlots('carcass', carcass, Math.min(3, Math.max(1, Math.ceil((carcass.quantity || 0) / 75))), sources.meatDrops)
  }
  for (const bush of sources.berries) addSlots('berry', bush, 2, sources.plantDrops)
  for (const farm of sources.farms) addSlots('farm', farm, 1, sources.plantDrops)
  for (const animal of sources.animals) {
    const hunters =
      (animal.totalHitPoints || 0) >= 20 ? Math.min(4, Math.max(1, Math.ceil((animal.hitPoints || 0) / 4))) : 1
    addSlots('hunt', animal, hunters, sources.meatDrops, hunters)
  }

  opportunities.sort((a, b) => b.score - a.score)
  const targets: AIFoodWorkerCounts = { berry: 0, carcass: 0, farm: 0, hunt: 0 }
  for (const opportunity of opportunities.slice(0, maxWorkers)) targets[opportunity.type]++
  return targets
}
