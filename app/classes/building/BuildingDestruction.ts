import { reconcileHouseholds } from '../../lib/housing/households'
import { canHeroDemolishBuilding, getFurnitureContainer } from '../../lib/buildings/buildingDemolition'
import { isInteriorFurniture } from '../../lib/buildings/furniture/interiorFurnitureCatalog'
import { removeFurnitureSurface } from '../../lib/terrain/furnitureSurface'
import { notifyVillageStateChanged } from '../../lib/units/village/villageStateEvents'
import { SOUND_CUES } from '../../constants'
import {
  canUpdateMinimap,
  getBuildingFootprintCells,
  isAIControlledPlayer,
  playAudibleSoundCue,
  updateInstanceVisibility,
} from '../../lib'
import { refreshPopulationCapacity } from '../../lib/buildings/buildingOccupancy'
import { getAdjacentWalls, isWall, updateWallTexture } from '../../lib/buildings/walls'
import { getEntityMapSpace } from '../../lib/mapSpaces'
import {
  expelBuildingInteriorOccupants,
  destroyBuildingInteriorInventory,
} from '../../services/BuildingInteriorSpaceSystem'
import type { RuntimeCell } from '../../types/map'
import { stopFlameAmbientSound } from './BuildingFire'
import type { BuildingControllerHost } from './BuildingTypes'

const BUILDING_DESTRUCTION_CLEAR_MS = 940

export class BuildingDestruction {
  constructor(private readonly building: BuildingControllerHost) {}

  die(demolition = false): void {
    const building = this.building
    if (building.isDead || building.isDestroyed) return
    if (demolition ? !canHeroDemolishBuilding(building) : building.indestructible) return
    if (demolition && isInteriorFurniture(building.type)) {
      const container = getFurnitureContainer(building)
      // A customized room must not regenerate removed preset decorations on reload.
      if (container) container.interiorUnfurnished = true
    }
    notifyVillageStateChanged(building.owner)
    const {
      context: { map, player, menu },
    } = building
    const space = getEntityMapSpace(building, map)
    const grid = space?.grid ?? map.grid
    const adjacentWalls = isWall(building) ? getAdjacentWalls(grid, building.i, building.j, building.owner) : []
    clearTimeout(building.visibilityTimeout)
    building.stopInterval()
    destroyBuildingInteriorInventory(building.context, building)
    if (building.constructionMaterials) building.constructionMaterials.delivered = {}
    building.cancelAllUnitTraining?.()
    expelBuildingInteriorOccupants(building.context, building)
    delete building.buildingUpgrade
    building.isDead = true
    building.hasActiveBurningSound = false
    stopFlameAmbientSound(building)
    this.removePopulationCapacity()
    map.removeFromInstanceBucket(building)
    if (building.context.controls.instanceIsAudible(building)) {
      playAudibleSoundCue(building, building.sounds?.collapse ?? SOUND_CUES.building.collapse, { profile: 'building' })
    }
    if (building.selected && player) {
      player.unselectAll()
    }

    for (const unit of building.owner.units ?? []) {
      if (unit.homeHouseLabel === building.label) {
        delete unit.homeHouseLabel
        delete unit.homeBedLabel
      }
    }
    this.removeOwnerReferences()
    reconcileHouseholds(building.owner)
    const footprintCells = getBuildingFootprintCells(building.i, building.j, grid, building.size, undefined, building.type)
    building.showDestruction(footprintCells.map(cell =>
      cell.zIndex == null ? { x: cell.x, y: cell.y } : { x: cell.x, y: cell.y, zIndex: cell.zIndex }
    ))
    updateInstanceVisibility(building)
    getBuildingFootprintCells(
      building.i,
      building.j,
      grid,
      building.size,
      (cell: RuntimeCell) => {
        removeFurnitureSurface(cell, building)
        if (cell.has === building) {
          cell.has = null
          cell.solid = false
        }
        return true
      },
      building.type
    )
    adjacentWalls.forEach(wall => updateWallTexture(wall))
    building.startTimeout(() => building.clear(), BUILDING_DESTRUCTION_CLEAR_MS)
    canUpdateMinimap(building, player) &&
      menu.isMiniMapActive?.() !== false &&
      menu.updatePlayerMiniMapEvt(building.owner)
    building.context.checkDefeat?.()
  }

  private removePopulationCapacity(): void {
    const building = this.building
    const { menu } = building.context
    refreshPopulationCapacity(building.owner)
    if (building.owner.isPlayed) {
      menu.updateTopbar?.()
    }
  }

  private removeOwnerReferences(): void {
    const building = this.building
    const { players } = building.context
    const index = building.owner.buildings.indexOf(building)
    if (index >= 0) {
      building.owner.buildings.splice(index, 1)
    }

    for (const otherPlayer of players) {
      if (isAIControlledPlayer(otherPlayer)) {
        otherPlayer.foundedEnemyBuildings?.delete(building)
      }
    }
  }

  clear(): void {
    const building = this.building
    if (building.isDestroyed) return
    clearTimeout(building.visibilityTimeout)
    stopFlameAmbientSound(building)
    const {
      context: { map },
    } = building
    const space = getEntityMapSpace(building, map)
    getBuildingFootprintCells(
      building.i,
      building.j,
      space?.grid ?? map.grid,
      building.size,
      (cell: RuntimeCell) => {
        removeFurnitureSurface(cell, building)
        cell.corpses.delete(building)
        return true
      },
      building.type
    )
    building.isDestroyed = true
    building.destroy({ children: true, texture: false })
  }
}
