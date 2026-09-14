import { AnimatedSprite,Assets,Polygon,type Sprite } from 'pixi.js'
import {
CELL_HEIGHT,
CELL_WIDTH,
FADE_DURATION_MS,
FAMILY_TYPES,
LABEL_TYPES,
PASSABLE_RESOURCE_TYPES,
RESOURCE_TYPES,
} from '../constants'
import {
attachEntityShadowsToMapSpace,
cartesianToIsometric,
getDeterministicCellVariant,
getEntityCell,
getEntityMapSpace,
getGroundReliefLevel,
getInstanceZIndex,
getReliefLiftPixels,
getTexture,
isAIControlledPlayer,
parseTextureRef,
textureRefToString,
type SpriteFragmentBurstGroundTarget,
} from '../lib'
import { onVisualSettingsChange } from '../lib/audio/settings'
import { fadeOutThenClear } from '../lib/entities/entityFade'
import { logStartingWheatHarvest } from '../lib/resources/startingWheatDiagnostics'
import { resetHarvestedWheat } from '../lib/resources/wheatGrowth'
import { playerSeesTarget } from '../lib/units/playerTargetKnowledge'
import { invalidateEconomicKnowledge } from '../services/world/EconomicKnowledgeUpdates'
import type { ResourceConfig } from '../types/config'
import type { GameContextLike } from '../types/context'
import type { EntityInfoRenderOptions,EntityInterfaceLike,ResourceEntity,UnitSounds } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import { ResourceInterface } from '../ui/entity/ResourceInterface'
import { Instance } from './Instance'
import { advanceResourceWheatGrowth } from './resource/ResourceWheatGrowth'
import {
resourceFootprintCells,
resourceFragmentGroundTargets,
spawnDepletedResourceFragments,
spawnResourceTreeFragments,
} from './resources/ResourceFragments'
import { registerResourceRespawnSlot } from './resources/ResourceRespawn'
import { createResourceSprite,prepareStaticResourceTexture } from './ResourceSpriteFactory'
import {
BERRYBUSH_SHEET_ID,
EMPTY_BERRYBUSH_FRAME,
getResourceConfig,
getTerrainAssets,
pickLifecycleTextureRef,
type PlayerWithResourceMemory,
type ResourceAssets,
type ResourceDefinition,
type ResourceOptions,
} from './ResourceTexture'
import {
canApplyWindMotion,
createShadow,
isCutOrFallenTree,
isWindAnimatedWheat,
isWindMotionEligible,
resetWindMotion,
shouldUseWindMotion,
startWindMotion,
stopWindMotion,
syncShadow,
syncVisualSettings,
updateWindMotion,
type ResourceShadow,
type WindTick,
} from './ResourceVisuals'

export type { ResourceOptions } from './ResourceTexture'

export class Resource extends Instance implements ResourceEntity {
  declare spaceId?: string
  deferredSpriteBounds?: { width: number; height: number; anchor: { x: number; y: number } }
  private deferredVisuals?: () => void
  resourceInterface: ResourceInterface
  quantity!: number
  interface: EntityInterfaceLike
  declare sprite: Sprite | AnimatedSprite
  shadow: ResourceShadow | null
  windTick: WindTick | null
  windTime: number
  windPhase: number
  visualSettingsCleanup: (() => void) | null
  totalQuantity!: number
  usesTextureShadow = false
  isNaturalResource?: boolean
  isAnimated?: boolean
  assets!: ResourceAssets
  lifecycleAssets?: ResourceDefinition['lifecycleAssets']
  textureName!: string
  berrybushFullTextureName?: string
  category?: string
  sounds?: UnitSounds
  spriteScale?: number

