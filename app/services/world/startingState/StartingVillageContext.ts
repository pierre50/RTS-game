import { assignCampBrazierAppearance } from '../../../lib/buildings/campConstruction'
import { generatedBuildingMirrored } from '../../../lib/buildings/generatedBuildingOrientation'
import { normalizeForgeUpgrades } from '../../../lib/equipment/forgeUpgrades'
import { createSeededRandom } from '../../../lib/random'
import { isLiving, type OfflineWorldSpatial } from '../offline/OfflineWorldSpatial'
import type { OfflineWorkRules } from '../offline/OfflineWorldWork'
import type { StartingVillageLayout } from '../StartingVillageLayout'
import { settlementAnchorType, startingBuilding } from './StartingProfiles'
import type {
  SaveEntityState,
  SaveGridPoint,
  SavePlayerState,
  SerializedSave,
  VillageStartProfile,
} from '../../../types/save'

export type StartingVillageSetup = {
  state: SerializedSave
  player: SavePlayerState
  index: number
  rules: OfflineWorkRules
  layout: StartingVillageLayout
}
export type StartingVillage = StartingVillageSetup & {
  spatial: OfflineWorldSpatial
  profile: VillageStartProfile
  center: SaveEntityState
  buildings: SaveEntityState[]
  hasBuilt: string[]
}

export function createStartingVillage(setup: StartingVillageSetup, profile: VillageStartProfile): StartingVillage {
  const { player } = setup
  const buildings = player.buildings
  const anchorType = settlementAnchorType(profile)
  const center = buildings?.find(b => b.type === anchorType && b.isBuilt && isLiving(b))
  if (!buildings || !center) throw new Error(`Starting village ${player.civ} requires a settlement anchor`)
  player.forgeUpgrades = normalizeForgeUpgrades(profile)
  const hasBuilt = [
    ...new Set([...(player.hasBuilt ?? []), ...buildings.filter(b => b.isBuilt && isLiving(b)).map(b => b.type)]),
  ]
  player.hasBuilt = hasBuilt
  return { ...setup, spatial: setup.layout.spatial, profile, center, buildings, hasBuilt }
}

export function findStartingSite(
  village: StartingVillage,
  anchor: SaveEntityState,
  size: number,
  type: string
): SaveGridPoint | null {
  return village.layout.findSite(village.center, anchor, size, village.player.civ ?? '', type)
}

export function addStartingBuilding(village: StartingVillage, type: string, fixedPoint?: SaveGridPoint): void {
  const { player, index, layout, center, buildings } = village
  const { level, config } = startingBuilding(village.rules, index, type, village.profile.buildingLevel)
  if (!(Number(config.totalHitPoints) > 0)) throw new Error(`Unknown starting building ${type}`)
  const size = Number(config.size) || 0
  const point = fixedPoint ?? findStartingSite(village, center, size, type)
  if (!point) throw new Error(`No space for required ${type} in ${player.civ}`)
  const building: SaveEntityState = {
    ...point,
    type,
    size,
    label: `start:${player.label ?? index}:building:${buildings.length}`,
    isBuilt: true,
    buildingLevel: level,
    placementMirrored: generatedBuildingMirrored(type, point, player.civ ?? index, p => village.spatial.available(p)),
    hitPoints: Number(config.totalHitPoints),
    totalHitPoints: Number(config.totalHitPoints),
  }
  assignCampBrazierAppearance(building, createSeededRandom(`light:${building.label}:${point.i}:${point.j}`))
  buildings.push(building)
  if (!village.hasBuilt.includes(type)) village.hasBuilt.push(type)
  layout.reserveBuilding(building)
  layout.recordSite(center, type, building, size)
}

export function addMissingBuildings(village: StartingVillage, type: string, count: number): void {
  const existing = village.buildings.filter(b => b.type === type && isLiving(b)).length
  for (let n = existing; n < count; n++) addStartingBuilding(village, type)
}
