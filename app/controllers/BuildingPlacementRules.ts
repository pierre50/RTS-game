import { isCampBuilding } from '../lib/buildings/campConstruction'
import { heroCanCommand, playerNeedsChiefForCommand } from '../lib/chief'
import { constructionTerritoryBlocker } from '../lib/campaign/mapTerritory'
import type { Container } from 'pixi.js'
import { BUILDING_TYPES } from '../constants'
import {
  canPlaceBuildingAt,
  getBuildingFootprintCells,
  hasBuildingPlacementClearance,
  isBuildingLimitReached,
} from '../lib'
import { createReservedPassageCellLookup } from '../lib/buildings/passageCells'
import { isWall } from '../lib/buildings/walls'
import { getMapSpace, isOutsideSpaceId, sameCellMapSpace } from '../lib/mapSpaces'
import type { ControlsLike } from '../types/context'
import type { PlaceableBuildingConfig } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { PlacementOwner } from '../types/player'

type MouseBuilding = Container &
  PlaceableBuildingConfig & {
    isFree?: boolean
    inventoryItem?: string
  }

export class BuildingPlacementRules {
  constructor(readonly controls: ControlsLike) {}
  isExploredForPlacement(cell: RuntimeCell, owner: PlacementOwner): boolean {
    const {
      controls: {
        context: { map },
      },
    } = this
    if (!isOutsideSpaceId(cell.spaceId)) return cell.visible !== false
    return Boolean(cell && (map.revealEverything || map.revealTerrain || owner?.views?.isViewed(cell.i, cell.j)))
  }
  canPlaceMouseBuilding(cell: RuntimeCell): boolean {
    const {
      controls,
      controls: {
        context: { map, player },
      },
    } = this
    if (!cell || constructionTerritoryBlocker(controls.context, player)) return false
    const space = getMapSpace(map, cell.spaceId)
    const grid = space?.grid ?? map.grid
    const mouseBuilding = controls.mouseBuilding as MouseBuilding | null | undefined
    if (!mouseBuilding) return false
    if (!isCampBuilding(mouseBuilding.type) && playerNeedsChiefForCommand(player) && !heroCanCommand(controls.heroUnit))
      return false
    if (
      mouseBuilding.inventoryItem &&
      !controls.heroUnit?.inventory?.equipment?.includes(mouseBuilding.inventoryItem)
    ) {
      return false
    }
    if (mouseBuilding.type !== BUILDING_TYPES.farm && isBuildingLimitReached(player, mouseBuilding.type)) return false
    if (this.doesBuildingOverlapHero(cell, mouseBuilding)) return false
    const passageLookup = createReservedPassageCellLookup(controls.context)
    const placementOptions = {
      requireVisible: true,
      requireExplored: true,
      isExplored: (candidate: RuntimeCell) => this.isExploredForPlacement(candidate, player),
      canUseCell: (candidate: RuntimeCell) => !passageLookup.has(candidate),
    }
    return (
      canPlaceBuildingAt(grid, cell.i, cell.j, mouseBuilding, placementOptions) &&
      hasBuildingPlacementClearance(grid, cell.i, cell.j, mouseBuilding, placementOptions)
    )
  }
  doesBuildingOverlapHero(cell: RuntimeCell, building: PlaceableBuildingConfig): boolean {
    const hero = this.controls.isHeroControlActive?.() ? this.controls.heroUnit : null
    if (!hero || hero.isDead || hero.isDestroyed) return false
    if (!sameCellMapSpace(hero, cell)) return false
    const size = typeof building.size === 'number' ? building.size : 1
    const space = getMapSpace(this.controls.context.map, cell.spaceId)
    return getBuildingFootprintCells(cell.i, cell.j, space?.grid ?? this.controls.context.map.grid, size).some(
      footprintCell => footprintCell.i === hero.i && footprintCell.j === hero.j
    )
  }
  canWallUseCell(cell: RuntimeCell, owner: PlacementOwner, allowExistingWall = false): boolean {
    if (
      (playerNeedsChiefForCommand(this.controls.context.player) && !heroCanCommand(this.controls.heroUnit)) ||
      constructionTerritoryBlocker(this.controls.context, owner) ||
      !cell ||
      this.isHeroOnCell(cell) ||
      !cell.visible ||
      !this.isExploredForPlacement(cell, owner) ||
      cell.category === 'Water' ||
      cell.waterBorder ||
      cell.inclined ||
      cell.border
    ) {
      return false
    }
    if (!cell.has && !cell.solid) return true
    return allowExistingWall && isWall(cell.has, owner)
  }
  isHeroOnCell(cell: RuntimeCell): boolean {
    const hero = this.controls.isHeroControlActive?.() ? this.controls.heroUnit : null
    return Boolean(
      hero &&
        !hero.isDead &&
        !hero.isDestroyed &&
        sameCellMapSpace(hero, cell) &&
        hero.i === cell.i &&
        hero.j === cell.j
    )
  }
}
