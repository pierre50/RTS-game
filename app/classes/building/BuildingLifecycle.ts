import { Assets, AnimatedSprite, Container } from 'pixi.js'
import { Polygon } from 'pixi.js'
import {
  ACTION_TYPES,
  BUILDING_TYPES,
  LABEL_TYPES,
  MENU_INFO_IDS,
  PLAYER_TYPES,
  POPULATION_MAX,
  RUBBLE_TIME,
  SOUND_CUES,
} from '../../constants'
import {
  canUpdateMinimap,
  changeSpriteColorDirectly,
  getBuildingAsset,
  getBuildingAssetOwner,
  getBuildingTextureNameWithSize,
  getBuildingRubbleTextureNameWithSize,
  getPercentage,
  getBuildingFootprintCells,
  getBuildingFootprintRadius,
  getTexture,
  getTextureByFrame,
  getTextureSheet,
  textureRefToString,
  updateInstanceVisibility,
  bindAnimatedSpriteToTicker,
  getAnimationFrames,
  playAudibleSoundCue,
  playSoundCue,
} from '../../lib'
import { getAdjacentWalls, isWall, updateWallAndNeighbours, updateWallTexture } from '../../lib/buildings/walls'
import type { RuntimeCell } from '../../types/map'
import type { EntityLightSourceConfig } from '../../types/entities'
import type { Building } from './index'
import type { Texture } from 'pixi.js'

type RuntimeAnimatedSprite = AnimatedSprite
type LightedAnimatedSprite = RuntimeAnimatedSprite & { lightSource?: EntityLightSourceConfig }
type RuntimeContainer = Container
type BuildingTexture = Texture & { hitArea?: number[]; defaultAnchor?: { x: number; y: number } }
type BuildingSpritesheetData = { animationSpeed?: number; loop?: boolean }

const BUILDING_FIRE_SHEETS = {
  light: 'effects/fire/light',
  medium: 'effects/fire/medium',
  heavy: 'effects/fire/heavy',
} as const
const CAMPFIRE_DECORATION_LABEL = 'campfireDecorationFire'
const CAMPFIRE_DECORATION_LIGHT: EntityLightSourceConfig = {
  color: '#ffad4f',
  flicker: 0.09,
  intensity: 0.82,
  radius: 150,
  offsetY: -8,
  verticalScale: 0.68,
}
const BUILDING_FIRE_LIGHT: EntityLightSourceConfig = {
  color: '#ff9d45',
  flicker: 0.12,
  intensity: 0.72,
  radius: 120,
  offsetY: -12,
  verticalScale: 0.72,
}

function attachFireLight(sprite: LightedAnimatedSprite, config: EntityLightSourceConfig = BUILDING_FIRE_LIGHT): void {
  sprite.lightSource = config
}

export class BuildingLifecycle {
  building: Building
  private spriteWasPlayingBeforePause = false

  constructor(building: Building) {
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
          playSoundCue(building.sounds.create)
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
      building.sprite.animationSpeed = data.animationSpeed ?? 0.12
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
    this.syncCampfireDecoration()
    if (isWall(building)) updateWallAndNeighbours(building)
  }

  syncCampfireDecoration(): void {
    const building = this.building
    const existing = building.getChildByLabel(CAMPFIRE_DECORATION_LABEL)

    if (building.type !== BUILDING_TYPES.banditCamp) {
      existing?.destroy({ children: true })
      return
    }

    const spritesheetFire = Assets.cache.get(BUILDING_FIRE_SHEETS.light)
    if (!spritesheetFire?.textures) return
    const textures = getAnimationFrames(spritesheetFire.textures) as Texture[]
    if (!textures.length) return

    if (existing instanceof AnimatedSprite) {
      existing.textures = textures
      attachFireLight(existing as LightedAnimatedSprite, CAMPFIRE_DECORATION_LIGHT)
      existing.gotoAndPlay(0)
      return
    }

    existing?.destroy({ children: true })
    const fire = new AnimatedSprite(textures) as LightedAnimatedSprite
    bindAnimatedSpriteToTicker(fire, building.context.app)
    fire.label = CAMPFIRE_DECORATION_LABEL
    attachFireLight(fire, CAMPFIRE_DECORATION_LIGHT)
    fire.eventMode = 'none'
    fire.roundPixels = true
    fire.position.set(0, 10)
    fire.animationSpeed = 0.2
    fire.gotoAndPlay(0)
    building.addChild(fire)
  }