  constructor(options: ResourceOptions, context: GameContextLike) {
    super(context)

    const {
      context: { map },
    } = this

    this.family = FAMILY_TYPES.resource
    this.resourceInterface = new ResourceInterface(this)
    this.size = 1
    this.shadow = null
    this.windTick = null
    this.windTime = 0
    this.windPhase = 0
    this.visualSettingsCleanup = null

    this.assignProperties(options)
    const config = getResourceConfig()
    this.assignProperties(config.resources[this.type])
    // Config is applied after options and would otherwise clobber a per-instance
    // totalQuantity override (e.g. a randomized node capacity) with the JSON default.
    if (typeof options.totalQuantity === 'number') this.totalQuantity = options.totalQuantity
    const space = getEntityMapSpace(this, map)
    const grid = space?.grid ?? map.grid
    const cell = grid[this.i]?.[this.j]
    if (!cell) throw new Error(`Cannot spawn resource on missing cell (${this.i}, ${this.j})`)

    this.quantity = this.quantity ?? this.totalQuantity
    invalidateEconomicKnowledge(map)
    this.hitPoints = this.hitPoints ?? this.totalHitPoints
    const [flatX, flatY] = cartesianToIsometric(this.i, this.j)
    this.x = flatX
    this.y = flatY
    this.z = cell.z
    this.zIndex = getInstanceZIndex(this)
    this.visible = false

    // Set occupancy zone
    cell.solid = !PASSABLE_RESOURCE_TYPES.has(this.type)
    cell.has = this
    this.reliefLift = -getReliefLiftPixels(getGroundReliefLevel(cell))

    this.eventMode = 'auto'

    this.interface = {
      info: (element: HTMLElement, options?: EntityInfoRenderOptions) => {
        const data = config.resources[this.type]
        this.setDefaultInterface(element, data, options)
      },
    }
    const initializeVisuals = () => this.initializeResourceVisuals(options, cell)
    if (!this.isAnimated && !context.editor && !options.isDead && !options.isDestroyed) {
      const { texture } = prepareStaticResourceTexture(this, cell)
      const scale = this.spriteScale ?? 1
      this.deferredSpriteBounds = {
        width: texture.width * scale,
        height: texture.height * scale,
        anchor: { x: texture.defaultAnchor?.x ?? 0, y: texture.defaultAnchor?.y ?? 0 },
      }
      this.deferredVisuals = initializeVisuals
      Object.defineProperty(this, 'sprite', {
        configurable: true,
        enumerable: false,
        get: () => {
          Object.defineProperty(this, 'sprite', { configurable: true, writable: true, value: undefined })
          initializeVisuals()
          return this.sprite
        },
      })
    } else initializeVisuals()
    this.visualSettingsCleanup = onVisualSettingsChange(() => this.syncVisualSettings())
    map.addToInstanceBucket(this)
  }

  private initializeResourceVisuals(options: ResourceOptions, cell: RuntimeCell): void {
    delete this.deferredVisuals
    delete this.deferredSpriteBounds
    this.sprite = createResourceSprite(this, options, cell)

    const interactiveSprite = this.sprite as Sprite & { updateAnchor?: boolean }
    interactiveSprite.updateAnchor = true
    interactiveSprite.label = LABEL_TYPES.sprite
    const spriteScale = this.spriteScale ?? 1
    this.sprite.scale.set(spriteScale)
    this.sprite.position.y = this.reliefLift ?? 0
    if (this.sprite) {
      interactiveSprite.eventMode = 'static'
      interactiveSprite.roundPixels = true

      this.sprite.on('pointertap', () => {
        this.context.editor?.handleEntityInteraction(this)
      })
      this.sprite.on('pointerup', () => {
        this.context.editor?.handleEntityInteraction(this)
      })

      this.shadow = this.createShadow()
      if (this.shadow) {
        attachEntityShadowsToMapSpace(this.context.map, this)
        this.addChild(this.sprite)
      } else {
        this.addChild(this.sprite)
      }
      this.startWindMotion()
    }
  }

  override die(immediate?: boolean) {
    if (this.isDead) {
      return
    }
    if (!immediate && this.type === RESOURCE_TYPES.wheat && this.quantity <= 0) {
      logStartingWheatHarvest(this, this.context)
    }
    if (!immediate && resetHarvestedWheat(this)) {
      this.stopWindMotion()
      if (this.sprite instanceof AnimatedSprite) this.sprite.gotoAndStop(0)
      this.syncShadow()
      this.context.menu?.refreshInventory?.()
      return
    }
    const {
      context: { player, players, map, menu },
    } = this
    if (this.selected && player.selectedOther === this) {
      player.unselectAll()
    }
    const listName = 'founded' + this.type + 's'
    for (let i = 0; i < players.length; i++) {
      if (isAIControlledPlayer(players[i]) && playerSeesTarget(players[i], this)) {
        const list = (players[i] as PlayerWithResourceMemory)[listName]
        if (list) {
          list.delete(this)
        }
      }
    }
    map.resources.delete(this)
    this.registerNaturalRespawnSlot()
    if (menu.isMiniMapActive?.() !== false) menu.updateResourcesMiniMap()
    map.removeFromInstanceBucket(this)
    this.isDead = true
    this.stopWindMotion()
    let clearWithoutFade = false
    if (this.type === RESOURCE_TYPES.tree && !immediate) {
      this.onTreeDie()
    } else {
      clearWithoutFade = !immediate && this.spawnDepletedResourceFragmentBurst()
      this.prepareFadeOut()
    }
    if (clearWithoutFade) {
      this.hideDepletedResourceSprite()
      this.context.scheduler.addOneShot(() => this.clear(), FADE_DURATION_MS, 'resource.fragmentBurstClear')
    } else {
      fadeOutThenClear(this, FADE_DURATION_MS)
    }
  }

