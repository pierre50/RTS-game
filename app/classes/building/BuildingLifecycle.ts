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
  getPlainCellsAroundPoint,
  getBuildingFootprintRadius,
  getTexture,
  getTextureByFrame,
  getTextureSheet,
  updateInstanceVisibility,
  bindAnimatedSpriteToTicker,
  getAnimationFrames,
  isPlayerEliminated,
  playAudibleSoundCue,
  playSoundCue,
} from '../../lib'
import { getAdjacentWalls, isWall, updateWallAndNeighbours, updateWallTexture } from '../../lib/buildings/walls'
import { getTowerType, isTower } from '../../lib/buildings/towers'
import type { RuntimeCell } from '../../types/map'
import type { Building } from './index'
import type { Texture } from 'pixi.js'

type RuntimeAnimatedSprite = AnimatedSprite
type RuntimeContainer = Container
type BuildingTexture = Texture & { hitArea?: number[]; defaultAnchor?: { x: number; y: number } }

const BUILDING_FIRE_SHEETS = {
  light: 'effects/fire/light',
  medium: 'effects/fire/medium',
  heavy: 'effects/fire/heavy',
} as const

export class BuildingLifecycle {
  building: Building

  constructor(building: Building) {
    this.building = building
  }

  updateTexture(): void {
    const building = this.building
    const {
      context: { menu },
    } = building
    const percentage = getPercentage(building.hitPoints, building.totalHitPoints)
    const buildSpritesheetId =
      building.type === BUILDING_TYPES.dock
        ? 'buildings/construction/dock'
        : getTextureSheet(getBuildingTextureNameWithSize(building.size)!)

    if (percentage >= 25 && percentage < 50) {
      building.sprite.texture = getTextureByFrame(buildSpritesheetId, 1, Assets)
    } else if (percentage >= 50 && percentage < 75) {
      building.sprite.texture = getTextureByFrame(buildSpritesheetId, 2, Assets)
    } else if (percentage >= 75 && percentage < 99) {
      building.sprite.texture = getTextureByFrame(buildSpritesheetId, 3, Assets)
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
        menu.setBottombar(building)
      }
      updateInstanceVisibility(building)
    }
  }

  finalTexture(): void {
    const building = this.building
    const assetOwner = getBuildingAssetOwner(building)
    const effectiveType = building.assetType || (isTower(building) ? getTowerType(building.owner) : building.type)
    const assets = getBuildingAsset(effectiveType, assetOwner, Assets)
    const texture = getTexture(assets.images!.final as string, Assets) as BuildingTexture
    building.sprite.texture = texture
    building.sprite.hitArea = texture.hitArea
      ? new Polygon(texture.hitArea)
      : new Polygon([-32 * building.size, 0, 0, -16 * building.size, 32 * building.size, 0, 0, 16 * building.size])
    building.sprite.anchor.set(texture.defaultAnchor!.x, texture.defaultAnchor!.y)

    const color = building.getChildByLabel(LABEL_TYPES.color)
    if (color) color.destroy()
    changeSpriteColorDirectly(building.sprite, building.owner.color ?? '')
    if (isWall(building)) updateWallAndNeighbours(building)

    if (building.type === BUILDING_TYPES.townCenter) {
      if (assetOwner.age === 0) {
        const spritesheetFire = Assets.cache.get(BUILDING_FIRE_SHEETS.light)
        const spriteFire = new AnimatedSprite(
          getAnimationFrames(spritesheetFire.textures) as Texture[]
        ) as RuntimeAnimatedSprite
        bindAnimatedSpriteToTicker(spriteFire, building.context.app)
        spriteFire.label = LABEL_TYPES.deco
        spriteFire.eventMode = 'none'
        spriteFire.roundPixels = true
        spriteFire.x = 12
        spriteFire.y = 25
        spriteFire.play()
        spriteFire.animationSpeed = 0.2
        building.addChild(spriteFire)
      } else {
        const fire = building.getChildByLabel(LABEL_TYPES.deco)
        if (fire) fire.destroy()
      }
    }
  }

  generateFire(spriteId: string): void {
    const building = this.building
    const fire = building.getChildByLabel(LABEL_TYPES.fire)
    const spritesheetFire = Assets.cache.get(spriteId)
    if (fire) {
      for (let i = 0; i < fire.children.length; i++) {
        const child = fire.children[i] as AnimatedSprite
        child.textures = getAnimationFrames(spritesheetFire.textures) as Texture[]
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
        ) as RuntimeAnimatedSprite
        bindAnimatedSpriteToTicker(spriteFire, building.context.app)
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
      menu.setBottombar(building)
    }
  }

  updateHitPoints(action: string): void {
    const building = this.building
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
      if (percentage > 0 && percentage < 25) {
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
    const fire = building.getChildByLabel(LABEL_TYPES.fire)
    if (fire) fire.children.forEach(sprite => (sprite as AnimatedSprite).stop())
    const deco = building.getChildByLabel(LABEL_TYPES.deco)
    const stoppableDeco = deco as { stop?: () => void } | null
    stoppableDeco?.stop?.()
  }

  resume(): void {
    const building = this.building
    const fire = building.getChildByLabel(LABEL_TYPES.fire)
    if (fire) fire.children.forEach(sprite => (sprite as AnimatedSprite).play())
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
      if (isPlayerEliminated(building.owner)) {
        menu.updatePlayerStats()
      }
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

    let rubbleSheet = getBuildingRubbleTextureNameWithSize(building.size)
    if (building.type === BUILDING_TYPES.farm) {
      rubbleSheet = { sheet: 'buildings/rubble/farm-depleted', frame: 0 }
    } else if (building.type === BUILDING_TYPES.dock) {
      rubbleSheet = { sheet: 'buildings/rubble/dock', frame: 0 }
    }
    building.sprite.texture = getTexture(rubbleSheet!, Assets)
    building.sprite.eventMode = 'none'
    building.zIndex--
    if (building.type === BUILDING_TYPES.farm) {
      changeSpriteColorDirectly(building.sprite, building.owner.color ?? '')
    }

    updateInstanceVisibility(building)
    const dist = getBuildingFootprintRadius(building.size)
    getPlainCellsAroundPoint(building.i, building.j, map.grid, dist, ((cell: RuntimeCell) => {
      if (cell.has === building) {
        cell.has = null
        cell.solid = false
        cell.corpses.add(building)
      }
      return true
    }))
    adjacentWalls.forEach(wall => updateWallTexture(wall))
    building.startTimeout(() => building.clear(), RUBBLE_TIME)
    canUpdateMinimap(building, player) && menu.updatePlayerMiniMapEvt(building.owner)
    building.context.checkVictory?.()
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
    const dist = getBuildingFootprintRadius(building.size)
    getPlainCellsAroundPoint(building.i, building.j, map.grid, dist, ((cell: RuntimeCell) => {
      cell.corpses.delete(building)
      return true
    }))
    building.isDestroyed = true
    building.destroy({ children: true, texture: false })
  }
}
