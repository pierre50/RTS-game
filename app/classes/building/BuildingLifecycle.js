import { Assets, Sprite, AnimatedSprite, Container } from 'pixi.js'
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
  getBuildingRubbleTextureNameWithSize,
  getPercentage,
  getPlainCellsAroundPoint,
  getTexture,
  updateInstanceVisibility,
  bindAnimatedSpriteToTicker,
  getAnimationFrames,
  isPlayerEliminated,
  playAudibleSoundCue,
  playSoundCue,
} from '../../lib'

export class BuildingLifecycle {
  constructor(building) {
    this.building = building
  }

  updateTexture() {
    const building = this.building
    const {
      context: { menu },
    } = building
    const percentage = getPercentage(building.hitPoints, building.totalHitPoints)
    const buildSpritesheetId = building.sprite.texture.label.split('_')[1].split('.')[0]
    const buildSpritesheet = Assets.cache.get(buildSpritesheetId)

    if (percentage >= 25 && percentage < 50) {
      building.sprite.texture = buildSpritesheet.textures[`001_${buildSpritesheetId}.png`]
    } else if (percentage >= 50 && percentage < 75) {
      building.sprite.texture = buildSpritesheet.textures[`002_${buildSpritesheetId}.png`]
    } else if (percentage >= 75 && percentage < 99) {
      building.sprite.texture = buildSpritesheet.textures[`003_${buildSpritesheetId}.png`]
    } else if (percentage >= 100) {
      building.finalTexture()
      if (!building.isBuilt) {
        if (
          building.owner.isPlayed &&
          building.sounds?.create &&
          building.context.controls.instanceIsAudible(building)
        ) {
          playSoundCue(building.sounds.create)
        }
        building.onBuilt()
      }
      building.isBuilt = true
      if (!building.owner.hasBuilt.includes(building.type)) {
        building.owner.hasBuilt.push(building.type)
      }
      if (building.owner.isPlayed && building.selected) {
        menu.setBottombar(building)
      }
      updateInstanceVisibility(building)
    }
  }

  finalTexture() {
    const building = this.building
    const assets = getBuildingAsset(building.type, building.owner, Assets)
    const texture = getTexture(assets.images.final, Assets)
    building.sprite.texture = texture
    building.sprite.hitArea = texture.hitArea
      ? new Polygon(texture.hitArea)
      : new Polygon([-32 * building.size, 0, 0, -16 * building.size, 32 * building.size, 0, 0, 16 * building.size])
    building.sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)

    const color = building.getChildByLabel(LABEL_TYPES.color)
    if (color) color.destroy()

    if (assets.images.color) {
      const spriteColor = Sprite.from(getTexture(assets.images.color, Assets))
      spriteColor.label = LABEL_TYPES.color
      changeSpriteColorDirectly(spriteColor, building.owner.color)
      building.addChild(spriteColor)
    } else {
      changeSpriteColorDirectly(building.sprite, building.owner.color)
    }

