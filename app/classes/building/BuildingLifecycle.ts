import { Assets, AnimatedSprite } from 'pixi.js'
import { Polygon } from 'pixi.js'
import { ACTION_TYPES, LABEL_TYPES, MENU_INFO_IDS, PLAYER_TYPES, POPULATION_MAX, SOUND_CUES } from '../../constants'
import {
  canUpdateMinimap,
  changeSpriteColorDirectly,
  getBuildingAsset,
  getBuildingAssetOwner,
  getBuildingTextureNameWithSize,
  getPercentage,
  getBuildingFootprintCells,
  getTexture,
  getTextureByFrame,
  getTextureSheet,
  textureRefToString,
  updateInstanceVisibility,
  bindAnimatedSpriteToTicker,
  getAnimationFrames,
  playAudibleSoundCue,
  spawnSpriteFragmentBurst,
} from '../../lib'
import { getEntityMapSpace } from '../../lib/mapSpaces'
import { getAdjacentWalls, isWall, updateWallAndNeighbours, updateWallTexture } from '../../lib/buildings/walls'
import { getBuildingShelterCapacity } from '../../lib/buildings/buildingOccupancy'
import type { RuntimeCell } from '../../types/map'
import type { BuildingControllerHost } from './BuildingTypes'
import type { Texture } from 'pixi.js'
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

