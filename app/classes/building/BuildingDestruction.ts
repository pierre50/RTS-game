import { reconcileHouseholds } from '../../lib/housing/households'
import { canHeroDemolishBuilding, getFurnitureContainer } from '../../lib/buildings/buildingDemolition'
import { isInteriorFurniture } from '../../lib/buildings/interiorFurnitureCatalog'
import { removeFurnitureSurface } from '../../lib/terrain/furnitureSurface'
import { notifyVillageStateChanged } from '../../lib/units/villageStateEvents'
import { definedProperties } from '../../lib/definedProperties'
import { LABEL_TYPES, MENU_INFO_IDS, POPULATION_MAX, SOUND_CUES } from '../../constants'
import {
  canUpdateMinimap,
  getBuildingFootprintCells,
  isAIControlledPlayer,
  playAudibleSoundCue,
  spawnSpriteFragmentBurst,
  type SpriteFragmentBurstGroundTarget,
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
import { CAMPFIRE_DECORATION_LABEL, CAMPFIRE_SMOKE_DECORATION_LABEL, stopFlameAmbientSound } from './BuildingFire'
import type { BuildingControllerHost } from './BuildingTypes'
import { clearBuildingConstructionReveal } from './BuildingVisuals'

const BUILDING_DESTRUCTION_CLEAR_MS = 940

export class BuildingDestruction {
  constructor(private readonly building: BuildingControllerHost) {}

  private spawnDestructionBurst(): void {
    const building = this.building
    const space = getEntityMapSpace(building, building.context.map)
    const footprintCells = getBuildingFootprintCells(
      building.i,
      building.j,
      space?.grid ?? building.context.map.grid,
      building.size,
      undefined,
      building.type
    )
    const groundTargets: SpriteFragmentBurstGroundTarget[] = footprintCells.map(cell =>
      definedProperties({
        x: cell.x,
        y: cell.y,
        zIndex: cell.zIndex,
      })
    )
    const footprintArea = Math.max(1, footprintCells.length)
    spawnSpriteFragmentBurst({
      context: building.context,
      host: building,
      sprite: building.sprite,
      layer: building.parent,
      fragmentSize: 14,
      maxFragments: Math.min(96, 28 + footprintArea * 8),
      durationMs: BUILDING_DESTRUCTION_CLEAR_MS,
      gravity: 0.0026,
      minSpeed: 0.014,
      maxSpeed: 0.09,
      upwardVelocity: 0.045,
      settleToBottom: true,
      lockX: true,
      groundTargets,
      settleSpread: Math.max(34, Math.sqrt(footprintArea) * 24),
      settleStrength: 0.00006,
      groundBounce: 0.09,
    })
  }

  private clearDestroyedSprite(): void {
    const building = this.building
    building.sprite.eventMode = 'none'
    building.sprite.visible = false
    building.sprite.parent?.removeChild(building.sprite)
    building.sprite.destroy({ children: true, texture: false })
    building.shadow?.parent?.removeChild(building.shadow)
    building.shadow?.destroy({ children: true, texture: false })
    building.shadow = null
  }

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
    this.destroyDecorations()

    // Fragments must not inherit the construction ghost's transparency or tint.
    clearBuildingConstructionReveal(building)
    this.spawnDestructionBurst()
    updateInstanceVisibility(building)
    this.clearDestroyedSprite()
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
      if (building.owner.selectedBuilding?.displayPopulation)
        menu.updateInfo(
          MENU_INFO_IDS.populationText,
          building.owner.population + '/' + Math.min(POPULATION_MAX, building.owner.populationMax)
        )
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

  private destroyDecorations(): void {
    const building = this.building
    for (const label of [
      LABEL_TYPES.color,
      LABEL_TYPES.deco,
      LABEL_TYPES.fire,
      CAMPFIRE_DECORATION_LABEL,
      CAMPFIRE_SMOKE_DECORATION_LABEL,
    ]) {
      building.getChildByLabel(label)?.destroy()
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
    building.parent?.removeChild(building)
    building.destroy({ children: true, texture: false })
  }
}
