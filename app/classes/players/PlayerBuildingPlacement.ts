import { isBuildingTraversable } from '../../lib/buildings/buildingTraversal'
import { isNearInteriorDoor, preservesInteriorPassages } from '../../lib/buildings/interiorFurniturePlacement'
import { isBuildingAllowedInSpace, isSowingPlacement, WHEAT_PLOT_SIZE } from '../../lib/buildings/campConstruction'
import { createConstructionMaterials } from '../../lib/economy/constructionMaterials'
import { generatedBuildingMirrored } from '../../lib/buildings/generatedBuildingOrientation'
import { getBuildingLevel, getPlayerBuildingConfig } from '../../lib/buildings/buildingLevel'
import { BUILDING_TYPES } from '../../constants'
import { canPlaceBuildingAt, getBuildingFootprintCells, hasBuildingPlacementClearance } from '../../lib'
import { createReservedPassageCellLookup } from '../../lib/buildings/passageCells'
import { definedProperties } from '../../lib/definedProperties'
import { getMapSpace } from '../../lib/mapSpaces'

import type { RuntimeCell } from '../../types/map'
import type { Player } from './Player'

export function plantPlayerWheatField(
  player: Player,
  i: number,
  j: number,
  options: { alreadyPaid?: boolean; spaceId?: string; buildingLevel?: number; placementMirrored?: boolean } = {}
) {
  const buildingLevel = getBuildingLevel(options)
  if (buildingLevel > 0) return false
  const {
    context: { menu, map },
  } = player
  const space = getMapSpace(map, options.spaceId)
  const grid = space?.grid ?? map.grid
  const config = getPlayerBuildingConfig(player, BUILDING_TYPES.farm, buildingLevel)
  if (!config) return false
  const placementConfig = { ...config, size: WHEAT_PLOT_SIZE, type: BUILDING_TYPES.farm }
  const passageLookup = createReservedPassageCellLookup(player.context)
  const placementOptions = {
    canUseCell: (cell: RuntimeCell) => !passageLookup.has(cell),
  }
  if (
    player.isBuildingEligible(BUILDING_TYPES.farm) &&
    canPlaceBuildingAt(grid, i, j, placementConfig, placementOptions) &&
    hasBuildingPlacementClearance(grid, i, j, placementConfig, placementOptions)
  ) {
    for (const cell of getBuildingFootprintCells(i, j, grid, WHEAT_PLOT_SIZE)) {
      player.spawnBuilding(
        definedProperties({
          i: cell.i,
          j: cell.j,
          spaceId: cell.spaceId,
          type: BUILDING_TYPES.farm,
          buildingLevel,
          isBuilt: false,
          constructionProgress: 0,
          constructionMaterials: createConstructionMaterials({ wheat: 1 }),
        })
      )
    }
    player.isPlayed && menu.updateTopbar()
    return true
  }
  return false
}

export function buyPlayerBuilding(
  player: Player,
  i: number,
  j: number,
  type: string,
  options: { alreadyPaid?: boolean; spaceId?: string; buildingLevel?: number; placementMirrored?: boolean } = {}
) {
  if (isSowingPlacement(type)) return player.plantWheatField(i, j, options)
  const buildingLevel = getBuildingLevel(options)
  if (buildingLevel > 0) return false
  const {
    context: { menu, map },
  } = player
  const space = getMapSpace(map, options.spaceId)
  const grid = space?.grid ?? map.grid
  const config = getPlayerBuildingConfig(player, type, buildingLevel)
  if (!config) return false
  const placementConfig = { ...config, type }
  if (!isBuildingAllowedInSpace(type, space)) return false
  const interiorFurniture = space?.kind === 'interior'
  const furnitureCell = grid[i]?.[j]
  if (
    interiorFurniture &&
    furnitureCell &&
    (isNearInteriorDoor(furnitureCell, [space?.entryCell, space?.exitCell]) ||
      (!isBuildingTraversable(type) && !preservesInteriorPassages(grid, furnitureCell)))
  )
    return false
  const passageLookup = createReservedPassageCellLookup(player.context)
  const placementOptions = {
    allowBorder: interiorFurniture,
    canUseCell: (cell: RuntimeCell) =>
      !passageLookup.has(cell) && (!interiorFurniture || (!cell.terrainHidden && !cell.has)),
  }
  if (
    player.isBuildingEligible(type) &&
    canPlaceBuildingAt(grid, i, j, placementConfig, placementOptions) &&
    (interiorFurniture || hasBuildingPlacementClearance(grid, i, j, placementConfig, placementOptions))
  ) {
    player.spawnBuilding(
      definedProperties({
        i,
        j,
        spaceId: space?.id,
        type,
        buildingLevel,
        ...(interiorFurniture ? { assetType: type } : {}),
        interiorUnfurnished: player.type === 'Human' || Boolean(player.isPlayed),
        placementMirrored:
          options.placementMirrored ??
          (player.type === 'AI' && (!space || space.id === 'outside')
            ? generatedBuildingMirrored(type, { i, j }, map.seed ?? 0, point => {
                const cell = grid[point.i]?.[point.j]
                return Boolean(cell && !cell.solid && !cell.border && !cell.terrainHidden && cell.category !== 'Water')
              })
            : false),
        isBuilt: Boolean(map.instantMode),
        constructionProgress: map.instantMode ? 1 : 0,
        constructionMaterials:
          options.alreadyPaid || map.instantMode ? undefined : createConstructionMaterials(config.cost),
      })
    )
    player.isPlayed && menu.updateTopbar()
    return true
  }
  return false
}
