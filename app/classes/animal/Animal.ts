import type { InventoryStorage } from '../../lib/inventory/inventoryContainers'
import { initializeAnimalCorpseLoot } from '../../lib/equipment/animalCorpseLoot'
import { getEntitySpaceMapLike } from '../../lib/mapSpaces'
import { syncEntityRelief } from '../../lib/terrain/reliefSurface'
import type { AnimatedSprite, Container, ContainerChild } from 'pixi.js'
import { FAMILY_TYPES, LABEL_TYPES, SHEET_TYPES } from '../../constants'
import {
  cartesianToIsometric,
  getInstanceZIndex,
  updateInstanceVisibility,
  getEntityMapSpace,
  getActionCondition,
  uuidv4,
} from '../../lib'
import type { CombatEntity } from '../../lib'
import { clearCombatAttackRecovery } from '../../lib/combat/combatAttackLoop'
import { routeEntityAwayFromPassageCell } from '../../lib/buildings/passageCells'
import { AnimalInterface } from '../../ui/entity/AnimalInterface'
import {
  drawInstanceEnergyBar,
  drawInstanceHealthBar,
  drawInstanceHeroPowerBar,
  removeInstanceHudBar,
  isTeamHealthBarRestricted,
  isHeroTeamUnit,
} from '../InstanceHudBars'
import { AnimalLifecycle } from './AnimalLifecycle'
import type { AnimalEntity, EntityInfoRenderOptions, UnitSounds } from '../../types/entities'
import { AnimalMovement } from './AnimalMovement'
import { AnimalCombat } from './AnimalCombat'
import { AnimalBehavior } from './AnimalBehavior'
import type { AnimalDestination, AnimalMoveOptions } from './AnimalTypes'
import type { GameContextLike, SchedulerTaskId } from '../../types/context'
import type { AnimalConfig } from '../../types/config'
import type { RuntimeEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import type { InteractiveSprite, SpritesheetLike } from '../../types/pixi'
import { getHorseColorFromSeed, isHorseColor, type HorseColor } from '../../lib/horses/horseColors'
import { getHorseTamingStatus, shouldHorseFleeFromThreat, type HorseTamingStatus } from '../../lib/horses/horseTaming'
import { animalVisualState, type AnimalVisualState } from '../../rendering/AnimalView'
import { PixiAnimalView, getCachedAnimalSpritesheet } from '../../rendering/pixi/PixiAnimalView'
import type { UnitAnimation } from '../../rendering/UnitAnimation'
import { ensureUnitEnergy } from '../../lib/units/unitEnergy'

export type AnimalOptions = Partial<AnimalConfig> & { i: number; j: number; spaceId?: string; type: string }
type PositionedConfig = { x?: number; y?: number; z?: number | null }
type AnimalShadow = AnimatedSprite
const LANDING_STEPS = 8
const LANDING_STEP_MS = 40

function numberCoordinate(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

export class Animal implements AnimalEntity {
  context: GameContextLike
  label: string
  selected = false
  isDead = false
  isDestroyed = false
  interval: SchedulerTaskId | null = null
  timeoutId: SchedulerTaskId | null = null
  family!: string
  type!: string
  spaceId?: string
  i!: number
  j!: number
  z!: number | null
  size!: number
  degree!: number
  owner!: NonNullable<AnimalEntity['owner']>
  hitPoints!: number
  totalHitPoints!: number
  action?: string | null
  playingBeforePause?: boolean
  private mapX = 0
  private mapY = 0
  private renderVisible = true
  private renderOrder = 0
  private renderAlpha = 1
  animalInterface: AnimalInterface
  animalLifecycle: AnimalLifecycle
  animalMovement: AnimalMovement
  animalCombat: AnimalCombat
  animalBehavior: AnimalBehavior
  declare sprite: InteractiveSprite
  private readonly animalView: PixiAnimalView

  get displayObject(): Container { return this.animalView.container }
  get x(): number { return this.mapX }
  set x(value: number) { this.mapX = value; if (this.animalView) this.displayObject.x = value }
  get y(): number { return this.mapY }
  set y(value: number) { this.mapY = value; if (this.animalView) this.displayObject.y = value }
  get visible(): boolean { return this.renderVisible }
  set visible(value: boolean) { this.renderVisible = value; if (this.animalView) this.displayObject.visible = value }
  get zIndex(): number { return this.renderOrder }
  set zIndex(value: number) { this.renderOrder = value; if (this.animalView) this.displayObject.zIndex = value }
  get alpha(): number { return this.renderAlpha }
  set alpha(value: number) { this.renderAlpha = value; if (this.animalView) this.displayObject.alpha = value }
  get parent(): Container | null { return this.displayObject.parent }
  get width(): number { return this.displayObject.width }
  get height(): number { return this.displayObject.height }
  get destroyed(): boolean { return this.displayObject.destroyed }
  get eventMode(): Container['eventMode'] { return this.displayObject.eventMode }
  set eventMode(value: Container['eventMode']) { this.displayObject.eventMode = value }
  addChild: Container['addChild'] = ((...children: ContainerChild[]) =>
    this.displayObject.addChild(...children)) as Container['addChild']
  addChildAt: Container['addChildAt'] = ((child: ContainerChild, index: number) =>
    this.displayObject.addChildAt(child, index)) as Container['addChildAt']
  removeChild: Container['removeChild'] = ((...children: ContainerChild[]) =>
    this.displayObject.removeChild(...children)) as Container['removeChild']
  getChildByLabel: Container['getChildByLabel'] = ((label: string) =>
    this.displayObject.getChildByLabel(label)) as Container['getChildByLabel']
  on: Container['on'] = ((...args: Parameters<Container['on']>) =>
    this.displayObject.on(...args)) as Container['on']

  getVisualSprite(): InteractiveSprite | undefined {
    return this.animalView.sprite
  }

  get visualAnimation(): UnitAnimation {
    return this.animalView.animation
  }

  get deferredSpriteBounds() {
    return this.animalView.deferredBounds
  }

  getMovementAnimationPlaying(): boolean {
    return this.animalView.getMovementPlaying()
  }

  setMovementAnimationPlaying(playing: boolean): void {
    this.animalView.setMovementPlaying(playing)
  }

  private ensureVisuals(): InteractiveSprite {
    return this.animalView.ensure()
  }

  private releaseVisuals(): void {
    this.animalView.release()
  }

  getVisualState(): AnimalVisualState {
    return animalVisualState(this, getEntitySpaceMapLike(this, this.context.map))
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
    this.context = context
    this.label = uuidv4()

    const {
      context: { map },
    } = this
    this.family = FAMILY_TYPES.animal
    this.animalInterface = new AnimalInterface(this as AnimalEntity)
    this.animalLifecycle = new AnimalLifecycle(this)
    this.animalMovement = new AnimalMovement(this)
    this.animalCombat = new AnimalCombat(this)
    this.animalBehavior = new AnimalBehavior(this)
    this.animalView = new PixiAnimalView(this)
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
      Object.assign(this, { [key]: getCachedAnimalSpritesheet(value) })
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
    this.animalView.markReady()
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

  private assignProperties(source: object | null | undefined): void {
    if (!source) return
    for (const [key, value] of Object.entries(source)) {
      if (key === 'name') {
        Object.defineProperty(this, key, { configurable: true, enumerable: true, writable: true, value })
      } else {
        ;(this as Record<string, unknown>)[key] = value
      }
    }
  }

  startInterval(
    callback: () => void,
    time: number,
    immediate = true,
    name = `${this.family || 'animal'}.interval`
  ): void {
    this.stopInterval()
    this.interval = this.context.scheduler.add(callback, time, name)
    if (immediate) callback()
  }

  stopInterval(): void {
    if (this.interval) {
      this.context.scheduler.remove(this.interval)
      this.interval = null
    }
  }

  stopTimeout(): void {
    if (this.timeoutId != null) {
      this.context.scheduler.remove(this.timeoutId)
      this.timeoutId = null
    }
  }

  shouldKeepHealthBarVisible(): boolean {
    if (isTeamHealthBarRestricted(this)) return false
    const showEntityBars = Boolean(this.context?.map?.debugEntityBarsVisible)
    const showForHeroTeam = isHeroTeamUnit(this) && this.hitPoints < this.totalHitPoints
    const isHeroUnit = this.context?.controls?.heroUnit?.label === this.label
    return Boolean((showEntityBars || showForHeroTeam) && !isHeroUnit && !this.isDead && !this.isDestroyed)
  }

  shouldKeepEnergyBarVisible(): boolean {
    const showEntityBars = Boolean(this.context?.map?.debugEntityBarsVisible)
    const isHeroUnit = this.context?.controls?.heroUnit?.label === this.label
    return Boolean(showEntityBars && !isHeroUnit && !this.isDead && !this.isDestroyed)
  }

  drawHealthBar(): void { drawInstanceHealthBar(this) }
  drawEnergyBar(): void { drawInstanceEnergyBar(this) }
  drawHeroPowerBar(ratio: number): void { drawInstanceHeroPowerBar(this, ratio) }
  removeHealthBar(): void { removeInstanceHudBar(this, LABEL_TYPES.healthBar) }
  removeEnergyBar(): void { removeInstanceHudBar(this, LABEL_TYPES.energyBar) }
  removeHeroPowerBar(): void { removeInstanceHudBar(this, LABEL_TYPES.powerBar) }

  select(): void {
    if (this.selected) return
    this.selected = true
    this.drawHealthBar()
    this.drawEnergyBar()
  }

  unselect(): void {
    if (!this.selected) return
    this.selected = false
    if (this.shouldKeepHealthBarVisible()) {
      this.drawHealthBar()
      this.drawEnergyBar()
    } else {
      this.removeHealthBar()
      this.removeEnergyBar()
    }
  }

  step(): void {
    if (this.hitPoints <= 0) this.die()
    else if (this.hasPath()) this.moveToPath()
  }

  getActionCondition(target: object | null | undefined, action = this.action ?? undefined): boolean {
    return getActionCondition(this, target as CombatEntity, action)
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
    return this.animalView.visuals.createShadow()
  }

  syncShadow(shadow?: AnimalShadow | null): void {
    if (!this.animalView.isReady) return
    if (this.visible && !this.isDestroyed) this.ensureVisuals()
    else if (!this.context.editor) this.releaseVisuals()
    this.animalView.visuals.syncShadow(shadow ?? this.shadow)
  }

  setAltitude(altitude: number): void {
    this.animalView.visuals.setAltitude(altitude)
  }

  // Render-only: this is the SOLE source of visual relief for the animal — this.x/y stay flat
  // (pathing/collision/zIndex), so this offsets the sprite (on top of the flying altitude, if
  // any) to represent the ground relief level (sampled at the actual ground position).
  // The sampled ground height is applied immediately.
  // Never touches this.x/y or zIndex. Sign matches Unit.reliefLift: negative when
  // raised, directly usable as a Pixi position.y offset — see getReliefOffset for the shared
  // "instance.y + offset = visual y" accessor.
  applyReliefLift(level: number): void {
    this.animalView.visuals.applyReliefLift(level)
  }

  syncVisualSettings(): void {
    this.animalView.visuals.syncVisualSettings()
  }

  setTextures(sheet: string): void {
    this.animalView.setTextures(sheet)
  }

  pause(): void {
    const sprite = this.getVisualSprite()
    if (sprite) {
      this.playingBeforePause ??= Boolean(sprite.playing)
      sprite.stop()
    }
    this.shadow?.stop()
  }

  resume(): void {
    const sprite = this.getVisualSprite()
    if (sprite) {
      if (this.playingBeforePause !== false) sprite.play()
      else sprite.stop()
    }
    this.playingBeforePause = undefined
    this.shadow?.play()
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

  destroy(options?: Parameters<Container['destroy']>[0]): void {
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
    this.displayObject.destroy(options)
    this.animalView.clearReference()
  }
}
