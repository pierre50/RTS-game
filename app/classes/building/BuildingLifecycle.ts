import { AnimatedSprite } from 'pixi.js'
import { ACTION_TYPES, LABEL_TYPES, MENU_INFO_IDS, POPULATION_MAX } from '../../constants'
import { getPercentage, updateInstanceVisibility } from '../../lib'
import { getBuildingShelterCapacity } from '../../lib/buildings/buildingOccupancy'
import { BuildingDestruction } from './BuildingDestruction'
import { applyBuildingFinalTexture } from './BuildingFinalTexture'
import {
  CAMPFIRE_DECORATION_LABEL,
  CAMPFIRE_SMOKE_DECORATION_LABEL,
  type FireAnimation,
  generateBuildingFire,
  hasBuildingFlameVisual,
  playBuildingBurningSound,
  startFlameAmbientSound,
  stopFlameAmbientSound,
  syncBuildingCampfireDecoration,
  updateBuildingFireDamage,
} from './BuildingFire'
import type { BuildingControllerHost } from './BuildingTypes'
import { clearBuildingConstructionReveal, syncBuildingConstructionReveal } from './BuildingVisuals'

export class BuildingLifecycle {
  building: BuildingControllerHost
  private spriteWasPlayingBeforePause = false

  constructor(building: BuildingControllerHost) {
    this.building = building
  }

  updateTexture(): void {
    const building = this.building
    const {
      context: { menu },
    } = building
    const percentage = getPercentage(building.hitPoints, building.totalHitPoints)

    if (percentage < 100) {
      syncBuildingConstructionReveal(building, percentage)
    } else {
      const wasBuilt = building.isBuilt
      building.isBuilt = true
      clearBuildingConstructionReveal(building)
      building.finalTexture()
      if (!wasBuilt) {
        building.onBuilt()
      }
      if (building.owner.hasBuilt && !building.owner.hasBuilt.includes(building.type)) {
        building.owner.hasBuilt.push(building.type)
      }
      if (building.owner.isPlayed && building.selected) {
        menu.setActionTarget(building)
      }
      updateInstanceVisibility(building)
      if (!wasBuilt) building.scanForInitialTarget()
    }
    building.updateShadow()
  }

  finalTexture(): void {
    applyBuildingFinalTexture(this.building)
  }

  syncCampfireDecoration(): void {
    syncBuildingCampfireDecoration(this.building)
  }

  generateFire(spriteId: FireAnimation): void {
    generateBuildingFire(this.building, spriteId)
  }

  onBuilt(): void {
    const building = this.building
    building.owner.updatePopulationObjectives?.()
    const {
      context: { menu },
    } = building
    const populationCapacity = getBuildingShelterCapacity(building) || building.increasePopulation || 0
    if (populationCapacity && !building.populationCapacityApplied) {
      building.owner.populationMax += populationCapacity
      building.populationCapacityApplied = true
      if (building.owner.isPlayed && building.owner.selectedBuilding?.displayPopulation) {
        menu.updateInfo(
          MENU_INFO_IDS.populationText,
          building.owner.population + '/' + Math.min(POPULATION_MAX, building.owner.populationMax)
        )
      }
    }
    if (building.owner.isPlayed && building.selected) {
      menu.setActionTarget(building)
    }
  }

  updateHitPoints(action: string): void {
    const building = this.building
    if (building.indestructible) {
      building.hitPoints = building.totalHitPoints
      return
    }
    if (building.hitPoints > building.totalHitPoints) {
      building.hitPoints = building.totalHitPoints
    }
    const percentage = getPercentage(building.hitPoints, building.totalHitPoints)

    if (building.hitPoints <= 0) {
      building.die()
    }
    if (action === ACTION_TYPES.build && !building.isBuilt) {
      building.updateTexture()
    } else if (
      (action === ACTION_TYPES.attack && building.isBuilt) ||
      (action === ACTION_TYPES.build && building.isBuilt)
    ) {
      updateBuildingFireDamage(building, percentage)
    }
  }

  playBurningSound(): void {
    playBuildingBurningSound(this.building)
  }

  pause(): void {
    const building = this.building
    const sprite = building.sprite
    this.spriteWasPlayingBeforePause = Boolean(sprite instanceof AnimatedSprite && sprite.playing)
    if (this.spriteWasPlayingBeforePause && sprite instanceof AnimatedSprite) sprite.stop()
    const fire = building.getChildByLabel(LABEL_TYPES.fire)
    if (fire) fire.children.forEach(sprite => (sprite as AnimatedSprite).stop())
    const campfireDecoration = building.getChildByLabel(CAMPFIRE_DECORATION_LABEL) as AnimatedSprite | null
    campfireDecoration?.stop()
    const campfireSmoke = building.getChildByLabel(CAMPFIRE_SMOKE_DECORATION_LABEL) as AnimatedSprite | null
    campfireSmoke?.stop()
    stopFlameAmbientSound(building)
    const deco = building.getChildByLabel(LABEL_TYPES.deco)
    const stoppableDeco = deco as { stop?: () => void } | null
    stoppableDeco?.stop?.()
  }

  resume(): void {
    const building = this.building
    if (this.spriteWasPlayingBeforePause && building.sprite instanceof AnimatedSprite) {
      building.sprite.play()
    }
    this.spriteWasPlayingBeforePause = false
    const fire = building.getChildByLabel(LABEL_TYPES.fire)
    if (fire) fire.children.forEach(sprite => (sprite as AnimatedSprite).play())
    const campfireDecoration = building.getChildByLabel(CAMPFIRE_DECORATION_LABEL) as AnimatedSprite | null
    campfireDecoration?.play()
    const campfireSmoke = building.getChildByLabel(CAMPFIRE_SMOKE_DECORATION_LABEL) as AnimatedSprite | null
    campfireSmoke?.play()
    if (hasBuildingFlameVisual(building) && building.isBuilt && !building.isDead && !building.isDestroyed) {
      startFlameAmbientSound(building)
    }
    const deco = building.getChildByLabel(LABEL_TYPES.deco)
    const playableDeco = deco as { play?: () => void } | null
    playableDeco?.play?.()
  }

  die(): void {
    new BuildingDestruction(this.building).die()
  }

  clear(): void {
    new BuildingDestruction(this.building).clear()
  }
}
