import { Assets, AnimatedSprite } from 'pixi.js'
import { FAMILY_TYPES, RELIEF_LIFT_SMOOTHING, SHEET_TYPES, LABEL_TYPES } from '../../constants'
import {
  cartesianToIsometric,
  getInstanceZIndex,
  getGroundReliefLevel,
  getReliefLiftPixels,
  bindAnimatedSpriteToTicker,
  updateInstanceVisibility,
  getAnimationFrames,
} from '../../lib'
import { AnimalInterface } from '../../ui/AnimalInterface'
import { Instance } from '../Instance'
import { AnimalLifecycle } from './AnimalLifecycle'
import type { AnimalEntity, EntityInfoRenderOptions, UnitSounds } from '../../types/entities'
import { AnimalMovement } from './AnimalMovement'
import { AnimalCombat } from './AnimalCombat'
import { AnimalBehavior } from './AnimalBehavior'
import type { Texture } from 'pixi.js'
import type { GameContextLike } from '../../types/context'
import type { AnimalConfig } from '../../types/config'
import type { RuntimeEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import type { InteractiveSprite, SpritesheetLike } from '../../types/pixi'
import { getShadowsEnabled, onVisualSettingsChange } from '../../lib/settings'
import { getHorseColorFromSeed, isHorseColor, recolorHorseTextures, type HorseColor } from '../../lib/horseColors'
import { ensureUnitEnergy } from '../../lib/unitEnergy'

export type AnimalOptions = Partial<AnimalConfig> & { i: number; j: number; type: string }
export type AnimalDestination = RuntimeEntity | RuntimeCell
type PositionedConfig = { x?: number; y?: number; z?: number | null }
type AnimalShadow = AnimatedSprite
export type AnimalMoveOptions = {
  forceRepath?: boolean
  movementSheet?: string
}

const SHADOW_MASK_ALPHA = 1
const SHADOW_SCALE_X = 1.05
const SHADOW_SCALE_Y = -0.42
export const FLYING_ALTITUDE = 20
const LANDING_STEPS = 8
const LANDING_STEP_MS = 40

function getCachedSpritesheet(id: string): SpritesheetLike | undefined {
  return Assets.cache.has(id) ? (Assets.cache.get(id) as SpritesheetLike | undefined) : undefined
}

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
  runningSpeed?: number
  flyingSpeed?: number
  sight!: number
  runningSheet?: SpritesheetLike
  flyingSheet?: SpritesheetLike
  flyingAltitude?: number
  altitude!: number
  declare reliefLift: number
  strategy?: string
  ambientMovement?: boolean
  ambientWalkDelayMin?: number
  ambientWalkDelayMax?: number
  ambientWalkRange?: number
  sounds?: UnitSounds
  horseColor?: HorseColor
  companionOwner?: AnimalEntity['companionOwner']
  companionHitCount?: AnimalEntity['companionHitCount']
  energy?: AnimalEntity['energy']
  totalEnergy?: AnimalEntity['totalEnergy']
  energyRegenRate?: AnimalEntity['energyRegenRate']
  energyRegenDelay?: AnimalEntity['energyRegenDelay']
  energyRegenMultiplier?: AnimalEntity['energyRegenMultiplier']
  lastEnergySpentAt?: AnimalEntity['lastEnergySpentAt']
  energyCosts?: AnimalEntity['energyCosts']
  waitingForEnergyAction?: AnimalEntity['waitingForEnergyAction']
  waitingForEnergyTarget?: AnimalEntity['waitingForEnergyTarget']
  energyWaitTaskId?: AnimalEntity['energyWaitTaskId']

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

    this.assignProperties(options)
    const animalConfig = (this.owner.config.animals?.[this.type] ?? {}) as Partial<AnimalConfig> & PositionedConfig
    this.assignProperties(animalConfig)
    if (this.type === 'Horse') {
      this.horseColor = isHorseColor(options.horseColor)
        ? options.horseColor
        : isHorseColor(this.horseColor)
          ? this.horseColor
          : getHorseColorFromSeed(`${this.type}:${this.i}:${this.j}:${this.label}`)
    }
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
    ensureUnitEnergy(this)
    map.addToInstanceBucket(this)

    for (const [key, value] of Object.entries(this.assets)) {
      Object.assign(this, { [key]: getCachedSpritesheet(value) })
    }

    this.interface = {
      info: (element: HTMLElement, options?: EntityInfoRenderOptions) => {
        const data = this.owner.config.animals?.[this.type]
        if (data) this.setDefaultInterface(element, data, options)
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

    this.on('pointerup', () => {
      const {
        context: { controls, editor },
      } = this
      if (editor?.handleEntityInteraction(this)) return
      if (controls.rallyPointController?.active) {
        controls.mouse.prevent = true
        controls.rallyPointController.handleMouseUpOnEntity(this)
      }
    })

    this.sprite.updateAnchor = true
    this.shadow = this.createShadow()
    this.context.map.shadowLayer?.addChild(this.shadow)
    this.addChild(this.sprite)
    this.visualSettingsCleanup = onVisualSettingsChange(() => this.syncVisualSettings())
    if (this.shouldKeepHealthBarVisible()) {
      this.drawHealthBar()
      this.drawEnergyBar()
    }

    setTimeout(() => {
      if (this.isDestroyed) return
      updateInstanceVisibility(this)
      this.animalBehavior.start()
    })
  }

  stop(): void {
    if (this.isDead || this.isDestroyed) return
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

  setDefaultInterface(element: HTMLElement, data: AnimalConfig, options?: EntityInfoRenderOptions): void {
    return this.animalInterface.setDefaultInterface(element, data, options)
  }

  createShadow(): AnimalShadow {
    const shadow = new AnimatedSprite(this.sprite.textures as Texture[])
    bindAnimatedSpriteToTicker(shadow, this.context.app)
    shadow.label = LABEL_TYPES.shadow
    shadow.eventMode = 'none'
    shadow.roundPixels = true
    shadow.tint = 0x000000
    shadow.alpha = SHADOW_MASK_ALPHA
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
    shadow.alpha = SHADOW_MASK_ALPHA
    shadow.visible = getShadowsEnabled() && this.visible && !this.isDestroyed
    shadow.rotation = 0
    shadow.scale.x = this.sprite.scale.x * SHADOW_SCALE_X * altitudeFactor
    shadow.scale.y = Math.abs(this.sprite.scale.y) * SHADOW_SCALE_Y * altitudeFactor
    shadow.position.set(this.x, this.y + this.reliefLift)
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
    this.syncShadow()
    this.syncSelectionMarkersToRelief()
    const healthBar = this.getChildByLabel(LABEL_TYPES.healthBar)
    if (healthBar) healthBar.position.y = this.reliefLift
    const energyBar = this.getChildByLabel(LABEL_TYPES.energyBar)
    if (energyBar) energyBar.position.y = this.reliefLift
  }

  syncVisualSettings(): void {
    if (this.shadow) {
      this.shadow.visible = getShadowsEnabled() && this.visible && !this.isDestroyed
    }
  }

  override setTextures(sheet: string): void {
    super.setTextures(sheet)
    if (this.type === 'Horse' && this.horseColor) {
      this.sprite.textures = recolorHorseTextures(this.sprite.textures as Texture[], this.horseColor)
    }
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
  isAttacked(instance: RuntimeEntity, hitDirection?: Point): void {
    return this.animalCombat.isAttacked(instance, hitDirection)
  }
  affectNewDest(): void {
    return this.animalCombat.affectNewDest()
  }
  runaway(instance: RuntimeEntity, hitDirection?: Point): void {
    return this.animalCombat.runaway(instance, hitDirection)
  }
  getAction(name: string): void {
    return this.animalCombat.getAction(name)
  }

  override destroy(options?: Parameters<Instance['destroy']>[0]): void {
    this.visualSettingsCleanup?.()
    this.visualSettingsCleanup = null
    this.shadow?.parent?.removeChild(this.shadow)
    this.shadow?.destroy({ children: true, texture: false })
    this.shadow = null
    super.destroy(options)
  }
}
