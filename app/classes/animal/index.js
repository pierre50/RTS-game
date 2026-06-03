import { sound } from '@pixi/sound'
import { Assets, AnimatedSprite } from 'pixi.js'
import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES, LABEL_TYPES, UNIT_TYPES } from '../../constants'
import {
  getInstanceZIndex,
  randomRange,
  randomItem,
  instancesDistance,
  drawInstanceBlinkingSelection,
  playerCanSeeInstance,
  getActionCondition,
  setUnitTexture,
  bindAnimatedSpriteToTicker,
  updateInstanceVisibility,
} from '../../lib'
import { AnimalInterface } from '../../ui/AnimalInterface'
import { Instance } from '../Instance'
import { AnimalLifecycle } from './AnimalLifecycle'
import { AnimalMovement } from './AnimalMovement'
import { AnimalCombat } from './AnimalCombat'

export class Animal extends Instance {
  constructor(options, context) {
    super(context)
    this.selectionFactor = 0.5

    const {
      context: { map },
    } = this
    this.family = FAMILY_TYPES.animal
    this.animalInterface = new AnimalInterface(this)
    this.animalLifecycle = new AnimalLifecycle(this)
    this.animalMovement = new AnimalMovement(this)
    this.animalCombat = new AnimalCombat(this)

    this.dest = null
    this.realDest = null
    this.previousDest = null
    this.path = []
    this.degree = randomRange(1, 360)
    this.action = null
    this.currentFrame = 0
    this.currentSheet = SHEET_TYPES.standing
    this.inactif = true
    this.x = null
    this.y = null
    this.z = null

    Object.assign(this, options)
    Object.assign(this, this.owner.config.animals[this.type])

    this.size = 1
    this.visible = false
    this.visibleCells = new Set()
    this.x = this.x ?? map.grid[this.i][this.j].x
    this.y = this.y ?? map.grid[this.i][this.j].y
    this.z = this.z ?? map.grid[this.i][this.j].z
    this.zIndex = getInstanceZIndex(this)

    this.currentCell = map.grid[this.i][this.j]
    this.currentCell.place(this)
    this.currentCell.solid = true

    this.hitPoints = this.hitPoints ?? this.totalHitPoints
    this.quantity = this.quantity ?? this.totalQuantity
    map.addToInstanceBucket(this)

    for (const [key, value] of Object.entries(this.assets)) {
      this[key] = Assets.cache.get(value)
    }

    this.interface = {
      info: element => {
        const data = this.owner.config.animals[this.type]
        this.setDefaultInterface(element, data)
      },
    }

    this.allowMove = false
    this.eventMode = 'static'
    this.sprite = new AnimatedSprite(this.standingSheet.animations['south'])
    bindAnimatedSpriteToTicker(this.sprite, this.context.app)
    this.sprite.label = LABEL_TYPES.sprite
    this.sprite.allowMove = false
    this.sprite.eventMode = 'auto'
    this.sprite.allowClick = false
    this.sprite.roundPixels = true
    this.sprite.loop = this.loop ?? true
    if (this.isDead) {
      this.currentSheet === SHEET_TYPES.corpse ? this.decompose() : this.death()
    } else {
      this.setTextures(this.currentSheet)
    }
    this.sprite.currentFrame = this.currentFrame

    this.on('pointerup', evt => {
      const {
        context: { controls, player, menu },
      } = this
      if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp(evt)) {
        return
      }
      controls.mouse.prevent = true
      let drawDestinationRectangle = false
      let hasSentVillager = false
      let hasSentOther = false

      if (player.selectedUnits.length) {
        for (let i = 0; i < player.selectedUnits.length; i++) {
          const playerUnit = player.selectedUnits[i]
          if (playerUnit.type === UNIT_TYPES.villager) {
            if (getActionCondition(playerUnit, this, ACTION_TYPES.hunt)) {
              playerUnit.sendToHunt(this)
              hasSentVillager = true
              drawDestinationRectangle = true
            } else if (getActionCondition(playerUnit, this, ACTION_TYPES.takemeat)) {
              playerUnit.sendToTakeMeat(this)
              hasSentVillager = true
              drawDestinationRectangle = true
            }
          } else if (getActionCondition(playerUnit, this, ACTION_TYPES.attack)) {
            playerUnit.sendTo(this, ACTION_TYPES.attack)
            drawDestinationRectangle = true
            hasSentOther = true
          }
        }
      } else if (player.selectedBuilding && player.selectedBuilding.range) {
        if (
          getActionCondition(player.selectedBuilding, this, ACTION_TYPES.attack) &&
          instancesDistance(player.selectedBuilding, this) <= player.selectedBuilding.range
        ) {
          player.selectedBuilding.attackAction(this)
          drawDestinationRectangle = true
        }
      } else if ((playerCanSeeInstance(this, player) || map.revealEverything) && this.quantity > 0) {
        player.unselectAll()
        this.select()
        menu.setBottombar(this)
        player.selectedOther = this
      }

      if (hasSentOther) {
        const voice = randomItem(['5075', '5076', '5128', '5164'])
        sound.play(voice)
      } else if (hasSentVillager) {
        const voice = Assets.cache.get('config').units.Villager.sounds.hunt
        sound.play(voice)
      }
      if (drawDestinationRectangle) {
        drawInstanceBlinkingSelection(this)
      }
    })

    this.sprite.updateAnchor = true
    this.addChild(this.sprite)

    setTimeout(() => {
      updateInstanceVisibility(this)
    })
  }

  stop() {
    if (this.currentCell.has && this.currentCell.has.label !== this.label && this.currentCell.solid) {
      this.sendTo(this.currentCell)
      return
    }
    this.inactif = true
    this.action = null
    this.dest = null
    this.realDest = null
    this.currentCell.place(this)
    this.currentCell.solid = true
    this.path = []
    this.stopInterval()
    this.setTextures(SHEET_TYPES.standing)
  }

  setDefaultInterface(element, data) {
    return this.animalInterface.setDefaultInterface(element, data)
  }

  // AnimalLifecycle
  die() {
    return this.animalLifecycle.die()
  }
  death() {
    return this.animalLifecycle.death()
  }
  decompose() {
    return this.animalLifecycle.decompose()
  }
  updateTexture() {
    return this.animalLifecycle.updateTexture()
  }
  clear() {
    return this.animalLifecycle.clear()
  }

  // AnimalMovement
  hasPath() {
    return this.animalMovement.hasPath()
  }
  setDest(dest) {
    return this.animalMovement.setDest(dest)
  }
  setPath(path) {
    return this.animalMovement.setPath(path)
  }
  isAnimalAtDest(action, dest) {
    return this.animalMovement.isAnimalAtDest(action, dest)
  }
  destHasMoved() {
    return this.animalMovement.destHasMoved()
  }
  sendTo(dest, action) {
    return this.animalMovement.sendTo(dest, action)
  }
  moveToPath() {
    return this.animalMovement.moveToPath()
  }

  // AnimalCombat
  getReaction(instance) {
    return this.animalCombat.getReaction(instance)
  }
  detect(instance) {
    return this.animalCombat.detect(instance)
  }
  isAttacked(instance) {
    return this.animalCombat.isAttacked(instance)
  }
  affectNewDest() {
    return this.animalCombat.affectNewDest()
  }
  runaway(instance) {
    return this.animalCombat.runaway(instance)
  }
  getAction(name) {
    return this.animalCombat.getAction(name)
  }
}
