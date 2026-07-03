import { Assets, AnimatedSprite } from 'pixi.js'
import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES, LABEL_TYPES, SOUND_CUES, UNIT_TYPES } from '../../constants'
import {
  getInstanceZIndex,
  instancesDistance,
  drawInstanceBlinkingSelection,
  playerCanSeeInstance,
  getActionCondition,
  setUnitTexture,
  bindAnimatedSpriteToTicker,
  updateInstanceVisibility,
  getAnimationFrames,
  playSoundCue,
  playSelectionSound,
} from '../../lib'
import { AnimalInterface } from '../../ui/AnimalInterface'
import { Instance } from '../Instance'
import { AnimalLifecycle } from './AnimalLifecycle'
import { AnimalMovement } from './AnimalMovement'
import { AnimalCombat } from './AnimalCombat'
import { AnimalBehavior } from './AnimalBehavior'

type AnyRecord = Record<string, any>

export class Animal extends Instance {
  animalInterface: AnyRecord
  animalLifecycle: AnimalLifecycle
  animalMovement: AnimalMovement
  animalCombat: AnimalCombat
  animalBehavior: AnimalBehavior

  constructor(options: AnyRecord, context: AnyRecord) {
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
    this.animalBehavior = new AnimalBehavior(this)

    this.dest = null
    this.realDest = null
    this.previousDest = null
    this.path = []
    this.degree = map.randomRange(1, 360)
    this.action = null
    this.currentFrame = 0
    this.currentSheet = SHEET_TYPES.standing
    this.inactif = true
    this.isFleeing = false
    this.x = null as any
    this.y = null as any
    this.z = null as any

    Object.assign(this, options)
    Object.assign(this, this.owner.config.animals[this.type])
    this.movementSheet = this.currentSheet === SHEET_TYPES.running ? SHEET_TYPES.running : SHEET_TYPES.walking

    this.size = 1
    this.visible = false
    this.visibleCells = new Set()
    this.x = this.x ?? map.grid[this.i][this.j].x
    this.y = this.y ?? map.grid[this.i][this.j].y
    this.z = this.z ?? map.grid[this.i][this.j].z
    this.zIndex = getInstanceZIndex(this as any)

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
      info: (element: any) => {
        const data = this.owner.config.animals[this.type]
        this.setDefaultInterface(element, data)
      },
    }

    this.allowMove = false
    this.eventMode = 'static'
    this.sprite = new AnimatedSprite(getAnimationFrames(this.standingSheet.textures, 'south') as any)
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
        context: { controls, player, menu, editor },
      } = this
      if (editor?.handleEntityInteraction(this)) return
      if (controls.rallyPointController?.active) {
        controls.mouse.prevent = true
        controls.rallyPointController.handleMouseUpOnEntity(this)
        return
      }
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
          instancesDistance(player.selectedBuilding, this as any) <= player.selectedBuilding.range
        ) {
          player.selectedBuilding.attackAction(this)
          drawDestinationRectangle = true
        }
      } else if ((playerCanSeeInstance(this as any, player) || map.revealEverything) && this.quantity > 0) {
        player.unselectAll()
        this.select()
        menu.setBottombar(this)
        player.selectedOther = this
        playSelectionSound(this)
      }

      if (hasSentOther) {
        playSoundCue(SOUND_CUES.unit.militaryCommand)
      } else if (hasSentVillager) {
        const voice = Assets.cache.get('config').units.Villager.sounds.huntCommand
        playSoundCue(voice)
      }
      if (drawDestinationRectangle) {
        drawInstanceBlinkingSelection(this as any)
      }
    })

    this.sprite.updateAnchor = true
    this.addChild(this.sprite)

    setTimeout(() => {
      if (this.isDestroyed) return
      updateInstanceVisibility(this as any)
      this.animalBehavior.start()
    })
  }

  stop(): void {
    if (this.currentCell.has && this.currentCell.has.label !== this.label && this.currentCell.solid) {
      this.sendTo(this.currentCell)
      return
    }
    this.inactif = true
    this.isFleeing = false
    this.action = null
    this.dest = null
    this.realDest = null
    this.currentCell.place(this)
    this.currentCell.solid = true
    this.path = []
    this.stopInterval()
    this.setTextures(SHEET_TYPES.standing)
  }

  setDefaultInterface(element: any, data: AnyRecord): void {
    return this.animalInterface.setDefaultInterface(element, data)
  }

  // AnimalLifecycle
  die(): void {
    return this.animalLifecycle.die()
  }
  death(): void {
    return this.animalLifecycle.death()
  }
  decompose(): void {
    return this.animalLifecycle.decompose()
  }
  updateTexture(): void {
    return this.animalLifecycle.updateTexture()
  }
  clear(): void {
    return this.animalLifecycle.clear()
  }

  // AnimalMovement
  hasPath(): boolean {
    return this.animalMovement.hasPath()
  }
  setDest(dest: AnyRecord): void {
    return this.animalMovement.setDest(dest)
  }
  setPath(path: AnyRecord[], sheet?: any): void {
    return this.animalMovement.setPath(path, sheet)
  }
  isAnimalAtDest(action: any, dest: AnyRecord): boolean {
    return this.animalMovement.isAnimalAtDest(action, dest)
  }
  destHasMoved(): boolean {
    return this.animalMovement.destHasMoved()
  }
  sendTo(dest: AnyRecord, action?: any, options?: AnyRecord): void {
    return this.animalMovement.sendTo(dest, action, options)
  }
  moveToPath(): void {
    return this.animalMovement.moveToPath()
  }

  // AnimalCombat
  getReaction(instance: AnyRecord): void {
    return this.animalCombat.getReaction(instance)
  }
  detect(instance: AnyRecord): void {
    return this.animalCombat.detect(instance)
  }
  isAttacked(instance: AnyRecord): void {
    return this.animalCombat.isAttacked(instance)
  }
  affectNewDest(): void {
    return this.animalCombat.affectNewDest()
  }
  runaway(instance: AnyRecord): void {
    return this.animalCombat.runaway(instance)
  }
  getAction(name: string): void {
    return this.animalCombat.getAction(name)
  }
}
