import { definedProperties } from '../../lib/definedProperties'
import { BUILDING_TYPES, LABEL_TYPES, MENU_INFO_IDS, POPULATION_MAX, SOUND_CUES } from '../../constants'
import {
  canUpdateMinimap,
  getBuildingFootprintCells,
  isAIControlledPlayer,
  playAudibleSoundCue,
  spawnSpriteFragmentBurst,
  type SpriteFragmentBurstGroundTarget,
  updateInstanceVisibility,
} from '../../lib'
import { getBuildingShelterCapacity } from '../../lib/buildings/buildingOccupancy'
import { getAdjacentWalls, isWall, updateWallTexture } from '../../lib/buildings/walls'
import { getEntityMapSpace } from '../../lib/mapSpaces'
import {
  expelBuildingInteriorOccupants,
  extractBuildingInteriorChestInventory,
} from '../../services/BuildingInteriorSpaceSystem'
import type { BuildingEntity } from '../../types/entities'
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
      building.size
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

  private spawnRuinsChest(inventory: BuildingEntity['inventory'] | null): void {
    const building = this.building
    if (!inventory || !building.owner?.createBuilding) return
    const space = getEntityMapSpace(building, building.context.map)
    const grid = space?.grid ?? building.context.map.grid
    const footprintCells = getBuildingFootprintCells(building.i, building.j, grid, building.size)
    const centerI = building.i
    const centerJ = building.j
    const cell = footprintCells
      .filter(candidate => {
        if (candidate.terrainHidden || candidate.border || candidate.waterBorder || candidate.category === 'Water')
          return false
        return !candidate.solid && !candidate.has
      })
      .sort((a, b) => {
        const aDistance = Math.abs(a.i - centerI) + Math.abs(a.j - centerJ)
        const bDistance = Math.abs(b.i - centerI) + Math.abs(b.j - centerJ)
        return aDistance - bDistance
      })[0]
    if (!cell) return

    building.owner.createBuilding({
      i: cell.i,
      j: cell.j,
      type: BUILDING_TYPES.chest,
      isBuilt: true,
      skipBuiltEffects: true,
      label: `${building.label}:ruins:storage-chest`,
      inventory,
    })
  }

  private clearDestroyedSprite(): void {
    const building = this.building
    clearBuildingConstructionReveal(building)
    building.sprite.eventMode = 'none'
    building.sprite.visible = false
    building.sprite.parent?.removeChild(building.sprite)
    building.sprite.destroy({ children: true, texture: false })
    building.shadow?.parent?.removeChild(building.shadow)
    building.shadow?.destroy({ children: true, texture: false })
    building.shadow = null
  }

  die(): void {
    const building = this.building
    if (building.isDead || building.indestructible) return
    const {
      context: { map, player, menu },
    } = building
    const space = getEntityMapSpace(building, map)
    const grid = space?.grid ?? map.grid
    const adjacentWalls = isWall(building) ? getAdjacentWalls(grid, building.i, building.j, building.owner) : []
    clearTimeout(building.visibilityTimeout)
    building.stopInterval()
    building.clearRallyPoint()
    const ruinsChestInventory = extractBuildingInteriorChestInventory(building.context, building)
    building.cancelAllUnitTraining?.()
    expelBuildingInteriorOccupants(building.context, building)
    if (building.context.controls.rallyPointController?.building === building) {
      building.context.controls.rallyPointController.cancel()
    }
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

    this.removeOwnerReferences()
    this.destroyDecorations()

    this.spawnDestructionBurst()
    updateInstanceVisibility(building)
    this.clearDestroyedSprite()
    getBuildingFootprintCells(building.i, building.j, grid, building.size, (cell: RuntimeCell) => {
      if (cell.has === building) {
        cell.has = null
        cell.solid = false
      }
      return true
    })
    this.spawnRuinsChest(ruinsChestInventory)
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
    const populationCapacity = getBuildingShelterCapacity(building) || building.increasePopulation || 0
    if (populationCapacity && building.populationCapacityApplied) {
      building.owner.populationMax = Math.max(0, building.owner.populationMax - populationCapacity)
      building.populationCapacityApplied = false
      if (building.owner.isPlayed && building.owner.selectedBuilding?.displayPopulation) {
        menu.updateInfo(
          MENU_INFO_IDS.populationText,
          building.owner.population + '/' + Math.min(POPULATION_MAX, building.owner.populationMax)
        )
      }
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
    building.clearRallyPoint()
    const {
      context: { map },
    } = building
    const space = getEntityMapSpace(building, map)
    getBuildingFootprintCells(building.i, building.j, space?.grid ?? map.grid, building.size, (cell: RuntimeCell) => {
      cell.corpses.delete(building)
      return true
    })
    building.isDestroyed = true
    building.parent?.removeChild(building)
    building.destroy({ children: true, texture: false })
  }
}
