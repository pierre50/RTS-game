import { AnimatedSprite, Assets, Rectangle, Sprite, Texture } from 'pixi.js'
import { Polygon } from 'pixi.js'
import { BUILDING_TYPES, FAMILY_TYPES, LABEL_TYPES } from '../../constants'
import {
  cartesianToIsometric,
  getGroundReliefLevel,
  getTexture,
  getInstanceZIndex,
  getPlainCellsAroundPoint,
  getBuildingFootprintRadius,
  getReliefLiftPixels,
  clearCellTerrainSet,
  drawInstanceBlinkingSelection,
  getBuildingAsset,
  getBuildingAssetOwner,
  getBuildingTextureNameWithSize,
  getTextureSheet,
  canUpdateMinimap,
  updateInstanceVisibility,
  playSoundCue,
  bindAnimatedSpriteToTicker,
  getRallyPointFrames,
  RALLY_POINT_SHEET_ID,
  textureRefToString,
} from '../../lib'
import { BuildingInterface } from '../../ui/BuildingInterface'
import { BuildingLifecycle } from './BuildingLifecycle'
import { BuildingProduction } from './BuildingProduction'
import { BuildingTrainingPreview } from './BuildingTrainingPreview'
import { Instance } from '../Instance'
import { BuildingCombat } from './BuildingCombat'
import { getTowerType, isTower } from '../../lib/buildings/towers'
import { getShadowsEnabled, onVisualSettingsChange } from '../../lib/settings'
import type { GameContextLike, SchedulerTaskId } from '../../types/context'
import type {
  BuildingEntity,
  CommandSound,
  EntityInterfaceLike,
  RuntimeEntity,
  UnitCreationExtra,
  UnitEntity,
  UnitSounds,
} from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { BuildingConfig, TechnologyConfig } from '../../types/config'

type BuildingTexture = Texture & { hitArea?: number[] }
type BuildingSprite = Sprite
type BuildingShadow = Sprite
type BuildingSounds = UnitSounds & { burning?: CommandSound; collapse?: CommandSound }
type QueuedTechnology = { type: string; config: TechnologyConfig }

const SHADOW_ALPHA = 0.42
const SHADOW_OFFSET_Y = 0
const shadowTextureFrameCache = new Map<string, Texture>()

