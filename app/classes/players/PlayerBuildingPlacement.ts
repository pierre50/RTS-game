import { generatedBuildingMirrored } from '../../lib/buildings/generatedBuildingOrientation'
import { getBuildingAge, getPlayerBuildingConfig } from '../../lib/buildings/buildingAge'
import { constructionTerritoryBlocker } from '../../lib/campaign/mapTerritory'
import { BUILDING_TYPES, FADE_DURATION_MS, RESOURCE_TYPES } from '../../constants'
import {
  canAfford,
  canPlaceBuildingAt,
  getBuildingFootprintCells,
  hasBuildingPlacementClearance,
  isBuildingLimitReached,
  payCost,
} from '../../lib'
import { createReservedPassageCellLookup } from '../../lib/buildings/passageCells'
import { definedProperties } from '../../lib/definedProperties'
import { fadeIn } from '../../lib/entities/entityFade'
import { addEntityToMapSpaceContainer, getMapSpace } from '../../lib/mapSpaces'
import type { RuntimeEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import { NEUTRAL_RESOURCE_QUANTITY_RANGES, rollResourceQuantity } from '../map/resources/ResourceQuantityRanges'
import { Resource } from '../Resource'
import { AGE_OBJECTIVES, completeAgeObjective } from '../../lib/objectives/ageObjectives'

import type { Player } from './Player'

type PlayerResourceMemory = {
  foundedWheats?: Set<RuntimeEntity>
  foundedResources?: Record<string, Set<RuntimeEntity>>
}

export function plantPlayerWheatField(
  player: Player,
  i: number,
  j: number,
  options: { alreadyPaid?: boolean; spaceId?: string; buildingAge?: number; placementMirrored?: boolean } = {}
) {
  if (constructionTerritoryBlocker(player.context, player)) return false
  const buildingAge = getBuildingAge(options, player.age)
  if (buildingAge > player.age) return false
  const {
    context: { menu, map },
  } = player
  const space = getMapSpace(map, options.spaceId)
  const grid = space?.grid ?? map.grid
  const config = getPlayerBuildingConfig(player, BUILDING_TYPES.farm, buildingAge)
  if (!config) return false
  const placementConfig = { ...config, type: BUILDING_TYPES.farm }
  const passageLookup = createReservedPassageCellLookup(player.context)
  const placementOptions = {
    canUseCell: (cell: RuntimeCell) => !passageLookup.has(cell),
  }
  if (
    (options.alreadyPaid || canAfford(player, config.cost)) &&
    player.isBuildingEligible(BUILDING_TYPES.farm) &&
    canPlaceBuildingAt(grid, i, j, placementConfig, placementOptions) &&
    hasBuildingPlacementClearance(grid, i, j, placementConfig, placementOptions)
  ) {
    const planted: RuntimeEntity[] = []
    if (!options.alreadyPaid) payCost(player, config.cost)
    const size = typeof config.size === 'number' ? config.size : 4
    for (const cell of getBuildingFootprintCells(i, j, grid, size)) {
      const quantity = rollResourceQuantity(() => map.random(), NEUTRAL_RESOURCE_QUANTITY_RANGES[RESOURCE_TYPES.wheat])
      const wheat = new Resource(
        definedProperties({
          i: cell.i,
          j: cell.j,
          spaceId: cell.spaceId,
          type: RESOURCE_TYPES.wheat,
          quantity,
          totalQuantity: quantity,
        }),
        player.context
      )
      addEntityToMapSpaceContainer(map, wheat)
      cell.updateVisible()
      fadeIn(wheat, FADE_DURATION_MS)
      map.resources.add(wheat)
      planted.push(wheat)
    }
    const memory = player as PlayerResourceMemory
    planted.forEach(wheat => memory.foundedWheats?.add(wheat))
    planted.forEach(wheat => memory.foundedResources?.[RESOURCE_TYPES.wheat]?.add(wheat))
    player.isPlayed && menu.updateTopbar()
    if (menu.isMiniMapActive?.() !== false) menu.updateResourcesMiniMap?.()
    if (planted.length > 0) completeAgeObjective(player, AGE_OBJECTIVES.createWheatField)
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
  if (type === BUILDING_TYPES.farm) return player.plantWheatField(i, j, options)
  if (constructionTerritoryBlocker(player.context, player)) return false
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
    (options.alreadyPaid || canAfford(player, config.cost)) &&
    player.isBuildingEligible(type) &&
    !isBuildingLimitReached(player, type) &&
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
        isBuilt: map.instantMode || config.instantPlacement === true,
      })
    )
    if (!options.alreadyPaid) payCost(player, config.cost)
    player.isPlayed && menu.updateTopbar()
    return true
  }
  return false
}
