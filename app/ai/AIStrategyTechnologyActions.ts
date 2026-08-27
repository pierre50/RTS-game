import { AGE_UP_ENABLED, BUILDING_TYPES } from '../constants'
import { hasLivingChief } from '../lib/chief'
import { AGE_UP_BUFFERS, AGE_UP_COSTS } from './config'
import type { AIBuildingLike, AIResourceAmount, AIStrategyPlayerLike, AIStrategySnapshot } from './types'

type BuildingListByType = Record<string, AIBuildingLike[]>

type TechnologyStrategy = {
  ai: AIStrategyPlayerLike
  chiefTechPriority: string[]
  canResearchTech(techKey: string): boolean
  canSpendWithReserve(cost: AIResourceAmount, reserve?: AIResourceAmount): boolean
  getAgeUpReserve(): AIResourceAmount
  isTechnologyInProgress(technologyType: string, buildingList?: AIBuildingLike[]): boolean
}

const RESOURCE_NAMES = ['wood', 'food', 'gold', 'stone'] as const

function resourceEntries(cost: AIResourceAmount = {}): [keyof AIResourceAmount, number][] {
  return RESOURCE_NAMES.map(resource => [resource, cost[resource]] as [keyof AIResourceAmount, number | undefined]).filter(
    (entry): entry is [keyof AIResourceAmount, number] => typeof entry[1] === 'number'
  )
}

function buyTechnology(
  strategy: TechnologyStrategy,
  buildingList: AIBuildingLike[],
  technologyType: string,
  reserve: AIResourceAmount = {},
  debug: boolean = false
): number {
  const cost = strategy.ai.techs?.[technologyType]?.cost || {}
  if (!strategy.canSpendWithReserve(cost, reserve)) return 0
  if (strategy.ai.buyTechnology?.(technologyType)) {
    const source = buildingList.find(building => building && !building.isDead && !building.isDestroyed)
    if (debug) console.log(`Buying ${technologyType}${source ? ` after building ${source.type}` : ''}`)
    return 1
  }
  return 0
}

export function handleAITechnologyActions(
  strategy: TechnologyStrategy,
  snapshot: AIStrategySnapshot,
  debug: boolean = false
): number {
  const { ai } = strategy
  if (!hasLivingChief(ai)) return 0
  const { maxVillagers, barracks, archeryRanges, storagepits, markets, granarys } = snapshot
  let actions = 0

  const nextAgeKey = (ai.age + 1) as 1 | 2 | 3
  if (AGE_UP_ENABLED && ai.nextAge[nextAgeKey]) {
    const cost = (AGE_UP_COSTS as Record<number, AIResourceAmount>)[nextAgeKey] || {}
    const buffer = (AGE_UP_BUFFERS as Record<number, AIResourceAmount>)[nextAgeKey] || {}
    const popReady = ai.population >= Math.floor(maxVillagers * 0.8)
    const resReady = resourceEntries(cost).every(([res, amount]) => ai[res] >= amount + (buffer[res] || 0))
    if (popReady && resReady && !strategy.isTechnologyInProgress(ai.nextAge[nextAgeKey])) {
      actions += buyTechnology(strategy, [], ai.nextAge[nextAgeKey], {}, debug)
    }
  }

  const ageUpReserve = strategy.getAgeUpReserve()
  for (const tech of strategy.chiefTechPriority) {
    if (ai.technologies.includes(tech)) continue
    if (!strategy.canResearchTech(tech)) continue
    if (strategy.isTechnologyInProgress(tech)) continue
    actions += buyTechnology(strategy, [], tech, ageUpReserve, debug)
  }

  const buildingListByType: BuildingListByType = {
    [BUILDING_TYPES.barracks]: barracks,
    [BUILDING_TYPES.archeryRange]: archeryRanges,
    [BUILDING_TYPES.storagePit]: storagepits,
    [BUILDING_TYPES.market]: markets,
    [BUILDING_TYPES.granary]: granarys,
  }
  for (const [buildingType, techList] of Object.entries(ai.techPriorityByBuilding) as [string, string[]][]) {
    const buildings = buildingListByType[buildingType]
    for (const tech of techList) {
      if (ai.technologies.includes(tech)) continue
      if (!strategy.canResearchTech(tech)) continue
      if (strategy.isTechnologyInProgress(tech, buildings)) continue
      const bought = buyTechnology(strategy, buildings, tech, ageUpReserve, debug)
      if (bought) {
        actions += bought
        break
      }
    }
  }

  return actions
}
