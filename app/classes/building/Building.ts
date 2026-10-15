import { initializeConstructionProgress } from '../../lib/economy/constructionMaterials'
import type { CaveDefinition } from '../../types/cave'
import { getBuildingLevel, getBuildingConfigForLevel } from '../../lib/buildings/buildingLevel'
import type { AnimatedSprite, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { CAMP_DECORATION_BUILDING_TYPES, FAMILY_TYPES } from '../../constants'
import { canUpdateMinimap, getActionCondition, setUnitTexture, uuidv4 } from '../../lib'
import { BuildingInterface } from '../../ui/entity/BuildingInterface'
import { BuildingLifecycle } from './BuildingLifecycle'
import { stopFlameAmbientSound } from './BuildingFire'
import type { FireAnimation } from './BuildingFire'
import { BuildingProduction } from './BuildingProduction'
import type { BuildingTrainingPreview } from './BuildingTrainingPreview'
import type { CombatEntity, UnitTextureInstance } from '../../lib'
import { isTeamHealthBarRestricted, isHeroTeamUnit } from '../../rendering/EntityHudBars'
import { BuildingCombat } from './BuildingCombat'
import { onVisualSettingsChange } from '../../lib/audio/settings'
import { createBuildingEntityInterface } from './BuildingInterfaceSetup'
import {
  activateBuiltBuilding,
  attachInitialBuildingVisuals,
  createInitialBuildingSprite,
  occupyBuildingFootprint,
  resumeInitialBuildingWork,
  setupBuildingTransform,
  stableHorsesFromOptions,
} from './BuildingSetup'
import type { BuildingShadow } from '../../rendering/pixi/PixiBuildingVisuals'
import type { GameContextLike, SchedulerTaskId } from '../../types/context'
import type {
  BuildingEntity,
  CommandSound,
  EntityInfoRenderOptions,
  EntityInterfaceLike,
  RuntimeEntity,
  UnitCreationExtra,
  UnitEntity,
  UnitSounds,
} from '../../types/entities'
import type { ResourceAmount } from '../../types/common'
import type { BuildingConfig } from '../../types/config'
import type { HorseTamingStatus } from '../../lib/horses/horseTaming'
import type { SavedTrainingEntry, SavedTrainingExtra, TrainingTrainee } from '../../types/training'
import { PixiBuildingView } from '../../rendering/pixi/PixiBuildingView'
import { buildingVisualState, type BuildingDestructionGroundTarget, type BuildingVisualState } from '../../rendering/BuildingView'
import { getEntityMapSpace } from '../../lib/mapSpaces'

type BuildingSprite = Sprite | AnimatedSprite
type BuildingSounds = UnitSounds & { burning?: CommandSound; collapse?: CommandSound }

export type BuildingOptions = Omit<Partial<BuildingConfig>, 'trainingQueue'> & {
  settlementName?: string
  cave?: CaveDefinition
  placementMirrored?: boolean
  buildingLevel?: number
  houseInteriorLevel?: number
  assetLevel?: number
  trainingQueue?: SavedTrainingEntry[]
  trainingRequests?: BuildingEntity['trainingRequests']
  reservePolicy?: BuildingEntity['reservePolicy']
  trainingExtra?: SavedTrainingExtra
  deferTrainingResume?: boolean
  i: number
  j: number
  type: string
  spaceId?: string
  constructionTime?: number
  constructionWorkRequired?: number
  constructionPaused?: boolean
  constructionProgress?: number
  constructionMaterials?: BuildingEntity['constructionMaterials']
  buildingUpgrade?: BuildingEntity['buildingUpgrade']
  inventory?: BuildingEntity['inventory']
  marketGold?: number
  marketStock?: string[]
  marketResourceStock?: ResourceAmount
  horseAmount?: number
  stableHorses?: Array<{ horseColor?: string; tamingStatus?: HorseTamingStatus }>
  isBuilt?: boolean
  skipBuiltEffects?: boolean
}

export class Building implements BuildingEntity {
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
  owner!: NonNullable<BuildingEntity['owner']>
  hitPoints!: number
  totalHitPoints!: number
  energy?: number
  totalEnergy?: number
  reliefLift?: number
  action?: string | null
  playingBeforePause?: boolean
  private mapX = 0
  private mapY = 0
  private renderVisible = true
  private renderOrder = 0
  private renderAlpha = 1
  readonly buildingView: PixiBuildingView
  declare settlementName?: string
  buildingInterface: BuildingInterface
  buildingLifecycle: BuildingLifecycle
  buildingProduction: BuildingProduction
  buildingTrainingPreview: BuildingTrainingPreview | null
  buildingCombat: BuildingCombat
  queue: string[]
  loading: number | null
  isUsedBy: RuntimeEntity | null
  trainingUnit: TrainingTrainee | null
  private trainingResumePending = false
  private savedTrainingExtra?: SavedTrainingExtra
  trainingType: string | null
  trainingQueue: NonNullable<BuildingEntity['trainingQueue']>
  trainingRequests: NonNullable<BuildingEntity['trainingRequests']>
  reservePolicy?: BuildingEntity['reservePolicy']
  trainingStartedDay: number | null
  trainingCompleteDay: number | null
  trainingDayChangeUnsubscribe: (() => void) | null
  shadow: BuildingShadow | null
  shadowWasVisible: boolean
  constructionRevealSprite: Sprite | null
  constructionRevealMask: Graphics | null
  constructionProgressText: Text | null
  constructionGhostBorder: Sprite | null
  intervalId: SchedulerTaskId | null
  attackIntervalId: SchedulerTaskId | null
  declare sprite: BuildingSprite
  isBuilt?: boolean
  quantity?: number
  totalQuantity?: number
  units?: string[]
  horseAmount?: number
  stableHorses?: Array<{ horseColor?: string; tamingStatus?: HorseTamingStatus }>
  mountingDays?: number
  interface!: EntityInterfaceLike
  placementMirrored = false
  buildingLevel!: number
  houseInteriorLevel?: number
  assetType?: string
  textureName?: string
  useSpriteShadow?: boolean
  providesVision?: boolean
  requiresActiveSightInteraction?: boolean
  overheadIndicatorOffsetX?: number
  overheadIndicatorOffsetY?: number
  spriteShadowAnchor?: { x?: number; y?: number }
  accept?: string[]
  visibilityTimeout?: ReturnType<typeof setTimeout>
  sounds?: BuildingSounds
  projectile?: string
  rateOfFire!: number
  range?: number
  hasActiveBurningSound?: boolean
  flameSoundLoop?: { stop(): void; volume: number } | null
  flameSoundTicker?: ((ticker?: { deltaMS?: number; elapsedMS?: number }) => void) | null
  flameSoundStopped?: boolean
  shelterCapacity?: number
  cave?: CaveDefinition
  indestructible?: boolean
  containedAnimalType?: string | null
  inventory?: {
    resources?: ResourceAmount
    equipment?: string[]
  }
  constructionTime?: number
  constructionWorkRequired?: number
  constructionPaused?: boolean
  constructionProgress?: number
  constructionMaterials?: BuildingEntity['constructionMaterials']
  buildingUpgrade?: BuildingEntity['buildingUpgrade']
  marketGold?: number
  marketStock?: string[]
  marketResourceStock?: ResourceAmount
  visualSettingsCleanup: (() => void) | null

  constructor(options: BuildingOptions, context: GameContextLike) {
    this.context = context
    this.label = uuidv4()
    this.buildingView = new PixiBuildingView(this)

    const { map } = context

    this.family = FAMILY_TYPES.building
    this.buildingInterface = new BuildingInterface(this)
    this.buildingLifecycle = new BuildingLifecycle(this)
    this.buildingProduction = new BuildingProduction(this)
    this.buildingTrainingPreview = null
    this.buildingCombat = new BuildingCombat(this)
    this.queue = []
    this.loading = null
    this.isUsedBy = null
    this.trainingUnit = null
    this.trainingType = null
    this.trainingQueue = []
    this.reservePolicy = options.reservePolicy ? structuredClone(options.reservePolicy) : undefined
    this.trainingRequests = structuredClone(options.trainingRequests ?? [])
    this.trainingStartedDay = null
    this.trainingCompleteDay = null
    this.trainingDayChangeUnsubscribe = null
    this.stableHorses = []
    this.horseAmount = 0
    this.shadow = null
    this.shadowWasVisible = false
    this.constructionRevealSprite = null
    this.constructionRevealMask = null
    this.constructionProgressText = null
    this.constructionGhostBorder = null
    this.visualSettingsCleanup = null

    this.assignProperties(options)
    this.buildingLevel = getBuildingLevel(options)
    if (this.type === 'House') this.houseInteriorLevel = options.houseInteriorLevel ?? this.buildingLevel
    this.assignProperties(getBuildingConfigForLevel(this.owner.config.buildings[this.type], this.buildingLevel))
    // Saved projects keep their original work budget, including legacy health-based sites.
    if (options.constructionWorkRequired != null) this.constructionWorkRequired = options.constructionWorkRequired
    else if (options.hitPoints != null) delete this.constructionWorkRequired
    // Enforce this after saved options and config so existing decorations are protected too.
    if (CAMP_DECORATION_BUILDING_TYPES.some(type => type === this.type)) this.indestructible = true
    this.stableHorses = stableHorsesFromOptions(options)
    this.horseAmount = this.stableHorses.length

    this.intervalId = null
    this.attackIntervalId = null

    if (options.deferTrainingResume && options.trainingQueue) {
      this.trainingQueue = structuredClone(options.trainingQueue)
    }
    this.trainingResumePending = Boolean(
      options.deferTrainingResume && (this.queue.length || this.trainingQueue.length)
    )
    if (options.trainingExtra) this.savedTrainingExtra = structuredClone(options.trainingExtra)
    if (!this.trainingResumePending) resumeInitialBuildingWork(this)

    this.quantity = this.quantity ?? this.totalQuantity
    this.hitPoints = Math.min(this.hitPoints ?? this.totalHitPoints, this.totalHitPoints)

    if (options.hitPoints == null) {
      this.constructionProgress ??= this.isBuilt ? 1 : 0
      this.constructionWorkRequired ??= Math.max(1, this.constructionTime ?? 1)
    }
    initializeConstructionProgress(this)

    setupBuildingTransform(this)
    createInitialBuildingSprite(this)
    this.interface = createBuildingEntityInterface(this)

    if (this.sprite) {
      occupyBuildingFootprint(this)
      attachInitialBuildingVisuals(this)
    }
    this.visualSettingsCleanup = onVisualSettingsChange(() => this.syncVisualSettings())

    activateBuiltBuilding(this)
    map.addToInstanceBucket(this)
  }

  get displayObject(): Container { return this.buildingView.container }
  get x(): number { return this.mapX }
  set x(value: number) { this.mapX = value; if (this.buildingView) this.displayObject.x = value }
  get y(): number { return this.mapY }
  set y(value: number) { this.mapY = value; if (this.buildingView) this.displayObject.y = value }
  get zIndex(): number { return this.renderOrder }
  set zIndex(value: number) { this.renderOrder = value; if (this.buildingView) this.displayObject.zIndex = value }
  get visible(): boolean { return this.renderVisible }
  set visible(value: boolean) { this.renderVisible = value; if (this.buildingView) this.displayObject.visible = value }
  get alpha(): number { return this.renderAlpha }
  set alpha(value: number) { this.renderAlpha = value; if (this.buildingView) this.displayObject.alpha = value }
  get parent(): Container | null { return this.displayObject.parent }
  get width(): number { return this.displayObject.width }
  get height(): number { return this.displayObject.height }
  get destroyed(): boolean { return this.displayObject.destroyed }

  assignProperties(source: object | null | undefined): void {
    if (!source) return
    for (const [key, value] of Object.entries(source)) {
      if (key === 'name') {
        Object.defineProperty(this, key, { configurable: true, enumerable: true, writable: true, value })
      } else {
        ;(this as Record<string, unknown>)[key] = value
      }
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
    const showEntityBars = Boolean(this.context.map.debugEntityBarsVisible)
    const showForFamily = this.family === FAMILY_TYPES.unit || this.family === FAMILY_TYPES.animal
    const showForHeroTeam = isHeroTeamUnit(this) && this.hitPoints < this.totalHitPoints
    const isHeroUnit = this.context.controls?.heroUnit?.label === this.label
    return Boolean(showForFamily && (showEntityBars || showForHeroTeam) && !isHeroUnit && !this.isDead && !this.isDestroyed)
  }

  shouldKeepEnergyBarVisible(): boolean {
    const showEntityBars = Boolean(this.context.map.debugEntityBarsVisible)
    const showForFamily = this.family === FAMILY_TYPES.unit || this.family === FAMILY_TYPES.building || this.family === FAMILY_TYPES.animal
    const isHeroUnit = this.context.controls?.heroUnit?.label === this.label
    return Boolean(showForFamily && showEntityBars && !isHeroUnit && !this.isDead && !this.isDestroyed)
  }

  drawHealthBar(): void { this.buildingView.drawHealthBar() }
  drawEnergyBar(): void { this.buildingView.drawEnergyBar() }
  drawHeroPowerBar(ratio: number): void { this.buildingView.drawHeroPowerBar(ratio) }
  removeHealthBar(): void { this.buildingView.removeHealthBar() }
  removeEnergyBar(): void { this.buildingView.removeEnergyBar() }
  removeHeroPowerBar(): void { this.buildingView.removeHeroPowerBar() }
  step(): void { if (this.hitPoints <= 0) this.die() }
  getActionCondition(target: object | null | undefined, action = this.action ?? undefined): boolean {
    return getActionCondition(this, target as CombatEntity, action)
  }
  setTextures(sheet: string): void { setUnitTexture(sheet, this as unknown as UnitTextureInstance) }

  getVisualState(): BuildingVisualState {
    const space = getEntityMapSpace(this, this.context.map)
    const cell = (space?.grid ?? this.context.map.grid)[this.i]?.[this.j]
    if (!cell) throw new Error(`Cannot spawn building on missing cell (${this.i}, ${this.j})`)
    return buildingVisualState(this, cell, this.context.map.revealEverything && this.context.controls.instanceInCamera(this))
  }

  selectForPlayedOwner(): void {
    if (this.owner.selectedBuilding !== this) {
      this.owner.unselectAll()
      this.select()
      this.owner.selectedBuilding = this
    }
    this.context.menu.setActionTarget(this)
  }

  attackAction(target: RuntimeEntity): void {
    return this.buildingCombat.attackAction(target)
  }

  bindSpriteInteractions(): void {
    const sprite = this.sprite
    sprite.on('pointertap', () => {
      const {
        context: { editor },
      } = this
      if (editor?.handleEntityInteraction(this)) return
    })
  }

  startInterval(
    callback: () => void,
    time: number,
    immediateOrName: boolean | string = 'building.interval',
    name = 'building.interval'
  ): void {
    this.stopInterval()
    const intervalName = typeof immediateOrName === 'string' ? immediateOrName : name
    this.intervalId = this.context.scheduler.add(callback, (time * 1000) / 100, intervalName)
  }

  stopInterval(): void {
    if (this.intervalId != null) {
      this.context.scheduler.remove(this.intervalId)
      this.intervalId = null
    }
  }

  startAttackInterval(callback: () => void, time: number): void {
    this.stopAttackInterval()
    callback()
    this.attackIntervalId = this.context.scheduler.add(callback, time * 1000, 'building.attack')
  }

  stopAttackInterval(): void {
    if (this.attackIntervalId != null) {
      this.context.scheduler.remove(this.attackIntervalId)
      this.attackIntervalId = null
    }
  }

  startTimeout(cb: () => void, time: number): void {
    this.stopTimeout()
    this.timeoutId = this.context.scheduler.addOneShot(cb, time * 1000, 'building.timeout')
  }

  isAttacked(instance: RuntimeEntity): void {
    return this.buildingCombat.isAttacked(instance)
  }

  detect(instance: RuntimeEntity): void {
    return this.buildingCombat.detect(instance)
  }

  scanForInitialTarget(): void {
    return this.buildingCombat.scanForInitialTarget()
  }

  select(): void {
    if (this.selected) return
    const {
      context: { menu, player },
    } = this
    this.selected = true
    this.drawHealthBar()
    this.drawEnergyBar()
    if (this.loading !== null && this.owner.isPlayed) this.updateTrainingPreview()
    canUpdateMinimap(this, player) && menu.isMiniMapActive?.() !== false && menu.updatePlayerMiniMapEvt(this.owner)
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
    const {
      context: { menu, player },
    } = this
    canUpdateMinimap(this, player) && menu.isMiniMapActive?.() !== false && menu.updatePlayerMiniMapEvt(this.owner)
  }

  getShadowTexture(): Texture | null {
    return this.buildingView.getShadowTexture()
  }

  createShadow(): BuildingShadow | null {
    return this.buildingView.createShadow()
  }

  updateShadow(shadow: BuildingShadow | null = this.shadow): void {
    this.buildingView.updateShadow(shadow)
  }

  syncShadow(): void {
    this.updateShadow()
  }

  syncVisualSettings(): void {
    this.buildingView.syncVisualSettings()
  }

  showDestruction(groundTargets: BuildingDestructionGroundTarget[]): void {
    this.buildingView.showDestruction(groundTargets)
  }

  destroy(options?: Parameters<Container['destroy']>[0]): void {
    stopFlameAmbientSound(this)
    this.trainingDayChangeUnsubscribe?.()
    this.trainingDayChangeUnsubscribe = null
    for (const entry of this.trainingQueue) {
      entry.trainingDayChangeUnsubscribe?.()
      entry.trainingDayChangeUnsubscribe = null
    }
    this.buildingTrainingPreview?.destroy()
    this.buildingTrainingPreview = null
    this.buildingView.destroy()
    this.displayObject.destroy(options)
  }

  // BuildingLifecycle
  updateTexture(): void {
    return this.buildingLifecycle.updateTexture()
  }

  finalTexture(): void {
    this.buildingView.applyFinalTexture()
  }

  generateFire(spriteId: FireAnimation): void {
    return this.buildingLifecycle.generateFire(spriteId)
  }

  onBuilt(): void {
    return this.buildingLifecycle.onBuilt()
  }

  updateHitPoints(action: string): void {
    return this.buildingLifecycle.updateHitPoints(action)
  }

  pause(): void {
    return this.buildingLifecycle.pause()
  }

  resume(): void {
    return this.buildingLifecycle.resume()
  }

  demolish(): void {
    this.buildingLifecycle.die(true)
  }

  die(): void {
    return this.buildingLifecycle.die()
  }

  clear(): void {
    return this.buildingLifecycle.clear()
  }

  // BuildingProduction
  resumeSavedTraining(): void {
    if (!this.trainingResumePending || !this.context.dayNight) return
    this.trainingResumePending = false
    this.buildingProduction.resumeSavedTraining(this.savedTrainingExtra)
    delete this.savedTrainingExtra
  }

  placeUnit(type: string, extra?: UnitCreationExtra, options?: { consumePopulationSlot?: boolean }): boolean {
    return this.buildingProduction.placeUnit(type, extra, options)
  }

  buyUnit(type: string, alreadyPaid = false, force = false, extra?: UnitCreationExtra): boolean | undefined {
    return this.buildingProduction.buyUnit(type, alreadyPaid, force, extra)
  }

  startTrainingWithUnit(trainee: UnitEntity): boolean {
    return this.buildingProduction.startTrainingWithUnit(trainee)
  }

  cancelUnits(type: string): boolean {
    return this.buildingProduction.cancelUnits(type)
  }

  cancelTrainingEntry(label: string): boolean {
    return this.buildingProduction.cancelTrainingEntry(label)
  }

  cancelAllUnitTraining(): boolean {
    return this.buildingProduction.cancelAllUnitTraining()
  }

  // BuildingInterface
  updateTrainingPreview(): void {
    this.buildingTrainingPreview?.update()
  }

  setDefaultInterface(element: HTMLElement, data: BuildingConfig, options?: EntityInfoRenderOptions): void {
    this.buildingInterface.setDefaultInterface(element, data, options)
  }
}
