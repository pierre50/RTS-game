import { tryCreateCampChest } from '../lib/grid/campChestPlacement'
import { getPlayerResourceStores, type ResourceStoreOwner } from '../lib/resources/playerResourceTotals'
import { storageResourcesForAI } from './AIStrategyResources'
import { getPlayerBuildingConfig } from '../lib/buildings/buildingAge'
import { BUILDING_TYPES } from '../constants'
import { villageBuildingNeeds } from './AIDevelopmentPolicy'
import { canAfford, getBuildingPlacementSearchSize, getPositionInGridAroundInstance, instancesDistance } from '../lib'
import { findStoragePitSite, needsStoragePit } from '../lib/grid/storagePitPlacement'
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
  getDesiredBarracksCount(snapshot?: Partial<AIStrategySnapshot> | null): number
  canSpendWithReserve(cost: AIResourceAmount, reserve?: AIResourceAmount): boolean
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
  const building = getPlayerBuildingConfig(ai, buildingType)
  if (!building) return false
  if (
    condition &&
    canAfford(ai as Parameters<typeof canAfford>[0], building.cost) &&
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
  const field = getPlayerBuildingConfig(ai, BUILDING_TYPES.farm)
  if (
    condition &&
    field &&
    canAfford(ai as Parameters<typeof canAfford>[0], field.cost) &&
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
  granarys: AIBuildingLike[]
  map: AIStrategySnapshot['map']
  markets: AIBuildingLike[]
  notBuiltHouses: AIBuildingLike[]
  otherPlayers: AIStrategySnapshot['otherPlayers']
  placementCondition: PlacementConditionFactory
  storagepits: AIBuildingLike[]
  temples: AIBuildingLike[]
}): number {
  const {
    ai,
    anchor,
    barracks,
    buy,
    desiredBarracks,
    granarys,
    map,
    markets,
    notBuiltHouses,
    otherPlayers,
    placementCondition,
    storagepits,
    temples,
  } = options
  const isEnemyFacing = (origin: AIGridPosition) => (cell: AIGridPosition) =>
    otherPlayers.every(player => instancesDistance(cell, player) <= instancesDistance(origin, player))
  const defensivePlacement = () => placementCondition(isEnemyFacing(anchor))
  let actions = 0
  const storageResources = storageResourcesForAI(ai)
  const needs = villageBuildingNeeds({
    storagePitNeeded: needsStoragePit(storageResources, ai.buildings),
    population: ai.population,
    populationMax: ai.populationMax,
    age: ai.age,
    phase: ai.phase,
    desiredBarracks,
    buildings: [
      ...barracks,
      ...granarys,
      ...markets,
      ...storagepits,
      ...notBuiltHouses,
      ...temples,
      ...ai.buildings.filter(building => building.type === BUILDING_TYPES.forge),
    ],
  })

  if (
    buy(
      needs[BUILDING_TYPES.house],
      BUILDING_TYPES.house,
      () => findBuildingPosition(anchor, map, [6, 10], 0, placementCondition()),
      false
    )
  )
    actions++

  if (
    buy(
      needs[BUILDING_TYPES.storagePit],
      BUILDING_TYPES.storagePit,
      () =>
        findStoragePitSite({
          home: anchor,
          size: Number(getPlayerBuildingConfig(ai, BUILDING_TYPES.storagePit)?.size) || 3,
          resources: storageResources,
          buildings: ai.buildings,
          terrainAt: point => map.grid[point.i]?.[point.j],
          isFree: (point, forBuilding) => {
            const cell = map.grid[point.i]?.[point.j]
            return (
              !!cell &&
              (!cell.solid || (!forBuilding && cell.has?.family === 'unit')) &&
              (!forBuilding || placementCondition()(cell))
            )
          },
        }),
      false
    )
  )
    actions++

  if (
    buy(
      needs[BUILDING_TYPES.granary],
      BUILDING_TYPES.granary,
      () => findBuildingPosition(anchor, map, [4, 12], 1, placementCondition()),
      false
    )
  )
    actions++

  if (
    buy(needs[BUILDING_TYPES.barracks], BUILDING_TYPES.barracks, () =>
      findBuildingPosition(anchor, map, [6, 20], 1, defensivePlacement())
    )
  )
    actions++

  if (
    buy(needs[BUILDING_TYPES.market], BUILDING_TYPES.market, () =>
      findBuildingPosition(anchor, map, [6, 20], 1, defensivePlacement())
    )
  )
    actions++

  if (
    buy(needs[BUILDING_TYPES.archeryRange], BUILDING_TYPES.archeryRange, () =>
      findBuildingPosition(anchor, map, [6, 20], 1, defensivePlacement())
    )
  )
    actions++

  if (
    buy(needs[BUILDING_TYPES.stable], BUILDING_TYPES.stable, () =>
      findBuildingPosition(anchor, map, [6, 20], 1, defensivePlacement())
    )
  )
    actions++

  if (
    buy(needs[BUILDING_TYPES.watchTower], BUILDING_TYPES.watchTower, () =>
      findBuildingPosition(anchor, map, [6, 15], 2, defensivePlacement())
    )
  )
    actions++

  if (
    buy(needs[BUILDING_TYPES.temple], BUILDING_TYPES.temple, () =>
      findBuildingPosition(anchor, map, [4, 12], 1, placementCondition())
    )
  )
    actions++

  if (
    actions === 0 &&
    !ai.buildings.some(building => !building.isBuilt && !building.isDead && !building.isDestroyed) &&
    buy(needs[BUILDING_TYPES.forge], BUILDING_TYPES.forge, () =>
      findBuildingPosition(
        storagepits.find(building => building.isBuilt) || markets[0] || anchor,
        map,
        [6, 14],
        Number(getPlayerBuildingConfig(ai, BUILDING_TYPES.forge)?.size) || 3,
        placementCondition()
      )
    )
  )
    actions++

  return actions
}

