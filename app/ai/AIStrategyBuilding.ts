import { BUILDING_TYPES } from '../constants'
import { canAfford, getBuildingPlacementSearchSize, getPositionInGridAroundInstance, instancesDistance } from '../lib'
import { createReservedPassageCellLookup } from '../lib/buildings/passageCells'
import type {
  AIBuildingLike,
  AIEntityLike,
  AIGridPosition,
  AIResourceAmount,
  AIStrategyPlayerLike,
  AIStrategySnapshot,
} from './types'
import type { GridCell } from '../types/grid'
import type { RuntimeCell } from '../types/map'

type BuildingListByType = Record<string, AIBuildingLike[]>
type ResourceLedger = Record<string, number | undefined>
type BuildActionBuyer = (
  condition: boolean,
  buildingType: string,
  positionCallback: () => AIGridPosition | null,
  preserveAgeReserve?: boolean
) => boolean
type PlacementConditionFactory = (
  ...conditions: Array<(cell: AIGridPosition) => boolean>
) => (cell: GridCell) => boolean

const WHEAT_TILES_PER_FIELD = 16
const MAX_AI_WHEAT_FIELDS = 4

type BuildingStrategy = {
  ai: AIStrategyPlayerLike
  getAgeUpReserve(): AIResourceAmount
  getDesiredBarracksCount(snapshot?: Partial<AIStrategySnapshot> | null): number
  canSpendWithReserve(cost: AIResourceAmount, reserve?: AIResourceAmount): boolean
}

function asResourceLedger(player: AIStrategyPlayerLike): ResourceLedger {
  return {
    wood: player.wood,
    food: player.food,
    gold: player.gold,
    stone: player.stone,
  }
}

export function buyAIBuildingIfNeeded(
  strategy: BuildingStrategy,
  condition: boolean,
  buildingType: string,
  buildingsByType: BuildingListByType,
  positionCallback: () => AIGridPosition | null,
  reserve: AIResourceAmount = {},
  debug: boolean = false
): boolean {
  const { ai } = strategy
  const building = ai.config.buildings[buildingType]
  if (
    condition &&
    canAfford(asResourceLedger(ai), building.cost) &&
    strategy.canSpendWithReserve(building.cost || {}, reserve) &&
    ai.hasNotReachBuildingLimit(buildingType, buildingsByType[buildingType])
  ) {
    const pos = positionCallback()
    if (pos && ai.buyBuilding(pos.i, pos.j, buildingType)) {
      if (debug) console.log(`Buying building: ${buildingType} at position:`, pos)
      return true
    }
  }
  return false
}

export function buyAIWheatFieldIfNeeded(
  strategy: BuildingStrategy,
  condition: boolean,
  currentWheatTiles: AIEntityLike[],
  positionCallback: () => AIGridPosition | null,
  reserve: AIResourceAmount = {},
  debug: boolean = false
): boolean {
  const { ai } = strategy
  const field = ai.config.buildings[BUILDING_TYPES.farm]
  if (
    condition &&
    field &&
    canAfford(asResourceLedger(ai), field.cost) &&
    strategy.canSpendWithReserve(field.cost || {}, reserve)
  ) {
    const pos = positionCallback()
    if (pos && ai.buyBuilding(pos.i, pos.j, BUILDING_TYPES.farm)) {
      if (debug) {
        const fieldCount = Math.ceil(currentWheatTiles.length / WHEAT_TILES_PER_FIELD)
        console.log(`Planting wheat field ${fieldCount + 1} at position:`, pos)
      }
      return true
    }
  }
  return false
}

function findBuildingPosition(
  anchor: AIGridPosition,
  map: AIStrategySnapshot['map'],
  distanceRange: [number, number],
  footprintSize: number,
  placementCondition: ReturnType<PlacementConditionFactory>
): AIGridPosition | null {
  return getPositionInGridAroundInstance(
    anchor,
    map.grid,
    distanceRange,
    getBuildingPlacementSearchSize(footprintSize),
    false,
    placementCondition
  )
}