    if (building.type === BUILDING_TYPES.house) {
      if (building.owner.age === 0) {
        const spritesheetFire = Assets.cache.get('347')
        const spriteFire = new AnimatedSprite(getAnimationFrames(spritesheetFire.textures))
        bindAnimatedSpriteToTicker(spriteFire, building.context.app)
        spriteFire.label = LABEL_TYPES.deco
        spriteFire.allowMove = false
        spriteFire.allowClick = false
        spriteFire.eventMode = 'none'
        spriteFire.roundPixels = true
        spriteFire.x = 10
        spriteFire.y = 5
        spriteFire.play()
        spriteFire.animationSpeed = 0.2
        building.addChild(spriteFire)
      } else {
        const fire = building.getChildByLabel(LABEL_TYPES.deco)
        if (fire) fire.destroy()
      }
    }
  }

  generateFire(spriteId) {
    const building = this.building
    const fire = building.getChildByLabel(LABEL_TYPES.fire)
    const spritesheetFire = Assets.cache.get(spriteId)
    if (fire) {
      for (let i = 0; i < fire.children.length; i++) {
        fire.children[i].textures = getAnimationFrames(spritesheetFire.textures)
        fire.children[i].play()
      }
    } else {
      const newFire = new Container()
      newFire.label = LABEL_TYPES.fire
      newFire.allowMove = false
      newFire.allowClick = false
      newFire.eventMode = 'none'
      let poses = [[0, 0]]
      if (building.size === 3) {
        poses = [
          [0, -32],
          [-64, 0],
          [0, 32],
          [64, 0],
        ]
      }
      for (let i = 0; i < poses.length; i++) {
        const spriteFire = new AnimatedSprite(getAnimationFrames(spritesheetFire.textures))
        bindAnimatedSpriteToTicker(spriteFire, building.context.app)
        spriteFire.allowMove = false
        spriteFire.allowClick = false
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

  onBuilt() {
    const building = this.building
    const {
      context: { menu },
    } = building
    if (building.increasePopulation) {
      building.owner.population_max += building.increasePopulation
      if (building.owner.isPlayed && building.owner.selectedBuilding?.displayPopulation) {
        menu.updateInfo(
          MENU_INFO_IDS.populationText,
          building.owner.population + '/' + Math.min(POPULATION_MAX, building.owner.population_max)
        )
      }
    }
    if (building.owner.isPlayed && building.selected) {
      menu.setBottombar(building)
    }
  }

  updateHitPoints(action) {
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
        building.generateFire('450')
      } else if (percentage >= 25 && percentage < 50) {
        this.playBurningSound()
        building.generateFire('452')
      } else if (percentage >= 50 && percentage < 75) {
        this.playBurningSound()
        building.generateFire('347')
      } else if (percentage >= 75) {
        const fire = building.getChildByLabel(LABEL_TYPES.fire)
        if (fire) building.removeChild(fire)
        building.hasActiveBurningSound = false
      }
    }
  }

  playBurningSound() {
    const building = this.building
    if (building.hasActiveBurningSound || !building.context.controls.instanceIsAudible(building)) return
    building.hasActiveBurningSound = true
    playSoundCue(building.sounds?.burning ?? SOUND_CUES.building.burning)
  }

  pause() {
    const building = this.building
    const fire = building.getChildByLabel(LABEL_TYPES.fire)
    if (fire) fire.children.forEach(s => s.stop())
    const deco = building.getChildByLabel(LABEL_TYPES.deco)
    if (deco && typeof deco.stop === 'function') deco.stop()
  }

  resume() {
    const building = this.building
    const fire = building.getChildByLabel(LABEL_TYPES.fire)
    if (fire) fire.children.forEach(s => s.play())
    const deco = building.getChildByLabel(LABEL_TYPES.deco)
    if (deco && typeof deco.play === 'function') deco.play()
  }

  die() {
    const building = this.building
    if (building.isDead) return
    const {
      context: { map, player, players, menu },
    } = building
    clearTimeout(building.visibilityTimeout)
    building.stopInterval()
    building.isDead = true
    building.hasActiveBurningSound = false
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
        players[i].foundedEnemyBuildings.delete(building)
      }
    }
    const color = building.getChildByLabel(LABEL_TYPES.color)
    color && color.destroy()
    const deco = building.getChildByLabel(LABEL_TYPES.deco)
    deco && deco.destroy()
    const fire = building.getChildByLabel(LABEL_TYPES.fire)
    fire && fire.destroy()

    let rubbleSheet = getBuildingRubbleTextureNameWithSize(building.size, Assets)
    if (building.type === BUILDING_TYPES.farm) {
      rubbleSheet = '000_239'
    }
    building.sprite.texture = getTexture(rubbleSheet, Assets)
    building.sprite.allowMove = false
    building.sprite.eventMode = 'none'
    building.sprite.allowClick = false
    building.zIndex--
    if (building.type === BUILDING_TYPES.farm) {
      changeSpriteColorDirectly(building.sprite, building.owner.color)
    }

    updateInstanceVisibility(building)
    const dist = building.size === 3 ? 1 : 0
    getPlainCellsAroundPoint(building.i, building.j, map.grid, dist, cell => {
      if (cell.has === building) {
        cell.has = null
        cell.solid = false
        cell.corpses.add(building)
      }
    })
    building.startTimeout(() => building.clear(), RUBBLE_TIME)
    canUpdateMinimap(building, player) && menu.updatePlayerMiniMapEvt(building.owner)
    building.context.checkVictory?.()
    building.context.checkDefeat?.()
  }

  clear() {
    const building = this.building
    if (building.isDestroyed) return
    clearTimeout(building.visibilityTimeout)
    const {
      context: { map },
    } = building
    const dist = building.size === 3 ? 1 : 0
    getPlainCellsAroundPoint(building.i, building.j, map.grid, dist, cell => {
      cell.corpses.delete(building)
    })
    building.isDestroyed = true
    building.destroy({ child: true, texture: false })
  }
}
