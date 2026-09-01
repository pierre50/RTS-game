import type { AnimatedSprite, Graphics, Sprite, Texture } from 'pixi.js'
import { FAMILY_TYPES } from '../../constants'
import { drawInstanceBlinkingSelection, canUpdateMinimap } from '../../lib'
import { BuildingInterface } from '../../ui/entity/BuildingInterface'
import { BuildingLifecycle } from './BuildingLifecycle'
import { stopFlameAmbientSound } from './BuildingFire'
import type { FireAnimation } from './BuildingFire'
import { BuildingProduction } from './BuildingProduction'
import type { BuildingTrainingPreview } from './BuildingTrainingPreview'
import { Instance } from '../Instance'
import { BuildingCombat } from './BuildingCombat'
import { onVisualSettingsChange } from '../../lib/audio/settings'
import { createBuildingEntityInterface } from './BuildingInterfaceSetup'
import {
  activateBuiltBuilding,
  attachInitialBuildingVisuals,
  createInitialBuildingSprite,
  occupyBuildingFootprint,
  restoreBuildingRallyPoint,
  resumeInitialBuildingWork,
  setupBuildingTransform,
  stableHorsesFromOptions,
} from './BuildingSetup'
import {
  clearBuildingRallyPoint,
  createBuildingShadow,
  destroyBuildingVisuals,
  getBuildingShadowTexture,
  setBuildingRallyPoint,
  syncBuildingVisualSettings,
  updateBuildingShadow,
  type BuildingShadow,
} from './BuildingVisuals'
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
import type { RuntimeCell } from '../../types/map'
import type { ResourceAmount } from '../../types/common'
import type { BuildingConfig, TechnologyConfig } from '../../types/config'
import type { HorseTamingStatus } from '../../lib/horses/horseTaming'

type BuildingSprite = Sprite | AnimatedSprite
type BuildingSounds = UnitSounds & { burning?: CommandSound; collapse?: CommandSound }
type QueuedTechnology = { type: string; config: TechnologyConfig }

export type BuildingOptions = Partial<BuildingConfig> & {
  i: number
  j: number
  type: string
  spaceId?: string
  inventory?: BuildingEntity['inventory']
  horseAmount?: number
  stableHorses?: Array<{ horseColor?: string; tamingStatus?: HorseTamingStatus }>
  isBuilt?: boolean
  skipBuiltEffects?: boolean
}

export class Building extends Instance implements BuildingEntity {
  buildingInterface: BuildingInterface
  buildingLifecycle: BuildingLifecycle
  buildingProduction: BuildingProduction
  buildingTrainingPreview: BuildingTrainingPreview | null
  buildingCombat: BuildingCombat
  queue: string[]
  technology: QueuedTechnology | null
  loading: number | null
  isUsedBy: RuntimeEntity | null
  trainingUnit: UnitEntity | null
  trainingType: string | null
  trainingQueue: NonNullable<BuildingEntity['trainingQueue']>
  trainingStartedDay: number | null
  trainingCompleteDay: number | null
  trainingDayChangeUnsubscribe: (() => void) | null
  rallyPoint: { i: number; j: number; direction: number } | null
  rallyPointFlag: AnimatedSprite | null
  shadow: BuildingShadow | null
  shadowWasVisible: boolean
  constructionRevealSprite: Sprite | null
  constructionRevealMask: Graphics | null
  intervalId: SchedulerTaskId | null
  attackIntervalId: SchedulerTaskId | null
  declare sprite: BuildingSprite
  populationCapacityApplied!: boolean
  isBuilt?: boolean
  quantity?: number
  totalQuantity?: number
  units?: string[]
  technologies?: string[]
  horseAmount?: number
  stableHorses?: Array<{ horseColor?: string; tamingStatus?: HorseTamingStatus }>
  mountingDays?: number
  interface!: EntityInterfaceLike
  assetType?: string
  textureName?: string
  hideWhenFogged?: boolean
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
  increasePopulation?: number
  shelterCapacity?: number
  indestructible?: boolean
  containedAnimalType?: string | null
  inventory?: {
    resources?: ResourceAmount
    equipment?: string[]
  }
  visualSettingsCleanup: (() => void) | null