function buyCampChest(ai: AIStrategyPlayerLike): number {
  if (!ai.config.buildings[BUILDING_TYPES.chest]) return 0
  const grid = ai.context.map.grid
  const passages = createReservedPassageCellLookup(ai.context)
  return Number(
    tryCreateCampChest({
      workers: ai.units,
      buildings: ai.buildings,
      resources: Object.values(ai.foundedResources ?? {}).flatMap(set => [...set]),
      stocks: getPlayerResourceStores(ai as unknown as ResourceStoreOwner),
      woodCost: Number(getPlayerBuildingConfig(ai, BUILDING_TYPES.chest)?.cost?.wood) || 0,
      terrainAt: p => grid[p.i]?.[p.j],
      isFree: p => {
        const cell = grid[p.i]?.[p.j]
        return !!cell && !cell.solid && !passages.has(cell)
      },
      create: p => ai.buyBuilding(p.i, p.j, BUILDING_TYPES.chest, { alreadyPaid: true }),
    })
  )
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
    temples,
    notBuiltHouses,
  } = snapshot

  const anchor =
    towncenters[0] ||
    ai.buildings?.find(b => b.type === BUILDING_TYPES.chest && b.isBuilt && !b.isDead && !b.isDestroyed) ||
    ai.getHomeAnchor()
  if (!anchor) return buyCampChest(ai)

  const buildingsByType = {
    [BUILDING_TYPES.townCenter]: towncenters,
    [BUILDING_TYPES.house]: houses,
    [BUILDING_TYPES.barracks]: barracks,
    [BUILDING_TYPES.granary]: granarys,
    [BUILDING_TYPES.storagePit]: storagepits,
    [BUILDING_TYPES.market]: markets,
    [BUILDING_TYPES.forge]: ai.buildings.filter(
      building => building.type === BUILDING_TYPES.forge && !building.isDead && !building.isDestroyed
    ),
    [BUILDING_TYPES.archeryRange]: archeryRanges,
    [BUILDING_TYPES.stable]: stables,
    [BUILDING_TYPES.watchTower]: watchTowers,
    [BUILDING_TYPES.temple]: temples,
  }

  const passageLookup = createReservedPassageCellLookup(ai.context)
  const avoidsReservedPassages = (cell: GridCell) => !passageLookup.has(cell as RuntimeCell)
  const placementCondition =
    (...conditions: Array<(cell: AIGridPosition) => boolean>) =>
    (cell: GridCell) =>
      avoidsReservedPassages(cell) && conditions.every(condition => condition(cell as AIGridPosition))
  const ageUpReserve = {}
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
    granarys,
    map,
    markets,
    notBuiltHouses,
    otherPlayers,
    placementCondition,
    storagepits,
    temples,
  })

  actions += buyCampChest(ai)

  const livingWheatTiles = farms.filter(farm => !farm.isDead && !farm.isDestroyed && (farm.quantity ?? 0) > 0)
  const currentWheatFields = Math.ceil(livingWheatTiles.length / WHEAT_TILES_PER_FIELD)
  const desiredWheatFields = Math.min(MAX_AI_WHEAT_FIELDS, Math.max(1, Math.ceil(maxVillagers / 10)))
  const wheatAnchor = granarys.find(granary => granary.isBuilt && !granary.isDead && !granary.isDestroyed) || anchor
  if (
    buyAIWheatFieldIfNeeded(
      strategy,
      granarys.length > 0 && currentWheatFields < desiredWheatFields,
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
