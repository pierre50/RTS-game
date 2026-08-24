import { Assets, Sprite } from 'pixi.js'
import { Polygon } from 'pixi.js'
import type { AnimatedSprite, Texture } from 'pixi.js'
import { FAMILY_TYPES, LABEL_TYPES } from '../../constants'
import {
  cartesianToIsometric,
  getGroundReliefLevel,
  getTexture,
  getInstanceZIndex,
  getBuildingFootprintCells,
  getReliefLiftPixels,
  clearCellTerrainSet,
  drawInstanceBlinkingSelection,
  getBuildingAsset,
  getBuildingAssetOwner,
  getBuildingTextureNameWithSize,
  canUpdateMinimap,
  updateInstanceVisibility,
  playSoundCue,
  STABLE_HORSE_CAPACITY,
  textureRefToString,
} from '../../lib'
import { BuildingInterface } from '../../ui/BuildingInterface'
import { BuildingLifecycle } from './BuildingLifecycle'
import { BuildingProduction } from './BuildingProduction'
import { BuildingTrainingPreview } from './BuildingTrainingPreview'
import { Instance } from '../Instance'
import { BuildingCombat } from './BuildingCombat'
import { onVisualSettingsChange } from '../../lib/settings'
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
import type { BuildingConfig, TechnologyConfig } from '../../types/config'

type BuildingTexture = Texture & { hitArea?: number[] }
type BuildingSprite = Sprite | AnimatedSprite
type BuildingSounds = UnitSounds & { burning?: CommandSound; collapse?: CommandSound }
type QueuedTechnology = { type: string; config: TechnologyConfig }