function buyCoreInfrastructure(options: {
  ai: AIStrategyPlayerLike
  anchor: AIGridPosition
  barracks: AIBuildingLike[]
  buy: BuildActionBuyer
  desiredBarracks: number
  map: AIStrategySnapshot['map']
  markets: AIBuildingLike[]
  notBuiltHouses: AIBuildingLike[]
  otherPlayers: AIStrategySnapshot['otherPlayers']
  placementCondition: PlacementConditionFactory
}): number {
  const { ai, anchor, barracks, buy, desiredBarracks, map, markets, notBuiltHouses, otherPlayers, placementCondition } =
    options
  const isEnemyFacing = (origin: AIGridPosition) => (cell: AIGridPosition) =>
    otherPlayers.every(player => instancesDistance(cell, player) <= instancesDistance(origin, player))
  const defensivePlacement = () => placementCondition(isEnemyFacing(anchor))
  let actions = 0

  if (
    buy(
      ai.population + 2 > ai.populationMax && !notBuiltHouses.length,
      BUILDING_TYPES.house,
      () => findBuildingPosition(anchor, map, [6, 10], 0, placementCondition()),
      false
    )
  )
    actions++

  if (
    buy(ai.phase !== 'economy' && barracks.length < desiredBarracks, BUILDING_TYPES.barracks, () =>
      findBuildingPosition(anchor, map, [6, 20], 1, defensivePlacement())
    )
  )
    actions++

  if (
    buy(markets.length === 0, BUILDING_TYPES.market, () =>
      findBuildingPosition(anchor, map, [6, 20], 1, defensivePlacement())
    )
  )
    actions++

  if (
    buy(barracks.length > 0, BUILDING_TYPES.archeryRange, () =>
      findBuildingPosition(anchor, map, [6, 20], 1, defensivePlacement())
    )
  )
    actions++

  if (
    buy(barracks.length > 0, BUILDING_TYPES.stable, () =>
      findBuildingPosition(anchor, map, [6, 20], 1, defensivePlacement())
    )
  )
    actions++

  if (
    buy(ai.technologies.includes('ResearchWatchTower'), BUILDING_TYPES.watchTower, () =>
      findBuildingPosition(anchor, map, [6, 15], 2, defensivePlacement())
    )
  )
    actions++

  return actions
}

export function handleAIBuildingActions(
  strategy: BuildingStrategy,
  snapshot: AIStrategySnapshot,
  debug: boolean = false
): number {
  const { ai } = strategy
  const {
    map,
    otherPlayers,
    towncenters,
    maxVillagers,
    houses,
    farms,
    barracks,
    granarys,
    storagepits,
    markets,
    archeryRanges,
    stables,
    watchTowers,
    notBuiltHouses,
  } = snapshot

  const anchor = towncenters[0] || ai.getHomeAnchor()
  if (!anchor) return 0

  const buildingsByType = {
    [BUILDING_TYPES.townCenter]: towncenters,
    [BUILDING_TYPES.house]: houses,
    [BUILDING_TYPES.barracks]: barracks,
    [BUILDING_TYPES.granary]: granarys,
    [BUILDING_TYPES.storagePit]: storagepits,
    [BUILDING_TYPES.market]: markets,
    [BUILDING_TYPES.archeryRange]: archeryRanges,
    [BUILDING_TYPES.stable]: stables,
    [BUILDING_TYPES.watchTower]: watchTowers,
  }

  const passageLookup = createReservedPassageCellLookup(ai.context)
  const avoidsReservedPassages = (cell: GridCell) => !passageLookup.has(cell as RuntimeCell)
  const placementCondition =
    (...conditions: Array<(cell: AIGridPosition) => boolean>) =>
    (cell: GridCell) =>
      avoidsReservedPassages(cell) && conditions.every(condition => condition(cell as AIGridPosition))
  const ageUpReserve = strategy.getAgeUpReserve()
  const buy = (
    condition: boolean,
    buildingType: string,
    positionCallback: () => AIGridPosition | null,
    preserveAgeReserve: boolean = true
  ) =>
    buyAIBuildingIfNeeded(
      strategy,
      condition,
      buildingType,
      buildingsByType,
      positionCallback,
      preserveAgeReserve ? ageUpReserve : {},
      debug
    )

  let actions = 0
  const desiredBarracks = strategy.getDesiredBarracksCount(snapshot)
  actions += buyCoreInfrastructure({
    ai,
    anchor,
    barracks,
    buy,
    desiredBarracks,
    map,
    markets,
    notBuiltHouses,
    otherPlayers,
    placementCondition,
  })

  const livingWheatTiles = farms.filter(farm => !farm.isDead && !farm.isDestroyed && (farm.quantity ?? 0) > 0)
  const currentWheatFields = Math.ceil(livingWheatTiles.length / WHEAT_TILES_PER_FIELD)
  const desiredWheatFields = Math.min(MAX_AI_WHEAT_FIELDS, Math.max(1, Math.ceil(maxVillagers / 10)))
  const wheatAnchor = granarys.find(granary => granary.isBuilt && !granary.isDead && !granary.isDestroyed) || anchor
  if (
    buyAIWheatFieldIfNeeded(
      strategy,
      ai.technologies.includes('Farming') && granarys.length > 0 && currentWheatFields < desiredWheatFields,
      livingWheatTiles,
      () =>
        getPositionInGridAroundInstance(
          wheatAnchor,
          map.grid,
          [4, 14],
          getBuildingPlacementSearchSize(4),
          false,
          placementCondition()
        ),
      ageUpReserve,
      debug
    )
  )
    actions++

  return actions
}
