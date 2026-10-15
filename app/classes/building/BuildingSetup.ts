import { registerFurnitureSurface } from '../../lib/terrain/furnitureSurface'
import { isBuildingTraversable } from '../../lib/buildings/buildingTraversal'
import { ownerSharesVision } from '../../lib/units/playerVisionAccess'
import { FAMILY_TYPES, PASSABLE_RESOURCE_TYPES } from '../../constants'
import {
  clearCellTerrainSet,
  getEntityMapSpace,
  getBuildingFootprintCells,
  STABLE_HORSE_CAPACITY,
  HORSE_TAMING_STATUS,
  updateInstanceVisibility,
} from '../../lib'
import type { Building, BuildingOptions } from './Building'
import type { HorseTamingStatus } from '../../lib/horses/horseTaming'
import type { RuntimeCell } from '../../types/map'

export function stableHorsesFromOptions(
  options: BuildingOptions
): Array<{ horseColor?: string; tamingStatus?: HorseTamingStatus }> {
  if (Array.isArray(options.stableHorses)) {
    return options.stableHorses.map(horse => ({
      ...horse,
      tamingStatus: HORSE_TAMING_STATUS.tamed,
    }))
  }
  const horseAmount = Math.max(0, Math.min(STABLE_HORSE_CAPACITY, Number(options.horseAmount) || 0))
  return Array.from({ length: horseAmount }, () => ({ tamingStatus: HORSE_TAMING_STATUS.tamed }))
}

export function resumeInitialBuildingWork(building: Building): void {
  if (building.queue.length) {
    building.buyUnit(building.queue[0], true, true)
    return
  }
}

export function setupBuildingTransform(building: Building): void {
  building.buildingView.mount(building.getVisualState())
}

export function createInitialBuildingSprite(building: Building): void {
  building.buildingView.createInitialSprite()
}

export function occupyBuildingFootprint(building: Building): void {
  const { map, player } = building.context
  const space = getEntityMapSpace(building, map)
  const grid = space?.grid ?? map.grid
  const updatesOutsideWorldVision = space?.kind !== 'interior'
  const providesOutsideWorldVision =
    updatesOutsideWorldVision &&
    building.providesVision !== false &&
    ownerSharesVision(building.owner, building.context)
  getBuildingFootprintCells(
    building.i,
    building.j,
    grid,
    building.size,
    (cell: RuntimeCell) => {
      if (cell.has?.family === FAMILY_TYPES.resource && PASSABLE_RESOURCE_TYPES.has(cell.has.type)) {
        cell.has.die?.(true)
      }
      clearCellTerrainSet(cell)
      for (const corpse of cell.corpses) {
        typeof corpse.clear === 'function' && corpse.clear()
      }
      registerFurnitureSurface(cell, building)
      cell.has = building
      cell.solid = !isBuildingTraversable(building.type)
      if (providesOutsideWorldVision) {
        building.owner.views.addViewer(cell.i, cell.j, building)
        if (building.owner !== player && building.owner.views.setViewed(cell.i, cell.j)) {
          building.owner.cellViewed++
        }
      }
      cell.updateVisible()
      return true
    },
    building.type
  )
}

export function attachInitialBuildingVisuals(building: Building): void {
  building.buildingView.attachInitialVisuals()
}

export function activateBuiltBuilding(building: Building): void {
  if (!building.isBuilt) return
  building.visibilityTimeout = setTimeout(() => {
    updateInstanceVisibility(building)
    building.scanForInitialTarget()
  })
  building.finalTexture()
  building.onBuilt()
  if (building.buildingUpgrade) building.updateTexture()
}