export type BuildingOptions = Partial<BuildingConfig> & {
  i: number
  j: number
  type: string
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
    this.rallyPoint = null
    this.rallyPointFlag = null
    this.shadow = null
    this.visualSettingsCleanup = null

    Object.assign(this, options)
    Object.assign(this, this.owner.config.buildings[this.type])
    if (isTower(this)) {
      const effectiveType = getTowerType(this.owner)
      if (effectiveType !== this.type) Object.assign(this, this.owner.config.buildings[effectiveType])
    }
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
    if (this.type === BUILDING_TYPES.farm) {
      this.zIndex -= 0.1
    }
    this.reliefLift = -getReliefLiftPixels(getGroundReliefLevel(anchorCell))
    this.visible = map.revealEverything && controls.instanceInCamera(this)
    let spriteSheet = getBuildingTextureNameWithSize(this.size)
    if (this.type === BUILDING_TYPES.dock) {
      spriteSheet = { sheet: 'buildings/construction/dock', frame: 0 }
    }
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
      info: (element: HTMLElement) => {
        const displayType = this.assetType || (isTower(this) ? getTowerType(this.owner) : this.type)
        const assets = getBuildingAsset(displayType, getBuildingAssetOwner(this), Assets)
        this.buildingInterface.renderInfo(element, assets as BuildingConfig)
      },
      menu:
        this.owner.isPlayed || map.instantMode
          ? [...units, ...(units.length ? [context.menu.getActionRallyPointButton()] : [])]
          : [],
    }

    // Set solid zone
    const dist = getBuildingFootprintRadius(this.size)
    getPlainCellsAroundPoint(this.i, this.j, map.grid, dist, (cell: RuntimeCell) => {
      clearCellTerrainSet(cell)
      for (const corpse of cell.corpses) {
        typeof corpse.clear === 'function' && corpse.clear()
      }
      cell.has = this
      cell.solid = true
      const visiblePlayers = this.owner.visiblePlayers ? this.owner.visiblePlayers() : [this.owner]
      for (const viewer of visiblePlayers) {
        viewer.views.addViewer(cell.i, cell.j, this)
        if (viewer.views.setViewed(cell.i, cell.j)) {
          viewer.cellViewed++
        }
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

      this.sprite.on('pointertap', () => {
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

      if (this.shadow) this.addChild(this.shadow)
      this.addChild(this.sprite)
      this.buildingTrainingPreview = new BuildingTrainingPreview(this)
      this.buildingTrainingPreview.update()
      if (this.shouldKeepHealthBarVisible()) this.drawHealthBar()
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
    if (!cell) return false
    this.clearRallyPoint()
    this.rallyPoint = { i: cell.i, j: cell.j, direction }
    const sheet = Assets.cache.get(RALLY_POINT_SHEET_ID)
    const flag = new AnimatedSprite(getRallyPointFrames(sheet.textures, direction) as Texture[])
    bindAnimatedSpriteToTicker(flag, this.context.app)
    flag.animationSpeed = sheet.data.animationSpeed ?? 0.2
    flag.anchor.set(flag.texture.defaultAnchor!.x, flag.texture.defaultAnchor!.y)
    flag.x = cell.x
    flag.y = cell.y
    flag.zIndex = cell.i + cell.j
    flag.visible = this.selected
    flag.eventMode = 'none'
    flag.roundPixels = true
    flag.play()
    this.context.map.addChild(flag)
    this.rallyPointFlag = flag
    return true
  }

  clearRallyPoint(): void {
    this.rallyPointFlag?.destroy()
    this.rallyPointFlag = null
    this.rallyPoint = null
  }

  getShadowTexture(): Texture | null {
    if (!this.textureName) return null
    const sheet = getTextureSheet(this.textureName)
    const shadowAtlas = (Assets.cache.get(`${sheet}/shadow`) as Texture | undefined) ?? null
    if (!shadowAtlas || !this.sprite?.texture) return null

    const { frame, rotate } = this.sprite.texture
    const source = shadowAtlas.source
    const atlasExtraWidth = Math.max(0, source.width - this.sprite.texture.source.width)
    const atlasExtraHeight = Math.max(0, source.height - this.sprite.texture.source.height)
    const atlasPadX = atlasExtraWidth / 2
    const shadowFrameWidth = frame.width + atlasExtraWidth
    const shadowFrameHeight = frame.height + atlasExtraHeight

    if (frame.x + shadowFrameWidth > source.width || frame.y + shadowFrameHeight > source.height) return null

    const cacheKey = `${sheet}/shadow:${frame.x}:${frame.y}:${shadowFrameWidth}:${shadowFrameHeight}`
    let shadowTexture = shadowTextureFrameCache.get(cacheKey)
    if (!shadowTexture) {
      const anchorX = (this.sprite.anchor.x * frame.width + atlasPadX) / shadowFrameWidth
      const anchorY = (this.sprite.anchor.y * frame.height) / shadowFrameHeight
      shadowTexture = new Texture({
        source,
        frame: new Rectangle(frame.x, frame.y, shadowFrameWidth, shadowFrameHeight),
        orig: new Rectangle(0, 0, shadowFrameWidth, shadowFrameHeight),
        rotate,
        defaultAnchor: { x: anchorX, y: anchorY },
      })
      shadowTextureFrameCache.set(cacheKey, shadowTexture)
    }
    return shadowTexture
  }

  createShadow(): BuildingShadow | null {
    const texture = this.getShadowTexture()
    if (!texture) return null
    const shadow = new Sprite(texture)
    shadow.label = LABEL_TYPES.shadow
    shadow.eventMode = 'none'
    shadow.roundPixels = true
    this.updateShadow(shadow)
    return shadow
  }

  updateShadow(shadow: BuildingShadow | null = this.shadow): void {
    const texture = this.getShadowTexture()
    if (!texture) {
      this.shadow?.destroy()
      this.shadow = null
      return
    }
    if (!shadow) {
      shadow = new Sprite(texture)
      shadow.label = LABEL_TYPES.shadow
      shadow.eventMode = 'none'
      shadow.roundPixels = true
      this.shadow = shadow
      if (this.sprite.parent === this) {
        this.addChildAt(shadow, Math.max(0, this.getChildIndex(this.sprite)))
      }
    }
    const sprite = this.sprite
    shadow.texture = texture
    if (texture.defaultAnchor) {
      shadow.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)
    }
    shadow.zIndex = -2
    shadow.alpha = SHADOW_ALPHA
    shadow.visible = getShadowsEnabled()
    shadow.rotation = 0
    shadow.tint = 0xffffff
    shadow.scale.set(sprite.scale.x, sprite.scale.y)
    shadow.position.set(0, (this.reliefLift ?? 0) + SHADOW_OFFSET_Y)
  }

  syncVisualSettings(): void {
    if (this.shadow) {
      this.shadow.visible = getShadowsEnabled()
    }
  }

  override destroy(options?: Parameters<Instance['destroy']>[0]): void {
    this.buildingTrainingPreview?.destroy()
    this.buildingTrainingPreview = null
    this.visualSettingsCleanup?.()
    this.visualSettingsCleanup = null
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

  setDefaultInterface(element: HTMLElement, data: BuildingConfig): void {
    this.buildingInterface.setDefaultInterface(element, data)
  }
}
