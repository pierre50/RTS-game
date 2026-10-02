import { createInitialHouseholdPartners, reconcileHouseholds } from '../../../lib/housing/households'
import { refreshPopulationCapacity } from '../../../lib/buildings/buildingOccupancy'
import { depositChestResources, getPlayerResourceTotals } from '../../../lib/resources/playerResourceTotals'
import { getStorageCapacity } from '../../../lib/resources/storagePolicy'
import { savedResourceOwner } from '../offline/OfflineWorldWork'
import { addStartingHouses, addStartingUnits, startingPopulation } from './StartingPopulation'
import {
  addMissingBuildings,
  addStartingBuilding,
  createStartingVillage,
  type StartingVillage,
  type StartingVillageSetup,
} from './StartingVillageContext'
import { addStartingWalls } from './StartingWalls'
import { addStartingWheatFields } from './StartingWheatFields'
import type { VillageStartProfile } from '../../../types/save'

const DISTRICT_BUILDING_ORDER = [
  'Granary',
  'StoragePit',
  'Market',
  'Forge',
  'Barracks',
  'ArcheryRange',
  'Stable',
  'House',
  'WatchTower',
]
const buildingPlacementOrder = (type: string) => DISTRICT_BUILDING_ORDER.indexOf(type) + 1 || 99

export function populateStartingVillage(setup: StartingVillageSetup, profile: VillageStartProfile): void {
  const village = createStartingVillage(setup, profile)
  const { player, index, rules } = village
  // Give fields a real depot anchor before filling the agricultural district.
  addMissingBuildings(village, 'Granary', profile.buildings.Granary ?? 0)
  addStartingWheatFields(village)
  for (const [type, count] of Object.entries(profile.buildings).sort(
    ([a], [b]) => buildingPlacementOrder(a) - buildingPlacementOrder(b)
  ))
    addMissingBuildings(village, type, count)
  const units = (player.units ??= [])
  const population = startingPopulation(village, units)
  const outpost = profile.settlementType === 'outpost'
  addStartingUnits(village, units)
  if (!outpost) {
    createInitialHouseholdPartners(player)
    addStartingHouses(village)
    reconcileHouseholds(player)
  }
  player.population = population
  refreshPopulationCapacity(player)
  addStartingWalls(
    profile.wallRadius,
    Number(rules.buildingConfig(index, 'SmallWall').size) || 0,
    village.center,
    village.spatial,
    (type, point) => addStartingBuilding(village, type, point)
  )
  fillStartingDepots(village)
  depositStartingBonus(village)
  Object.assign(
    player,
    getPlayerResourceTotals(savedResourceOwner(player, village.state.players), { includeHero: false })
  )
}

function fillStartingDepots({ profile, buildings }: StartingVillage): void {
  for (const [type, stock] of Object.entries(profile.depotStocks ?? {})) {
    const total = Object.values(stock).reduce((sum, n) => sum + (n ?? 0), 0)
    if (Object.values(stock).some(n => !Number.isFinite(n) || n < 0) || total > getStorageCapacity(type))
      throw new Error(`Starting stock exceeds ${type} capacity`)
    for (const building of buildings.filter(b => b.type === type))
      building.inventory = { ...building.inventory, resources: { ...stock } }
  }
}

function depositStartingBonus({ profile, player, state }: StartingVillage): void {
  if (!profile.resourceBonus) return
  if (Object.values(profile.resourceBonus).some(n => !Number.isFinite(n) || n < 0))
    throw new Error('Invalid starting resources')
  if (!depositChestResources(savedResourceOwner(player, state.players), profile.resourceBonus, { allowPartial: true }))
    throw new Error('Starting village has no resource depot')
}
