import { isSowingPlacement, WHEAT_PLOT_SIZE } from '../../lib/buildings/campConstruction'
import { createConstructionMaterials } from '../../lib/economy/constructionMaterials'
import { generatedBuildingMirrored } from '../../lib/buildings/generatedBuildingOrientation'
import { getBuildingAge, getPlayerBuildingConfig } from '../../lib/buildings/buildingAge'
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
  options: { alreadyPaid?: boolean; spaceId?: string; buildingAge?: number; placementMirrored?: boolean } = {}
) {
  const buildingAge = getBuildingAge(options, player.age)
  if (buildingAge > player.age) return false
  const {
    context: { menu, map },
  } = player
  const space = getMapSpace(map, options.spaceId)
  const grid = space?.grid ?? map.grid
  const config = getPlayerBuildingConfig(player, BUILDING_TYPES.farm, buildingAge)
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
          buildingAge,
          isBuilt: false,
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
  options: { alreadyPaid?: boolean; spaceId?: string; buildingAge?: number; placementMirrored?: boolean } = {}
) {
  if (isSowingPlacement(type)) return player.plantWheatField(i, j, options)
  const buildingAge = getBuildingAge(options, player.age)
  if (buildingAge > player.age) return false
  const {
    context: { menu, map },
  } = player
  const space = getMapSpace(map, options.spaceId)
  const grid = space?.grid ?? map.grid
  const config = getPlayerBuildingConfig(player, type, buildingAge)
  if (!config) return false
  const placementConfig = { ...config, type }
  const passageLookup = createReservedPassageCellLookup(player.context)
  const placementOptions = {
    canUseCell: (cell: RuntimeCell) => !passageLookup.has(cell),
  }
  if (
    player.isBuildingEligible(type) &&
    canPlaceBuildingAt(grid, i, j, placementConfig, placementOptions) &&
    hasBuildingPlacementClearance(grid, i, j, placementConfig, placementOptions)
  ) {
    player.spawnBuilding(
      definedProperties({
        i,
        j,
        spaceId: space?.id,
        type,
        buildingAge,
        placementMirrored:
          options.placementMirrored ??
          (player.type === 'AI' && (!space || space.id === 'outside')
            ? generatedBuildingMirrored(type, { i, j }, map.seed ?? 0, point => {
                const cell = grid[point.i]?.[point.j]
                return Boolean(cell && !cell.solid && !cell.border && !cell.terrainHidden && cell.category !== 'Water')
              })
            : false),
        isBuilt: Boolean(map.instantMode),
        constructionMaterials:
          options.alreadyPaid || map.instantMode ? undefined : createConstructionMaterials(config.cost),
      })
    )
    player.isPlayed && menu.updateTopbar()
    return true
  }
  return false
}