  generateFire(spriteId: string): void {
    const building = this.building
    const fire = building.getChildByLabel(LABEL_TYPES.fire)
    const spritesheetFire = Assets.cache.get(spriteId)
    if (fire) {
      for (let i = 0; i < fire.children.length; i++) {
        const child = fire.children[i] as LightedAnimatedSprite
        child.textures = getAnimationFrames(spritesheetFire.textures) as Texture[]
        attachFireLight(child)
        child.play()
      }
    } else {
      const newFire = new Container() as RuntimeContainer
      newFire.label = LABEL_TYPES.fire
      newFire.eventMode = 'none'
      let poses: number[][] = [[0, 0]]
      const radius = getBuildingFootprintRadius(building.size)
      if (radius > 0) {
        poses = [
          [0, -32 * radius],
          [-64 * radius, 0],
          [0, 32 * radius],
          [64 * radius, 0],
        ]
      }
      for (let i = 0; i < poses.length; i++) {
        const spriteFire = new AnimatedSprite(
          getAnimationFrames(spritesheetFire.textures) as Texture[]
        ) as LightedAnimatedSprite
        bindAnimatedSpriteToTicker(spriteFire, building.context.app)
        attachFireLight(spriteFire)
        spriteFire.eventMode = 'none'
        spriteFire.roundPixels = true
        spriteFire.x = poses[i][0]
        spriteFire.y = poses[i][1]
        spriteFire.play()
        spriteFire.animationSpeed = 0.2
        newFire.addChild(spriteFire)
      }
      building.addChild(newFire)
    }
  }

  onBuilt(): void {
    const building = this.building
    const {
      context: { menu },
    } = building
    if (building.increasePopulation && !building.populationCapacityApplied) {
      building.owner.populationMax += building.increasePopulation
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
      building.context.villagerShelter?.evacuateVillagersFromShelter(building, { force: true })
      building.die()
    }
    if (action === ACTION_TYPES.build && !building.isBuilt) {
      building.updateTexture()
    } else if (
      (action === ACTION_TYPES.attack && building.isBuilt) ||
      (action === ACTION_TYPES.build && building.isBuilt)
    ) {
      if (percentage > 0 && percentage < 25) {
        building.context.villagerShelter?.evacuateVillagersIfShelterUnsafe(building)
        this.playBurningSound()
        building.generateFire(BUILDING_FIRE_SHEETS.heavy)
      } else if (percentage >= 25 && percentage < 50) {
        this.playBurningSound()
        building.generateFire(BUILDING_FIRE_SHEETS.medium)
      } else if (percentage >= 50 && percentage < 75) {
        this.playBurningSound()
        building.generateFire(BUILDING_FIRE_SHEETS.light)
      } else if (percentage >= 75) {
        const fire = building.getChildByLabel(LABEL_TYPES.fire)
        if (fire) building.removeChild(fire)
        building.hasActiveBurningSound = false
      }
    }
  }

  playBurningSound(): void {
    const building = this.building
    if (building.hasActiveBurningSound || !building.context.controls.instanceIsAudible(building)) return
    building.hasActiveBurningSound = true
    playSoundCue(building.sounds?.burning ?? SOUND_CUES.building.burning)
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
    const deco = building.getChildByLabel(LABEL_TYPES.deco)
    const playableDeco = deco as { play?: () => void } | null
    playableDeco?.play?.()
  }

  die(): void {
    const building = this.building
    if (building.isDead) return
    const {
      context: { map, player, players, menu },
    } = building
    const adjacentWalls = isWall(building) ? getAdjacentWalls(map.grid, building.i, building.j, building.owner) : []
    clearTimeout(building.visibilityTimeout)
    building.stopInterval()
    building.clearRallyPoint()
    if (building.context.controls.rallyPointController?.building === building) {
      building.context.controls.rallyPointController.cancel()
    }
    building.isDead = true
    building.hasActiveBurningSound = false
    if (building.increasePopulation && building.populationCapacityApplied) {
      building.owner.populationMax = Math.max(0, building.owner.populationMax - building.increasePopulation)
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
      playAudibleSoundCue(building, building.sounds?.collapse ?? SOUND_CUES.building.collapse)
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

    const rubbleSheet = getBuildingRubbleTextureNameWithSize(building.size)
    building.textureName = textureRefToString(rubbleSheet!)
    building.sprite.texture = getTexture(rubbleSheet!, Assets)
    building.sprite.eventMode = 'none'
    const footprintRadius = getBuildingFootprintRadius(building.size)
    building.zIndex = building.i + building.j - footprintRadius * 2 - 0.1
    building.updateShadow()

    updateInstanceVisibility(building)
    getBuildingFootprintCells(building.i, building.j, map.grid, building.size, (cell: RuntimeCell) => {
      if (cell.has === building) {
        cell.has = null
        cell.solid = false
        cell.corpses.add(building)
      }
      return true
    })
    adjacentWalls.forEach(wall => updateWallTexture(wall))
    building.startTimeout(() => building.clear(), RUBBLE_TIME)
    canUpdateMinimap(building, player) && menu.updatePlayerMiniMapEvt(building.owner)
    building.context.checkDefeat?.()
  }

  clear(): void {
    const building = this.building
    if (building.isDestroyed) return
    clearTimeout(building.visibilityTimeout)
    building.clearRallyPoint()
    const {
      context: { map },
    } = building
    getBuildingFootprintCells(building.i, building.j, map.grid, building.size, (cell: RuntimeCell) => {
      cell.corpses.delete(building)
      return true
    })
    building.isDestroyed = true
    building.destroy({ children: true, texture: false })
  }
}