type BuildingTexture = Texture & { hitArea?: number[]; defaultAnchor?: { x: number; y: number } }
type BuildingSpritesheetData = { animationSpeed?: number; loop?: boolean }
const BUILDING_DESTRUCTION_CLEAR_MS = 940

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
    const buildSpritesheetId = getTextureSheet(getBuildingTextureNameWithSize(building.size)!)

    if (percentage >= 33 && percentage < 66) {
      building.textureName = textureRefToString({ sheet: buildSpritesheetId, frame: 1 })
      building.sprite.texture = getTextureByFrame(buildSpritesheetId, 1, Assets)
    } else if (percentage >= 66 && percentage < 99) {
      building.textureName = textureRefToString({ sheet: buildSpritesheetId, frame: 2 })
      building.sprite.texture = getTextureByFrame(buildSpritesheetId, 2, Assets)
    } else if (percentage >= 100) {
      const wasBuilt = building.isBuilt
      building.isBuilt = true
      building.finalTexture()
      if (!wasBuilt) {
        if (
          building.owner.isPlayed &&
          building.sounds?.create &&
          building.context.controls.instanceIsAudible(building)
        ) {
          playAudibleSoundCue(building, building.sounds.create, { profile: 'building' })
        }
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
    const building = this.building
    const assetOwner = getBuildingAssetOwner(building)
    const effectiveType = building.assetType || building.type
    const assets = getBuildingAsset(effectiveType, assetOwner, Assets)
    const finalTextureRef = assets.images!.final!
    const finalSheetId = getTextureSheet(finalTextureRef)
    const spritesheet = Assets.cache.get(finalSheetId)
    const shouldAnimate = assets.animated === true
    const frames = shouldAnimate && spritesheet?.textures ? (getAnimationFrames(spritesheet.textures) as Texture[]) : []
    const texture = getTexture(finalTextureRef, Assets) as BuildingTexture
    building.textureName = textureRefToString(finalTextureRef)

    if (frames.length > 1 && !(building.sprite instanceof AnimatedSprite)) {
      const oldSprite = building.sprite
      const childIndex = building.getChildIndex(oldSprite)
      const animatedSprite = new AnimatedSprite(frames)
      bindAnimatedSpriteToTicker(animatedSprite, building.context.app)
      animatedSprite.label = oldSprite.label
      animatedSprite.eventMode = oldSprite.eventMode
      animatedSprite.roundPixels = oldSprite.roundPixels
      animatedSprite.position.copyFrom(oldSprite.position)
      animatedSprite.scale.copyFrom(oldSprite.scale)
      ;(animatedSprite as AnimatedSprite & { updateAnchor?: boolean }).updateAnchor = true
      building.removeChild(oldSprite)
      oldSprite.destroy({ children: true, texture: false })
      building.sprite = animatedSprite
      building.addChildAt(animatedSprite, Math.max(0, childIndex))
      building.bindSpriteInteractions()
    }

    if (building.sprite instanceof AnimatedSprite && frames.length > 1) {
      const data = (spritesheet?.data ?? {}) as BuildingSpritesheetData
      building.sprite.textures = frames
      building.sprite.loop = data.loop ?? true
      building.sprite.animationSpeed = data.animationSpeed ?? 0.2
      building.sprite.gotoAndPlay(0)
    }

    building.sprite.texture = texture
    building.sprite.hitArea = texture.hitArea
      ? new Polygon(texture.hitArea)
      : new Polygon([-32 * building.size, 0, 0, -16 * building.size, 32 * building.size, 0, 0, 16 * building.size])
    building.sprite.anchor.set(texture.defaultAnchor!.x, texture.defaultAnchor!.y)
    building.updateShadow()

    const color = building.getChildByLabel(LABEL_TYPES.color)
    if (color) color.destroy()
    changeSpriteColorDirectly(building.sprite, building.owner.color ?? '')
    syncBuildingCampfireDecoration(building)
    if (isWall(building)) updateWallAndNeighbours(building)
  }

  syncCampfireDecoration(): void {
    syncBuildingCampfireDecoration(this.building)
  }

  generateFire(spriteId: FireAnimation): void {
    generateBuildingFire(this.building, spriteId)
  }

  onBuilt(): void {
    const building = this.building
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
    if (building.hitPoints > building.totalHitPoints) {
      building.hitPoints = building.totalHitPoints
    }
    const percentage = getPercentage(building.hitPoints, building.totalHitPoints)

    if (building.hitPoints <= 0) {
      building.context.unitRest?.evacuateUnitsFromShelter(building, { force: true })
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

  private spawnDestructionBurst(): void {
    const building = this.building
    spawnSpriteFragmentBurst({
      context: building.context,
      host: building,
      sprite: building.sprite,
      layer: building.parent,
      fragmentSize: 14,
      maxFragments: 52,
      durationMs: BUILDING_DESTRUCTION_CLEAR_MS,
      gravity: 0.0026,
      minSpeed: 0.014,
      maxSpeed: 0.09,
      upwardVelocity: 0.045,
      settleToBottom: true,
      settleSpread: 34,
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

  die(): void {
    const building = this.building
    if (building.isDead) return
    const {
      context: { map, player, players, menu },
    } = building
    const space = getEntityMapSpace(building, map)
    const grid = space?.grid ?? map.grid
    const adjacentWalls = isWall(building) ? getAdjacentWalls(grid, building.i, building.j, building.owner) : []
    clearTimeout(building.visibilityTimeout)
    building.stopInterval()
    building.clearRallyPoint()
    if (building.context.controls.rallyPointController?.building === building) {
      building.context.controls.rallyPointController.cancel()
    }
    building.isDead = true
    building.hasActiveBurningSound = false
    stopFlameAmbientSound(building)
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
    map.removeFromInstanceBucket(building)
    if (building.context.controls.instanceIsAudible(building)) {
      playAudibleSoundCue(building, building.sounds?.collapse ?? SOUND_CUES.building.collapse, { profile: 'building' })
    }
    if (building.selected && player) {
      player.unselectAll()
    }

    const index = building.owner.buildings.indexOf(building)
    if (index >= 0) {
      building.owner.buildings.splice(index, 1)
    }

    for (let i = 0; i < players.length; i++) {
      if (players[i].type === PLAYER_TYPES.ai) {
        players[i].foundedEnemyBuildings?.delete(building)
      }
    }
    const color = building.getChildByLabel(LABEL_TYPES.color)
    color && color.destroy()
    const deco = building.getChildByLabel(LABEL_TYPES.deco)
    deco && deco.destroy()
    const fire = building.getChildByLabel(LABEL_TYPES.fire)
    fire && fire.destroy()
    const campfireDecoration = building.getChildByLabel(CAMPFIRE_DECORATION_LABEL)
    campfireDecoration && campfireDecoration.destroy()
    const campfireSmokeDecoration = building.getChildByLabel(CAMPFIRE_SMOKE_DECORATION_LABEL)
    campfireSmokeDecoration && campfireSmokeDecoration.destroy()

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
    adjacentWalls.forEach(wall => updateWallTexture(wall))
    building.startTimeout(() => building.clear(), BUILDING_DESTRUCTION_CLEAR_MS)
    canUpdateMinimap(building, player) &&
      menu.isMiniMapActive?.() !== false &&
      menu.updatePlayerMiniMapEvt(building.owner)
    building.context.checkDefeat?.()
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
