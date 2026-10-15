import { syncHouseInteriorSpace } from '../../services/BuildingInteriorSpaceSystem'
import { constructionProgressPercentage } from '../../lib/economy/constructionMaterials'
import { reconcileHouseholds } from '../../lib/housing/households'
import { syncEntityHealthDisplay } from '../../lib/entities/entityHealthDisplay'
import { completeBuildingUpgrade } from '../../lib/buildings/buildingUpgrade'
import { notifyVillageWorkChanged } from '../../lib/units/village/villageWorkEvents'
import { notifyVillageStateChanged } from '../../lib/units/village/villageStateEvents'
import { finishSowingTile } from './BuildingSowing'
import { wakeDistantOwner } from '../../lib/units/village/villageActivity'
import { ACTION_TYPES } from '../../constants'
import { getPercentage, updateInstanceVisibility } from '../../lib'
import { refreshPopulationCapacity } from '../../lib/buildings/buildingOccupancy'
import { BuildingDestruction } from './BuildingDestruction'
import { applyBuildingFinalTexture } from './BuildingFinalTexture'
import {
  type FireAnimation,
  generateBuildingFire,
  hasBuildingFlameVisual,
  pauseBuildingVisuals,
  playBuildingBurningSound,
  resumeBuildingVisuals,
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
    if (building.isDead || building.isDestroyed) return
    const {
      context: { menu },
    } = building
    if (building.buildingUpgrade || building.constructionPaused) {
      syncBuildingConstructionReveal(building, constructionProgressPercentage(building))
      building.updateShadow()
      return
    }
    const percentage = constructionProgressPercentage(building)
    if (building.type === 'Farm' && percentage >= 100) {
      finishSowingTile(building)
      return
    }

    if (percentage < 100) {
      syncBuildingConstructionReveal(building, percentage)
    } else {
      const wasBuilt = building.isBuilt
      building.isBuilt = true
      notifyVillageStateChanged(building.owner)
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
      if (!wasBuilt) {
        building.scanForInitialTarget()
        building.context.unitRest?.notifyBedAvailable?.(building)
      }
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
    if (building.isDead || building.isDestroyed) return
    const {
      context: { menu },
    } = building
    reconcileHouseholds(building.owner)
    refreshPopulationCapacity(building.owner, building)
    if (building.owner.isPlayed) {
      menu.updateTopbar?.()
    }
    if (building.owner.isPlayed && building.selected) {
      menu.setActionTarget(building)
    }
  }

  updateHitPoints(action: string): void {
    const building = this.building
    if (action === ACTION_TYPES.attack) wakeDistantOwner(building.owner)
    // Invulnerability must not skip construction progress or its completion effects.
    if (building.indestructible && action !== ACTION_TYPES.build) {
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
    if (action === ACTION_TYPES.build && building.buildingUpgrade && !building.isDead) {
      if (completeBuildingUpgrade(building, building.owner.config.buildings[building.type])) {
        syncHouseInteriorSpace(building.context, building)
        reconcileHouseholds(building.owner)
        refreshPopulationCapacity(building.owner)
        building.finalTexture()
        building.scanForInitialTarget?.()
        syncEntityHealthDisplay(building, { menu: building.context.menu, player: building.owner })
        building.context.unitRest?.notifyBedAvailable?.(building)
        notifyVillageWorkChanged(building.owner)
        notifyVillageStateChanged(building.owner)
        building.context.menu.updateTopbar?.()
      } else building.updateTexture()
    } else if (action === ACTION_TYPES.build && !building.isBuilt) {
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
    this.spriteWasPlayingBeforePause = pauseBuildingVisuals(building)
    stopFlameAmbientSound(building)
  }

  resume(): void {
    const building = this.building
    resumeBuildingVisuals(building, this.spriteWasPlayingBeforePause)
    this.spriteWasPlayingBeforePause = false
    if (hasBuildingFlameVisual(building) && building.isBuilt && !building.isDead && !building.isDestroyed) {
      startFlameAmbientSound(building)
    }
  }

  die(demolition = false): void {
    new BuildingDestruction(this.building).die(demolition)
  }

  clear(): void {
    new BuildingDestruction(this.building).clear()
  }
}