  setCuttedTreeTexture() {
    const { sprite } = this
    const textureRef = pickLifecycleTextureRef(this.lifecycleAssets?.cut)
    if (!textureRef) return
    this.spawnTreeFragmentBurst()
    const texture = getTexture(textureRef, Assets)
    this.textureName = textureRefToString(textureRef)
    sprite.texture = texture
    const points = [-CELL_WIDTH / 2, 0, 0, -CELL_HEIGHT / 2, CELL_WIDTH / 2, 0, 0, CELL_HEIGHT / 2]
    sprite.hitArea = new Polygon(points)
    if (texture.defaultAnchor) {
      sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)
    }
    this.syncShadow()
    this.stopWindMotion()
  }

  registerNaturalRespawnSlot(): void {
    registerResourceRespawnSlot(this)
  }

  updateTexture() {
    if (this.type !== RESOURCE_TYPES.berrybush) return
    const berrybushFullTextureRef = parseTextureRef(this.berrybushFullTextureName ?? this.textureName)
    const berrybushFullFrame =
      berrybushFullTextureRef.frame > 0 ? berrybushFullTextureRef.frame : EMPTY_BERRYBUSH_FRAME + 1
    const isEmpty = (this.quantity ?? 0) <= 0
    const frame = isEmpty ? EMPTY_BERRYBUSH_FRAME : berrybushFullFrame
    if (this.berrybushFullTextureName == null && frame > 0) {
      this.berrybushFullTextureName = textureRefToString({ ...berrybushFullTextureRef, frame })
    }
    const textureRef = {
      sheet: BERRYBUSH_SHEET_ID,
      frame,
    }
    const texture = getTexture(textureRef, Assets)
    if (!texture) return

    this.textureName = textureRefToString(textureRef)
    this.sprite.texture = texture
    if (texture.defaultAnchor) {
      this.sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)
    }
    this.syncShadow()
    this.startWindMotion()
  }

  advanceWheatGrowth(frames = 1): boolean {
    return advanceResourceWheatGrowth.call(this, frames)
  }

  onTreeDie() {
    this.spawnTreeFragmentBurst()
    const textureRef = pickLifecycleTextureRef(this.lifecycleAssets?.fallen)
    if (textureRef) {
      const texture = getTexture(textureRef, Assets)
      this.textureName = textureRefToString(textureRef)
      this.sprite.texture = texture
      this.zIndex--
      this.syncShadow()
    }
    this.prepareFadeOut()
  }

  getFootprintCells(): RuntimeCell[] {
    return resourceFootprintCells(this)
  }

  getSolidFootprintCells(): RuntimeCell[] {
    return this.getFootprintCells().filter(cell => cell.has === this)
  }

  getFragmentGroundTargets(): SpriteFragmentBurstGroundTarget[] {
    return resourceFragmentGroundTargets(this)
  }

  spawnTreeFragmentBurst(): void {
    return spawnResourceTreeFragments(this)
  }

  spawnDepletedResourceFragmentBurst(): boolean {
    return spawnDepletedResourceFragments(this)
  }

  hideDepletedResourceSprite() {
    this.sprite.visible = false
    if (this.shadow) this.shadow.visible = false
  }

  prepareFadeOut() {
    this.eventMode = 'none'
    if (this.sprite) this.sprite.eventMode = 'none'
    for (const cell of this.getSolidFootprintCells()) {
      cell.has = null
      cell.corpses.add(this)
      cell.solid = false
    }
  }

  clear() {
    if (this.isDestroyed) {
      return
    }
    this.isDestroyed = true
    this.stopWindMotion()
    for (const cell of this.getFootprintCells()) {
      if (cell.has === this) {
        cell.has = null
        cell.solid = false
      }
      cell.corpses.delete(this)
    }
    this.parent?.removeChild(this)
    this.destroy({ children: true, texture: false })
  }

  setDefaultInterface(element: HTMLElement, data: ResourceConfig, options?: EntityInfoRenderOptions) {
    return this.resourceInterface.setDefaultInterface(element, data, options)
  }

  refreshTextureForTerrain() {
    if (this.isAnimated || this.type !== RESOURCE_TYPES.tree) return

    const {
      context: { map },
    } = this
    const cell = getEntityCell(this, map)
    const terrainAssets = getTerrainAssets(this.assets, cell?.type ?? '')
    if (!cell || !Array.isArray(terrainAssets) || !terrainAssets.length) return

    const textureRef = getDeterministicCellVariant(terrainAssets, this.i, this.j, map.seed)
    if (!textureRef) return
    const texture = getTexture(textureRef, Assets)
    if (!texture) return

    this.textureName = textureRefToString(textureRef)
    this.sprite.texture = texture
    if (texture.defaultAnchor) {
      this.sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)
    }
    this.syncShadow()
  }

  syncWithCell() {
    const {
      context: { map },
    } = this
    const cell = getEntityCell(this, map)
    if (!cell) return
    const [flatX, flatY] = cartesianToIsometric(this.i, this.j)
    this.x = flatX
    this.y = flatY
    this.z = cell.z
    this.zIndex = getInstanceZIndex(this)
    this.reliefLift = -getReliefLiftPixels(getGroundReliefLevel(cell))
    this.sprite.position.y = this.reliefLift ?? 0
    this.visible = true
    this.refreshTextureForTerrain()
  }

  shouldUseWindMotion(): boolean {
    return shouldUseWindMotion(this)
  }

  isWindMotionEligible(): boolean {
    return isWindMotionEligible(this)
  }

  isWindAnimatedWheat(): boolean {
    return isWindAnimatedWheat(this)
  }

  isCutOrFallenTree(): boolean {
    return isCutOrFallenTree(this)
  }

  startWindMotion(): void {
    if (this.deferredVisuals) return
    startWindMotion(this)
  }

  stopWindMotion(): void {
    if (this.deferredVisuals) return
    stopWindMotion(this)
  }

  resetWindMotion(): void {
    resetWindMotion(this)
  }

  updateWindMotion(deltaMS: number): void {
    updateWindMotion(this, deltaMS)
  }

  canApplyWindMotion(displayObject: ResourceShadow | null | undefined): displayObject is ResourceShadow {
    return canApplyWindMotion(displayObject)
  }

  createShadow(): ResourceShadow | null {
    return createShadow(this)
  }

  syncShadow(shadow = this.shadow): void {
    if (this.deferredVisuals) {
      if (!this.visible) return
      void this.sprite
      shadow = this.shadow
    }
    if (this.shouldUseWindMotion()) this.startWindMotion()
    else if (this.windTick) this.stopWindMotion()
    syncShadow(this, shadow)
  }

  syncVisualSettings(): void {
    if (this.deferredVisuals) return
    syncVisualSettings(this)
  }

  override pause(): void {
    if (this.deferredVisuals) return
    super.pause()
    ;(this.shadow as AnimatedSprite | null)?.stop?.()
  }

  override resume(): void {
    if (this.deferredVisuals) return
    if (this.type === RESOURCE_TYPES.wheat) {
      this.syncShadow()
      return
    }
    super.resume()
    ;(this.shadow as AnimatedSprite | null)?.play?.()
  }

  override destroy(options?: Parameters<Instance['destroy']>[0]): void {
    if (this.context?.map) invalidateEconomicKnowledge(this.context.map)
    this.visualSettingsCleanup?.()
    this.visualSettingsCleanup = null
    this.stopWindMotion()
    this.shadow?.parent?.removeChild(this.shadow)
    this.shadow?.destroy({ children: true, texture: false })
    this.shadow = null
    if (this.deferredVisuals) {
      delete this.deferredVisuals
      Object.defineProperty(this, 'sprite', { configurable: true, writable: true, value: undefined })
    }
    super.destroy(options)
  }
}