export type BuildingOptions = Partial<BuildingConfig> & {
  i: number
  j: number
  type: string
  horseAmount?: number
  stableHorses?: Array<{ horseColor?: string }>
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
  rallyPoint: { i: number; j: number; direction: number } | null
  rallyPointFlag: AnimatedSprite | null
  shadow: BuildingShadow | null
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
  stableHorses?: Array<{ horseColor?: string }>
  mountingTime?: number
  interface!: EntityInterfaceLike
  assetType?: string
  textureName?: string
  accept?: string[]
  visibilityTimeout?: ReturnType<typeof setTimeout>
  sounds?: BuildingSounds
  projectile?: string
  rateOfFire!: number
  range?: number
  hasActiveBurningSound?: boolean
  increasePopulation?: number
  visualSettingsCleanup: (() => void) | null

  constructor(options: BuildingOptions, context: GameContextLike) {
    super(context)

    const { map, controls } = context

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
    this.stableHorses = []
    this.horseAmount = 0
    this.rallyPoint = null
    this.rallyPointFlag = null
    this.shadow = null
    this.visualSettingsCleanup = null

    this.assignProperties(options)
    this.assignProperties(this.owner.config.buildings[this.type])
    this.stableHorses = Array.isArray(options.stableHorses)
      ? [...options.stableHorses]
      : Array.from(
          { length: Math.max(0, Math.min(STABLE_HORSE_CAPACITY, Number(options.horseAmount) || 0)) },
          () => ({})
        )
    this.horseAmount = this.stableHorses.length
    this.populationCapacityApplied = Boolean(options.skipBuiltEffects && this.isBuilt)

    this.intervalId = null
    this.attackIntervalId = null

    if (this.queue.length) {
      this.buyUnit(this.queue[0], true, true)
    } else {
      const queuedTechnology = this.technology as QueuedTechnology | null
      if (queuedTechnology) this.buyTechnology(queuedTechnology.type, true, true)
    }

    this.quantity = this.quantity ?? this.totalQuantity
    this.hitPoints = this.hitPoints ?? (this.isBuilt ? this.totalHitPoints : 1)

    const anchorCell = map.grid[this.i][this.j]
    const [flatX, flatY] = cartesianToIsometric(this.i, this.j)
    this.x = flatX
    this.y = flatY
    this.z = anchorCell.z
    this.zIndex = getInstanceZIndex(this)
    this.reliefLift = -getReliefLiftPixels(getGroundReliefLevel(anchorCell))
    this.visible = map.revealEverything && controls.instanceInCamera(this)
    const spriteSheet = getBuildingTextureNameWithSize(this.size)
    this.textureName = textureRefToString(spriteSheet!)
    const texture = getTexture(spriteSheet!, Assets) as BuildingTexture
    this.sprite = Sprite.from(texture)
    const interactiveSprite = this.sprite as Sprite & { updateAnchor?: boolean }
    interactiveSprite.updateAnchor = true
    this.sprite.label = LABEL_TYPES.sprite
    this.sprite.hitArea = texture.hitArea
      ? new Polygon(texture.hitArea)
      : new Polygon([-32 * this.size, 0, 0, -16 * this.size, 32 * this.size, 0, 0, 16 * this.size])
    this.sprite.position.y = this.reliefLift
    this.shadow = this.createShadow()
    const units = context.editor
      ? []
      : (this.units || []).map((key: string) => context.menu.getActionUnitButton(key, this))
    this.interface = {
      info: (element: HTMLElement, options?: EntityInfoRenderOptions) => {
        const displayType = this.assetType || this.type
        const assets = getBuildingAsset(displayType, getBuildingAssetOwner(this), Assets)
        this.buildingInterface.renderInfo(element, assets as BuildingConfig, options)
      },
      menu:
        this.owner.isPlayed || map.instantMode
          ? [...units, ...(units.length ? [context.menu.getActionRallyPointButton()] : [])]
          : [],
    }

    // Set solid zone
    getBuildingFootprintCells(this.i, this.j, map.grid, this.size, (cell: RuntimeCell) => {
      clearCellTerrainSet(cell)
      for (const corpse of cell.corpses) {
        typeof corpse.clear === 'function' && corpse.clear()
      }
      cell.has = this
      cell.solid = true
      this.owner.views.addViewer(cell.i, cell.j, this)
      if (this.owner.views.setViewed(cell.i, cell.j)) {
        this.owner.cellViewed++
      }
      cell.viewBy = new Set(this.context.player.views.getViewers(cell.i, cell.j))
      if (this.context.player.views.hasViewer(cell.i, cell.j, this) && !map.revealEverything) {
        cell.removeFog()
      }
      return true
    })

    if (this.sprite) {
      this.sprite.eventMode = 'static'
      this.sprite.roundPixels = true

      this.bindSpriteInteractions()

      if (this.shadow) this.context.map.shadowLayer?.addChild(this.shadow)
      this.addChild(this.sprite)
      this.buildingTrainingPreview = new BuildingTrainingPreview(this)
      this.buildingTrainingPreview.update()
      if (this.shouldKeepHealthBarVisible()) this.drawHealthBar()
      if (this.shouldKeepHealthBarVisible()) this.drawEnergyBar()
    }
    this.visualSettingsCleanup = onVisualSettingsChange(() => this.syncVisualSettings())

    if (this.isBuilt) {
      this.visibilityTimeout = setTimeout(() => {
        updateInstanceVisibility(this)
        this.scanForInitialTarget()
      })
      this.finalTexture()
      this.onBuilt()
    }
    const rallyPoint = options.rallyPoint as { i: number; j: number; direction: number } | undefined
    if (rallyPoint) {
      this.setRallyPoint(map.grid[rallyPoint.i]?.[rallyPoint.j], rallyPoint.direction)
    }
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
    if (this.owner.isPlayed && this.sounds?.create) playSoundCue(this.sounds.create)
    super.select()
    if (this.rallyPointFlag) this.rallyPointFlag.visible = true
    if (this.loading !== null && this.owner.isPlayed) this.updateInterfaceLoading()
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner)
  }

  override unselect(): void {
    if (!this.selected) return
    super.unselect()
    if (this.rallyPointFlag) this.rallyPointFlag.visible = false
    const {
      context: { menu, player },
    } = this
    canUpdateMinimap(this, player) && menu.updatePlayerMiniMapEvt(this.owner)
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

  generateFire(spriteId: string): void {
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

  requestUnitTraining(type: string, extra?: UnitCreationExtra, trainee?: UnitEntity | null): boolean {
    return this.buildingProduction.requestUnitTraining(type, extra, trainee)
  }

  startTrainingWithUnit(trainee: UnitEntity): boolean {
    return this.buildingProduction.startTrainingWithUnit(trainee)
  }

  cancelTrainingForUnit(trainee: UnitEntity): boolean {
    return this.buildingProduction.cancelTrainingForUnit(trainee)
  }

  cancelUnits(type: string): boolean {
    return this.buildingProduction.cancelUnits(type)
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
  updateInterfaceLoading(): void {
    this.buildingTrainingPreview?.update()
    this.buildingInterface.updateLoading()
  }

  getLoadingElement(): HTMLDivElement {
    return this.buildingInterface.getLoadingElement()
  }

  setDefaultInterface(element: HTMLElement, data: BuildingConfig, options?: EntityInfoRenderOptions): void {
    this.buildingInterface.setDefaultInterface(element, data, options)
  }
}
