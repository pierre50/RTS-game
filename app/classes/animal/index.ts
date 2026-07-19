import { Assets, AnimatedSprite } from 'pixi.js'
import {
  ACTION_TYPES,
  FAMILY_TYPES,
  RELIEF_LIFT_SMOOTHING,
  SHEET_TYPES,
  LABEL_TYPES,
  SOUND_CUES,
  UNIT_TYPES,
} from '../../constants'
import {
  cartesianToIsometric,
  getInstanceZIndex,
  getGroundReliefLevel,
  getReliefLiftPixels,
  instancesDistance,
  drawInstanceBlinkingSelection,
  playerCanSeeInstance,
  getActionCondition,
  bindAnimatedSpriteToTicker,
  updateInstanceVisibility,
  getAnimationFrames,
  playSoundCue,
  playSelectionSound,
} from '../../lib'
import { AnimalInterface } from '../../ui/AnimalInterface'
import { Instance } from '../Instance'
import { AnimalLifecycle } from './AnimalLifecycle'
import type { AnimalEntity, UnitSounds } from '../../types/entities'
import { AnimalMovement } from './AnimalMovement'
import { AnimalCombat } from './AnimalCombat'
import { AnimalBehavior } from './AnimalBehavior'
import type { FederatedPointerEvent, Texture } from 'pixi.js'
import type { GameContextLike } from '../../types/context'
import type { AnimalConfig } from '../../types/config'
import type { RuntimeEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { InteractiveSprite, SpritesheetLike } from '../../types/pixi'
import type { SelectableInstance } from '../../lib'
import { getShadowsEnabled, onVisualSettingsChange } from '../../lib/settings'
import { canUseRtsEntityPointer } from '../../lib/unitControl'

export type AnimalOptions = Partial<AnimalConfig> & { i: number; j: number; type: string }
export type AnimalDestination = RuntimeEntity | RuntimeCell
type PositionedConfig = { x?: number; y?: number; z?: number | null }
type AnimalShadow = AnimatedSprite
export type AnimalMoveOptions = {
  forceRepath?: boolean
  movementSheet?: string
}

const SHADOW_ALPHA = 0.42
const SHADOW_SCALE_X = 1.05
const SHADOW_SCALE_Y = -0.42
export const FLYING_ALTITUDE = 20
const LANDING_STEPS = 8
const LANDING_STEP_MS = 40

function numberCoordinate(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

export class Animal extends Instance implements AnimalEntity {
  animalInterface: AnimalInterface
  animalLifecycle: AnimalLifecycle
  animalMovement: AnimalMovement
  animalCombat: AnimalCombat
  animalBehavior: AnimalBehavior
  declare sprite: InteractiveSprite
  shadow: AnimalShadow | null
  visualSettingsCleanup: (() => void) | null

  dest: AnimalDestination | null
  realDest: Pick<AnimalDestination, 'i' | 'j'> | null
  previousDest: AnimalDestination | null
  path: RuntimeCell[]
  currentFrame!: number
  currentSheet!: string
  movementSheet?: string
  inactif!: boolean
  isFleeing!: boolean
  visibleCells!: Set<number>
  currentCell!: RuntimeCell
  quantity!: number
  totalQuantity!: number
  assets!: Record<string, string>
  standingSheet?: SpritesheetLike
  walkingSheet!: SpritesheetLike
  interface!: { info: (element: HTMLElement) => void }
  loop?: boolean
  huntRange?: number
  speed!: number
  sight!: number
  runningSheet?: SpritesheetLike
  flyingSheet?: SpritesheetLike
  flyingAltitude?: number
  altitude!: number
  declare reliefLift: number
  strategy?: string
  ambientMovement?: boolean
  ambientWalkRange?: number
  rateOfFire!: number
  sounds?: UnitSounds

  constructor(options: AnimalOptions, context: GameContextLike) {
    super(context)
    this.selectionFactor = 0.5

    const {
      context: { map },
    } = this
    this.family = FAMILY_TYPES.animal
    this.animalInterface = new AnimalInterface(this as AnimalEntity)
    this.animalLifecycle = new AnimalLifecycle(this)
    this.animalMovement = new AnimalMovement(this)
    this.animalCombat = new AnimalCombat(this)
    this.animalBehavior = new AnimalBehavior(this)
    this.shadow = null
    this.visualSettingsCleanup = null

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
    this.altitude = 0
    this.reliefLift = 0

    Object.assign(this, options)
    const animalConfig = (this.owner.config.animals?.[this.type] ?? {}) as Partial<AnimalConfig> & PositionedConfig
    Object.assign(this, animalConfig)
    this.movementSheet = this.currentSheet === SHEET_TYPES.running ? SHEET_TYPES.running : SHEET_TYPES.walking

    this.size = 1
    this.visible = false
    this.visibleCells = new Set()
    const spawnCell = map.grid[this.i][this.j]
    const [flatSpawnX, flatSpawnY] = cartesianToIsometric(this.i, this.j)
    this.x = animalConfig.x ?? numberCoordinate(options.x) ?? flatSpawnX
    this.y = animalConfig.y ?? numberCoordinate(options.y) ?? flatSpawnY
    this.z = animalConfig.z ?? numberCoordinate(options.z) ?? spawnCell.z
    this.zIndex = getInstanceZIndex(this)

    this.currentCell = map.grid[this.i][this.j]
    this.currentCell.place(this)
    this.currentCell.solid = true

    this.hitPoints = this.hitPoints ?? this.totalHitPoints
    this.quantity = this.quantity ?? this.totalQuantity
    map.addToInstanceBucket(this)

    for (const [key, value] of Object.entries(this.assets)) {
      Object.assign(this, { [key]: Assets.cache.get(value) as SpritesheetLike | undefined })
    }

    this.interface = {
      info: (element: HTMLElement) => {
        const data = this.owner.config.animals?.[this.type]
        if (data) this.setDefaultInterface(element, data)
      },
    }

    this.eventMode = 'static'
    const initialSheet = (this.standingSheet ?? this.walkingSheet) as { textures: Record<string, Texture> }
    this.sprite = new AnimatedSprite(getAnimationFrames(initialSheet.textures, 'south') as Texture[])
    bindAnimatedSpriteToTicker(this.sprite, this.context.app)
    this.sprite.label = LABEL_TYPES.sprite
    this.sprite.eventMode = 'auto'
    this.sprite.roundPixels = true
    this.sprite.loop = this.loop ?? true
    if (this.isDead) {
      this.currentSheet === SHEET_TYPES.corpse ? this.decompose() : this.death()
    } else {
      this.setTextures(this.currentSheet)
    }
    this.sprite.currentFrame = this.currentFrame
    this.applyReliefLift(getGroundReliefLevel(spawnCell), true)

    this.on('pointerup', (evt: FederatedPointerEvent) => {
      const {
        context: { controls, player, menu, editor },
      } = this
      if (editor?.handleEntityInteraction(this)) return
      if (!canUseRtsEntityPointer(controls)) return
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
          instancesDistance(player.selectedBuilding, this) <=
            player.selectedBuilding.range
        ) {
          player.selectedBuilding.attackAction?.(this)
          drawDestinationRectangle = true
        }
      } else if ((playerCanSeeInstance(this, player) || map.revealEverything) && this.quantity > 0) {
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
        drawInstanceBlinkingSelection(this as SelectableInstance)
      }
    })

    this.sprite.updateAnchor = true
    this.shadow = this.createShadow()
    this.addChild(this.shadow, this.sprite)
    this.visualSettingsCleanup = onVisualSettingsChange(() => this.syncVisualSettings())

    setTimeout(() => {
      if (this.isDestroyed) return
      updateInstanceVisibility(this)
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
    if (this.altitude) {
      this.land()
      return
    }
    this.setTextures(SHEET_TYPES.standing)
  }

  land(): void {
    const startAltitude = this.altitude
    const steps = LANDING_STEPS
    let step = 0
    this.startInterval(
      () => {
        step++
        this.setAltitude(step >= steps ? 0 : startAltitude * (1 - step / steps))
        if (step >= steps) {
          this.stopInterval()
          this.setTextures(SHEET_TYPES.standing)
        }
      },
      LANDING_STEP_MS,
      false,
      'animal.land'
    )
  }

  setDefaultInterface(element: HTMLElement, data: AnimalConfig): void {
    return this.animalInterface.setDefaultInterface(element, data)
  }

  createShadow(): AnimalShadow {
    const shadow = new AnimatedSprite(this.sprite.textures as Texture[])
    bindAnimatedSpriteToTicker(shadow, this.context.app)
    shadow.label = LABEL_TYPES.shadow
    shadow.eventMode = 'none'
    shadow.roundPixels = true
    shadow.tint = 0x000000
    shadow.alpha = SHADOW_ALPHA
    shadow.zIndex = -2
    this.syncShadow(shadow)
    return shadow
  }

  syncShadow(shadow = this.shadow): void {
    if (!shadow || !this.sprite) return
    const frame = Math.min(this.sprite.currentFrame, Math.max(this.sprite.textures.length - 1, 0))
    // The shadow tracks relief (it sits on the same raised/lowered ground as the sprite)
    // but ignores flying altitude, so a flying animal's shadow is left behind on the
    // ground below it instead of following it into the air.
    const altitudeFactor = 1 - (Math.min(this.altitude ?? 0, FLYING_ALTITUDE) / FLYING_ALTITUDE) * 0.25
    shadow.textures = this.sprite.textures
    shadow.animationSpeed = this.sprite.animationSpeed
    shadow.loop = this.sprite.loop
    shadow.anchor.set(this.sprite.anchor.x, this.sprite.anchor.y)
    shadow.alpha = SHADOW_ALPHA * altitudeFactor
    shadow.visible = getShadowsEnabled()
    shadow.rotation = 0
    shadow.scale.x = this.sprite.scale.x * SHADOW_SCALE_X * altitudeFactor
    shadow.scale.y = Math.abs(this.sprite.scale.y) * SHADOW_SCALE_Y * altitudeFactor
    shadow.position.set(0, this.reliefLift)
    if (this.sprite.playing) {
      shadow.gotoAndPlay(frame)
    } else {
      shadow.gotoAndStop(frame)
    }
  }

  setAltitude(altitude: number): void {
    this.altitude = altitude
    this.sprite.position.y = -altitude + this.reliefLift
    this.syncShadow()
  }

  // Render-only: this is the SOLE source of visual relief for the animal — this.x/y stay flat
  // (pathing/collision/zIndex), so this offsets the sprite (on top of the flying altitude, if
  // any) to represent the ground relief level (fractional on slopes — see getGroundReliefLevel).
  // Eased toward the target unless immediate, since the underfoot sampling can step at tile
  // boundaries. Never touches this.x/y or zIndex. Sign matches Unit.reliefLift: negative when
  // raised, directly usable as a Pixi position.y offset — see getReliefOffset for the shared
  // "instance.y + offset = visual y" accessor.
  applyReliefLift(level: number, immediate = false): void {
    const target = -getReliefLiftPixels(level)
    this.reliefLift = immediate ? target : this.reliefLift + (target - this.reliefLift) * RELIEF_LIFT_SMOOTHING
    this.sprite.position.y = -this.altitude + this.reliefLift
    if (this.shadow) this.shadow.position.y = this.reliefLift
  }

  syncVisualSettings(): void {
    if (this.shadow) {
      this.shadow.visible = getShadowsEnabled()
    }
  }

  override setTextures(sheet: string): void {
    super.setTextures(sheet)
    this.syncShadow()
  }

  override pause(): void {
    super.pause()
    this.shadow?.stop()
  }

  override resume(): void {
    super.resume()
    this.shadow?.play()
  }

  // AnimalLifecycle
  override die(): void {
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
  override hasPath(): boolean {
    return this.animalMovement.hasPath()
  }
  setDest(dest: AnimalDestination | null): void {
    return this.animalMovement.setDest(dest)
  }
  setPath(path: RuntimeCell[], sheet?: string): void {
    return this.animalMovement.setPath(path, sheet)
  }
  isAnimalAtDest(action: string | null, dest: AnimalDestination | null): boolean {
    return this.animalMovement.isAnimalAtDest(action, dest)
  }
  destHasMoved(): boolean {
    return this.animalMovement.destHasMoved()
  }
  sendTo(dest: AnimalDestination | null, action?: string | null, options?: AnimalMoveOptions): void {
    return this.animalMovement.sendTo(dest, action ?? null, options)
  }
  override moveToPath(): void {
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

  override destroy(options?: Parameters<Instance['destroy']>[0]): void {
    this.visualSettingsCleanup?.()
    this.visualSettingsCleanup = null
    super.destroy(options)
  }
}
