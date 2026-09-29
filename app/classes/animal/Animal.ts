import type { InventoryStorage } from '../../lib/inventory/inventoryContainers'
import { initializeAnimalCorpseLoot } from '../../lib/equipment/animalCorpseLoot'
import { getEntitySpaceMapLike } from '../../lib/mapSpaces'
import { syncEntityRelief } from '../../lib/terrain/reliefSurface'
import { Assets, AnimatedSprite } from 'pixi.js'
import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES, LABEL_TYPES } from '../../constants'
import {
  cartesianToIsometric,
  attachEntityShadowsToMapSpace,
  getInstanceZIndex,
  bindAnimatedSpriteToTicker,
  updateInstanceVisibility,
  getAnimationFrames,
  getEntityMapSpace,
} from '../../lib'
import { clearCombatAttackRecovery } from '../../lib/combat/combatAttackLoop'
import { routeEntityAwayFromPassageCell } from '../../lib/buildings/passageCells'
import { AnimalInterface } from '../../ui/entity/AnimalInterface'
import { Instance } from '../Instance'
import { AnimalLifecycle } from './AnimalLifecycle'
import type { AnimalEntity, EntityInfoRenderOptions, UnitSounds } from '../../types/entities'
import { AnimalMovement } from './AnimalMovement'
import { AnimalCombat } from './AnimalCombat'
import { AnimalBehavior } from './AnimalBehavior'
import { AnimalVisuals } from './AnimalVisuals'
import type { AnimalDestination, AnimalMoveOptions } from './AnimalTypes'
import type { Texture } from 'pixi.js'
import type { GameContextLike } from '../../types/context'
import type { AnimalConfig } from '../../types/config'
import type { RuntimeEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import type { InteractiveSprite, SpritesheetLike } from '../../types/pixi'
import { onVisualSettingsChange } from '../../lib/audio/settings'
import { getHorseColorFromSeed, isHorseColor, type HorseColor } from '../../lib/horses/horseColors'
import { getHorseTamingStatus, shouldHorseFleeFromThreat, type HorseTamingStatus } from '../../lib/horses/horseTaming'
import { getAnimalRenderBounds } from './AnimalRenderBounds'
import { ensureUnitEnergy } from '../../lib/units/unitEnergy'

export type AnimalOptions = Partial<AnimalConfig> & { i: number; j: number; spaceId?: string; type: string }
type PositionedConfig = { x?: number; y?: number; z?: number | null }
type AnimalShadow = AnimatedSprite
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
  animalVisuals: AnimalVisuals
  declare sprite: InteractiveSprite
  private renderSprite?: InteractiveSprite
  private visualsReady = false
  private movementAnimationPlaying = true

  getVisualSprite(): InteractiveSprite | undefined {
    return this.renderSprite
  }

  get deferredSpriteBounds() {
    if (this.renderSprite || !this.visualsReady) return undefined
    const sheet =
      this.currentSheet === SHEET_TYPES.flying
        ? this.flyingSheet
        : this.currentSheet === SHEET_TYPES.running
          ? this.runningSheet
          : this.currentSheet === SHEET_TYPES.standing
            ? this.standingSheet
            : this.walkingSheet
    return getAnimalRenderBounds(sheet ?? this.walkingSheet, this.spriteScale ?? 1)
  }

  getMovementAnimationPlaying(): boolean {
    return this.renderSprite?.playing ?? this.movementAnimationPlaying
  }

  setMovementAnimationPlaying(playing: boolean): void {
    this.movementAnimationPlaying = playing
    if (playing) this.renderSprite?.play()
    else this.renderSprite?.stop()
  }

  private ensureVisuals(): InteractiveSprite {
    if (this.renderSprite) return this.renderSprite
    if (this.isDestroyed) throw new Error('Cannot create visuals for a destroyed animal')
    const initialSheet = this.standingSheet ?? this.walkingSheet
    const sprite = new AnimatedSprite(getAnimationFrames(initialSheet.textures, 'south') as Texture[])
    this.renderSprite = sprite
    bindAnimatedSpriteToTicker(sprite, this.context.app)
    sprite.label = LABEL_TYPES.sprite
    sprite.eventMode = 'auto'
    sprite.roundPixels = true
    sprite.loop = this.loop ?? true
    sprite.updateAnchor = true
    this.addChild(sprite)
    super.setTextures(this.currentSheet)
    this.animalVisuals.afterSetTextures()
    sprite.currentFrame = Math.min(this.currentFrame, sprite.textures.length - 1)
    sprite.position.y = -this.altitude + this.reliefLift
    if (!this.movementAnimationPlaying) sprite.stop()
    this.shadow = this.createShadow()
    attachEntityShadowsToMapSpace(this.context.map, this)
    this.visualSettingsCleanup = onVisualSettingsChange(() => this.syncVisualSettings())
    return sprite
  }

  private releaseVisuals(): void {
    const sprite = this.renderSprite
    // Combat and death callbacks are gameplay clocks until those are moved to
    // the scheduler. Never evict an animation that still owns such a callback.
    if (
      !sprite ||
      this.isDead ||
      this.selected ||
      this.action === ACTION_TYPES.attack ||
      sprite.onComplete ||
      sprite.onLoop ||
      sprite.onFrameChange
    )
      return
    this.currentFrame = sprite.currentFrame
    this.loop = sprite.loop
    this.movementAnimationPlaying = this.playingBeforePause ?? sprite.playing
    this.visualSettingsCleanup?.()
    this.visualSettingsCleanup = null
    this.shadow?.parent?.removeChild(this.shadow)
    this.shadow?.destroy({ children: true, texture: false })
    this.shadow = null
    sprite.parent?.removeChild(sprite)
    sprite.destroy({ children: true, texture: false })
    this.renderSprite = undefined
  }

  spriteScale?: number
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
  wildlife?: AnimalEntity['wildlife']
  corpseMaterialDecayRemainingMs?: number
  inventory?: InventoryStorage
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
  tamingStatus?: HorseTamingStatus
  companionOwner?: AnimalEntity['companionOwner']
  companionHitCount?: AnimalEntity['companionHitCount']
  declare energy?: AnimalEntity['energy']
  declare totalEnergy?: AnimalEntity['totalEnergy']
  energyRegenRate?: AnimalEntity['energyRegenRate']
  energyRegenDelay?: AnimalEntity['energyRegenDelay']
  energyRegenMultiplier?: AnimalEntity['energyRegenMultiplier']
  lastEnergySpentAt?: AnimalEntity['lastEnergySpentAt']
  energyCosts?: AnimalEntity['energyCosts']
  waitingForEnergyAction?: AnimalEntity['waitingForEnergyAction']
  waitingForEnergyTarget?: AnimalEntity['waitingForEnergyTarget']
  energyWaitTaskId?: AnimalEntity['energyWaitTaskId']
  attackRecoveryMs?: AnimalEntity['attackRecoveryMs']
  attackImpactFrame?: number
  attackRecoveryTaskId?: AnimalEntity['attackRecoveryTaskId']
  attackRecoveryAnimationTaskId?: AnimalEntity['attackRecoveryAnimationTaskId']
  combatBehavior?: AnimalEntity['combatBehavior']
  combatBehaviorPreset?: AnimalEntity['combatBehaviorPreset']
  combatMode?: AnimalEntity['combatMode']
  combatRecoveryOrbitDirection?: AnimalEntity['combatRecoveryOrbitDirection']
  lastCombatRecoveryMoveAt?: AnimalEntity['lastCombatRecoveryMoveAt']

  constructor(options: AnimalOptions, context: GameContextLike) {
    super(context)

    const {
      context: { map },
    } = this
    this.family = FAMILY_TYPES.animal
    this.animalInterface = new AnimalInterface(this as AnimalEntity)
    this.animalLifecycle = new AnimalLifecycle(this)
    this.animalMovement = new AnimalMovement(this)
    this.animalCombat = new AnimalCombat(this)
    this.animalBehavior = new AnimalBehavior(this)
    this.animalVisuals = new AnimalVisuals(this)
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
    // Preserve the original meat capacity when restoring a partially looted corpse.
    if (typeof options.totalQuantity === 'number') this.totalQuantity = options.totalQuantity
    const { trapPrey, spaceId } = this as AnimalEntity
    if (!trapPrey && this.tamingStatus !== 'tamed' && (!spaceId || spaceId === 'outside'))
      this.wildlife ??= { homeI: this.i, homeJ: this.j, generation: 0 }
    if (this.type === 'Horse') {
      this.horseColor = isHorseColor(options.horseColor)
        ? options.horseColor
        : isHorseColor(this.horseColor)
          ? this.horseColor
          : getHorseColorFromSeed(`${this.type}:${this.i}:${this.j}:${this.label}`)
      this.tamingStatus = getHorseTamingStatus(this)
      if (!shouldHorseFleeFromThreat(this) && this.strategy === 'runaway') {
        this.strategy = undefined
      }
    }
    this.movementSheet = this.currentSheet === SHEET_TYPES.running ? SHEET_TYPES.running : SHEET_TYPES.walking

    this.size = 1
    this.visible = false
    this.visibleCells = new Set()
    const space = getEntityMapSpace(this, map)
    const grid = space?.grid ?? map.grid
    const spawnCell = grid[this.i]?.[this.j]
    if (!spawnCell) throw new Error(`Cannot spawn animal on missing cell (${this.i}, ${this.j})`)
    const [flatSpawnX, flatSpawnY] = cartesianToIsometric(this.i, this.j)
    this.x = animalConfig.x ?? numberCoordinate(options.x) ?? flatSpawnX
    this.y = animalConfig.y ?? numberCoordinate(options.y) ?? flatSpawnY
    this.z = animalConfig.z ?? numberCoordinate(options.z) ?? spawnCell.z
    this.zIndex = getInstanceZIndex(this)

    this.currentCell = spawnCell
    this.currentCell.place(this)
    this.currentCell.solid = true

    this.hitPoints = this.hitPoints ?? this.totalHitPoints
    this.quantity = this.quantity ?? this.totalQuantity
    initializeAnimalCorpseLoot(this)
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
    // Legacy combat/interaction code can explicitly request graphics; routine
    // simulation and camera bounds use the non-materializing accessors above.
    Object.defineProperty(this, 'sprite', {
      configurable: true,
      get: this.ensureVisuals,
    })
    this.visualsReady = true
    if (this.isDead) {
      this.currentSheet === SHEET_TYPES.corpse ? this.decompose() : this.death()
    }
    syncEntityRelief(getEntitySpaceMapLike(this, this.context.map), this, spawnCell)

    this.on('pointerup', () => {
      const {
        context: { editor },
      } = this
      if (editor?.handleEntityInteraction(this)) return
    })

    if (this.shouldKeepHealthBarVisible()) {
      this.drawHealthBar()
      this.drawEnergyBar()
    }

    updateInstanceVisibility(this)
    this.animalBehavior.start()
  }

  stop(): void {
    if (this.isDead || this.isDestroyed) return
    if (this.currentCell.has && this.currentCell.has.label !== this.label && this.currentCell.solid) {
      this.sendTo(this.currentCell)
      return
    }
    if (routeEntityAwayFromPassageCell(this)) return
    clearCombatAttackRecovery(this)
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
    return this.animalVisuals.createShadow()
  }

  syncShadow(shadow?: AnimalShadow | null): void {
    if (!this.visualsReady) return
    if (this.visible && !this.isDestroyed) this.ensureVisuals()
    else if (!this.context.editor) this.releaseVisuals()
    this.animalVisuals.syncShadow(shadow ?? this.shadow)
  }

  setAltitude(altitude: number): void {
    this.animalVisuals.setAltitude(altitude)
  }

  // Render-only: this is the SOLE source of visual relief for the animal — this.x/y stay flat
  // (pathing/collision/zIndex), so this offsets the sprite (on top of the flying altitude, if
  // any) to represent the ground relief level (sampled at the actual ground position).
  // The sampled ground height is applied immediately.
  // Never touches this.x/y or zIndex. Sign matches Unit.reliefLift: negative when
  // raised, directly usable as a Pixi position.y offset — see getReliefOffset for the shared
  // "instance.y + offset = visual y" accessor.
  applyReliefLift(level: number): void {
    this.animalVisuals.applyReliefLift(level)
  }

  syncVisualSettings(): void {
    this.animalVisuals.syncVisualSettings()
  }

  override setTextures(sheet: string): void {
    if (!this.renderSprite && !this.visible && !this.isDead) {
      if (this.currentSheet !== sheet) this.currentFrame = 0
      this.currentSheet = sheet
      this.movementAnimationPlaying = true
      return
    }
    this.ensureVisuals()
    super.setTextures(sheet)
    this.animalVisuals.afterSetTextures()
  }

  override pause(): void {
    if (this.renderSprite) super.pause()
    this.shadow?.stop()
  }

  override resume(): void {
    if (this.renderSprite) super.resume()
    else this.playingBeforePause = undefined
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
    this.animalBehavior.stop()
    this.animalLifecycle.stopDeathFall()
    this.stopInterval()
    this.stopTimeout()
    clearCombatAttackRecovery(this)
    this.isDestroyed = true
    this.visualSettingsCleanup?.()
    this.visualSettingsCleanup = null
    this.shadow?.parent?.removeChild(this.shadow)
    this.shadow?.destroy({ children: true, texture: false })
    this.shadow = null
    super.destroy(options)
    this.renderSprite = undefined
  }
}
