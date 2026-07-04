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
import type { AnimalEntity } from '../../types/entities'
import { AnimalMovement } from './AnimalMovement'
import { AnimalCombat } from './AnimalCombat'
import { AnimalBehavior } from './AnimalBehavior'
import type { FederatedPointerEvent, Texture } from 'pixi.js'
import type { UnknownRecord } from '../../types/common'
import type { GameContextLike } from '../../types/context'
import type { AnimalConfig } from '../../types/config'
import type { RuntimeEntity } from '../../types/entities'
import type { LooseRecord } from '../../types/common'

export class Animal extends Instance {
  animalInterface: AnimalInterface
  animalLifecycle: AnimalLifecycle
  animalMovement: AnimalMovement
  animalCombat: AnimalCombat
  animalBehavior: AnimalBehavior

  constructor(options: UnknownRecord, context: GameContextLike) {
    super(context)
    this.selectionFactor = 0.5

    const {
      context: { map },
    } = this
    this.family = FAMILY_TYPES.animal
    this.animalInterface = new AnimalInterface(this as unknown as AnimalEntity)
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
    this.x = null as unknown as number
    this.y = null as unknown as number
    this.z = null as unknown as number

    Object.assign(this, options)
    Object.assign(this, this.owner.config.animals[this.type])
    this.movementSheet = this.currentSheet === SHEET_TYPES.running ? SHEET_TYPES.running : SHEET_TYPES.walking

    this.size = 1
    this.visible = false
    this.visibleCells = new Set()
    this.x = this.x ?? map.grid[this.i][this.j].x
    this.y = this.y ?? map.grid[this.i][this.j].y
    this.z = this.z ?? map.grid[this.i][this.j].z
    this.zIndex = getInstanceZIndex(this as unknown as Parameters<typeof getInstanceZIndex>[0])

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
      info: (element: HTMLElement) => {
        const data = this.owner.config.animals[this.type]
        this.setDefaultInterface(element, data)
      },
    }

    this.allowMove = false
    this.eventMode = 'static'
    this.sprite = new AnimatedSprite(getAnimationFrames(this.standingSheet.textures, 'south') as Texture[])
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

    this.on('pointerup', (evt: FederatedPointerEvent) => {
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
          instancesDistance(
            player.selectedBuilding,
            this as unknown as Parameters<typeof instancesDistance>[1]
          ) <= player.selectedBuilding.range
        ) {
          player.selectedBuilding.attackAction(this)
          drawDestinationRectangle = true
        }
      } else if ((playerCanSeeInstance(this as unknown as Parameters<typeof playerCanSeeInstance>[0], player) || map.revealEverything) && this.quantity > 0) {
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
        drawInstanceBlinkingSelection(this as unknown as Parameters<typeof drawInstanceBlinkingSelection>[0])
      }
    })

    this.sprite.updateAnchor = true
    this.addChild(this.sprite)

    setTimeout(() => {
      if (this.isDestroyed) return
      updateInstanceVisibility(this as unknown as Parameters<typeof updateInstanceVisibility>[0])
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

  setDefaultInterface(element: HTMLElement, data: AnimalConfig): void {
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
  setDest(dest: LooseRecord | null): void {
    return this.animalMovement.setDest(dest)
  }
  setPath(path: LooseRecord[], sheet?: string): void {
    return this.animalMovement.setPath(path, sheet)
  }
  isAnimalAtDest(action: string | null, dest: LooseRecord | null): boolean {
    return this.animalMovement.isAnimalAtDest(action, dest)
  }
  destHasMoved(): boolean {
    return this.animalMovement.destHasMoved()
  }
  sendTo(dest: LooseRecord | null, action?: string | null, options?: UnknownRecord): void {
    return this.animalMovement.sendTo(dest, action ?? null, options)
  }
  moveToPath(): void {
    return this.animalMovement.moveToPath()
  }

  // AnimalCombat
  getReaction(instance: RuntimeEntity): void {
    return this.animalCombat.getReaction(instance)
  }
  detect(instance: RuntimeEntity): void {
    return this.animalCombat.detect(instance)
  }
  isAttacked(instance: RuntimeEntity): void {
    return this.animalCombat.isAttacked(instance)
  }
  affectNewDest(): void {
    return this.animalCombat.affectNewDest()
  }
  runaway(instance: RuntimeEntity): void {
    return this.animalCombat.runaway(instance)
  }
  getAction(name: string): void {
    return this.animalCombat.getAction(name)
  }
}