  constructor(options: BuildingOptions, context: GameContextLike) {
    super(context)

    const { map } = context

    this.family = FAMILY_TYPES.building
    this.buildingInterface = new BuildingInterface(this)
    this.buildingLifecycle = new BuildingLifecycle(this)
    this.buildingProduction = new BuildingProduction(this)
    this.buildingTrainingPreview = null
    this.buildingCombat = new BuildingCombat(this)
    this.queue = []
    this.technology = null
    this.loading = null
    this.isUsedBy = null
    this.trainingUnit = null
    this.trainingType = null
    this.trainingQueue = []
    this.trainingStartedDay = null
    this.trainingCompleteDay = null
    this.trainingDayChangeUnsubscribe = null
    this.stableHorses = []
    this.horseAmount = 0
    this.rallyPoint = null
    this.rallyPointFlag = null
    this.shadow = null
    this.shadowWasVisible = false
    this.constructionRevealSprite = null
    this.constructionRevealMask = null
    this.visualSettingsCleanup = null

    this.assignProperties(options)
    this.assignProperties(this.owner.config.buildings[this.type])
    this.stableHorses = stableHorsesFromOptions(options)
    this.horseAmount = this.stableHorses.length
    this.populationCapacityApplied = Boolean(options.skipBuiltEffects && this.isBuilt)

    this.intervalId = null
    this.attackIntervalId = null

    resumeInitialBuildingWork(this)

    this.quantity = this.quantity ?? this.totalQuantity
    this.hitPoints = this.hitPoints ?? (this.isBuilt ? this.totalHitPoints : 1)

    setupBuildingTransform(this)
    createInitialBuildingSprite(this)
    this.interface = createBuildingEntityInterface(this)

    if (this.sprite) {
      occupyBuildingFootprint(this)
      attachInitialBuildingVisuals(this)
    }
    this.visualSettingsCleanup = onVisualSettingsChange(() => this.syncVisualSettings())

    activateBuiltBuilding(this)
    restoreBuildingRallyPoint(this, options)
    map.addToInstanceBucket(this)
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
        context: { controls, editor },
      } = this
      if (editor?.handleEntityInteraction(this)) return
      if (controls.rallyPointController?.active && controls.rallyPointController.building === this) {
        controls.mouse.prevent = true
        drawInstanceBlinkingSelection(this)
        controls.rallyPointController.cancel({ clear: true })
        return
      }
      if (controls.rallyPointController?.active) {
        controls.mouse.prevent = true
        controls.rallyPointController.handleMouseUpOnEntity(this)
        return
      }
    })
  }

  override startInterval(
    callback: () => void,
    time: number,
    immediateOrName: boolean | string = 'building.interval',
    name = 'building.interval'
  ): void {
    this.stopInterval()
    const intervalName = typeof immediateOrName === 'string' ? immediateOrName : name
    this.intervalId = this.context.scheduler.add(callback, (time * 1000) / 100, intervalName)
  }

  override stopInterval(): void {
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

  override select(): void {
    if (this.selected) return
    const {
      context: { menu, player },
    } = this
    super.select()
    if (this.rallyPointFlag) this.rallyPointFlag.visible = true
    if (this.loading !== null && this.owner.isPlayed) this.updateTrainingPreview()
    canUpdateMinimap(this, player) && menu.isMiniMapActive?.() !== false && menu.updatePlayerMiniMapEvt(this.owner)
  }

  override unselect(): void {
    if (!this.selected) return
    super.unselect()
    if (this.rallyPointFlag) this.rallyPointFlag.visible = false
    const {
      context: { menu, player },
    } = this
    canUpdateMinimap(this, player) && menu.isMiniMapActive?.() !== false && menu.updatePlayerMiniMapEvt(this.owner)
  }

  setRallyPoint(cell: RuntimeCell | undefined, direction: number = this.context.map.randomRange(0, 1)): boolean {
    return setBuildingRallyPoint(this, cell, direction)
  }

  clearRallyPoint(): void {
    clearBuildingRallyPoint(this)
  }

  getShadowTexture(): Texture | null {
    return getBuildingShadowTexture(this)
  }

  createShadow(): BuildingShadow | null {
    return createBuildingShadow(this)
  }

  updateShadow(shadow: BuildingShadow | null = this.shadow): void {
    updateBuildingShadow(this, shadow)
  }

  syncShadow(): void {
    this.updateShadow()
  }

  syncVisualSettings(): void {
    syncBuildingVisualSettings(this)
  }

  override destroy(options?: Parameters<Instance['destroy']>[0]): void {
    stopFlameAmbientSound(this)
    this.trainingDayChangeUnsubscribe?.()
    this.trainingDayChangeUnsubscribe = null
    this.buildingTrainingPreview?.destroy()
    this.buildingTrainingPreview = null
    destroyBuildingVisuals(this)
    super.destroy(options)
  }

  // BuildingLifecycle
  updateTexture(): void {
    return this.buildingLifecycle.updateTexture()
  }

  finalTexture(): void {
    return this.buildingLifecycle.finalTexture()
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

  override pause(): void {
    return this.buildingLifecycle.pause()
  }

  override resume(): void {
    return this.buildingLifecycle.resume()
  }

  override die(): void {
    return this.buildingLifecycle.die()
  }

  clear(): void {
    return this.buildingLifecycle.clear()
  }

  // BuildingProduction
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

  cancelAllUnitTraining(): boolean {
    return this.buildingProduction.cancelAllUnitTraining()
  }

  cancelTechnology(): boolean {
    return this.buildingProduction.cancelTechnology()
  }

  upgrade(type: string): void {
    return this.buildingProduction.upgrade(type)
  }

  buyTechnology(type: string, alreadyPaid?: boolean, force?: boolean): boolean {
    return this.buildingProduction.buyTechnology(type, alreadyPaid, force)
  }

  // BuildingInterface
  updateTrainingPreview(): void {
    this.buildingTrainingPreview?.update()
  }

  setDefaultInterface(element: HTMLElement, data: BuildingConfig, options?: EntityInfoRenderOptions): void {
    this.buildingInterface.setDefaultInterface(element, data, options)
  }
}
