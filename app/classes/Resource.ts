import { Assets, Polygon, AnimatedSprite, type Sprite } from 'pixi.js'
import {
  cartesianToIsometric,
  attachEntityShadowsToMapSpace,
  getGroundReliefLevel,
  getInstanceZIndex,
  getReliefLiftPixels,
  getDeterministicCellVariant,
  getTexture,
  getEntityMapSpace,
  getEntityCell,
  isAIControlledPlayer,
  parseTextureRef,
  spawnSpriteFragmentBurst,
  textureRefToString,
} from '../lib'
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  FADE_DURATION_MS,
  FAMILY_TYPES,
  LABEL_TYPES,
  RESOURCE_TYPES,
} from '../constants'
import { Instance } from './Instance'
import { ResourceInterface } from '../ui/entity/ResourceInterface'
import { fadeOutThenClear } from '../lib/entities/entityFade'
import { onVisualSettingsChange } from '../lib/audio/settings'
import { createResourceSprite } from './ResourceSpriteFactory'
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
import type { GameContextLike } from '../types/context'
import type { ResourceConfig } from '../types/config'
import type { EntityInfoRenderOptions, EntityInterfaceLike, ResourceEntity, UnitSounds } from '../types/entities'

export type { ResourceOptions } from './ResourceTexture'

export class Resource extends Instance implements ResourceEntity {
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
    const space = getEntityMapSpace(this, map)
    const grid = space?.grid ?? map.grid
    const cell = grid[this.i][this.j]

    this.quantity = this.quantity ?? this.totalQuantity
    this.hitPoints = this.hitPoints ?? this.totalHitPoints
    const [flatX, flatY] = cartesianToIsometric(this.i, this.j)
    this.x = flatX
    this.y = flatY
    this.z = cell.z
    this.zIndex = getInstanceZIndex(this)
    this.visible = false

    // Set solid zone
    cell.solid = true
    cell.has = this
    this.reliefLift = -getReliefLiftPixels(getGroundReliefLevel(cell))

    this.eventMode = 'auto'

    this.interface = {
      info: (element: HTMLElement, options?: EntityInfoRenderOptions) => {
        const data = config.resources[this.type]
        this.setDefaultInterface(element, data, options)
      },
    }
    this.sprite = createResourceSprite(this, options, cell)

    const interactiveSprite = this.sprite as Sprite & { updateAnchor?: boolean }
    interactiveSprite.updateAnchor = true
    interactiveSprite.label = LABEL_TYPES.sprite
    const spriteScale = this.spriteScale ?? 1
    this.sprite.scale.set(spriteScale)
    this.sprite.position.y = this.reliefLift
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
    this.visualSettingsCleanup = onVisualSettingsChange(() => this.syncVisualSettings())
    map.addToInstanceBucket(this)
  }

  override die(immediate?: boolean) {
    if (this.isDead) {
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
      if (isAIControlledPlayer(players[i])) {
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
    if (!this.isNaturalResource) return
    if (this.type !== RESOURCE_TYPES.berrybush && this.type !== RESOURCE_TYPES.wheat) return
    const slots = this.context.map.naturalResourceRespawnSlots ?? (this.context.map.naturalResourceRespawnSlots = [])
    slots.push({
      i: this.i,
      isDestroyed: true,
      isNaturalResource: true,
      j: this.j,
      label: this.label,
      textureName: this.type === RESOURCE_TYPES.berrybush ? this.textureName : undefined,
      type: this.type,
    })
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
    if (this.type !== RESOURCE_TYPES.wheat || !(this.sprite instanceof AnimatedSprite)) return false
    if (this.isDead || this.isDestroyed) return false
    const lastFrame = Math.max(0, this.sprite.textures.length - 1)
    const currentFrame = Math.max(0, Math.min(lastFrame, this.sprite.currentFrame ?? 0))
    const nextFrame = Math.min(lastFrame, currentFrame + Math.max(1, Math.floor(frames)))
    if (nextFrame === currentFrame) return false
    this.sprite.gotoAndStop(nextFrame)
    this.syncShadow()
    if (this.isWindAnimatedWheat()) this.startWindMotion()
    return true
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

  spawnTreeFragmentBurst() {
    spawnSpriteFragmentBurst({
      context: this.context,
      host: this,
      sprite: this.sprite,
      layer: this.parent,
      fragmentSize: 12,
      maxFragments: 18,
      durationMs: 940,
      gravity: 0.0021,
      minSpeed: 0.012,
      maxSpeed: 0.07,
      upwardVelocity: 0.035,
      settleToBottom: true,
      lockX: true,
      settleSpread: 22,
      settleStrength: 0.00007,
      groundBounce: 0.12,
    })
  }

  spawnDepletedResourceFragmentBurst(): boolean {
    if (this.type === RESOURCE_TYPES.berrybush || this.type === RESOURCE_TYPES.wheat) {
      spawnSpriteFragmentBurst({
        context: this.context,
        host: this,
        sprite: this.sprite,
        layer: this.parent,
        fragmentSize: 12,
        maxFragments: 12,
        durationMs: 760,
        gravity: 0.0017,
        minSpeed: 0.006,
        maxSpeed: 0.035,
        upwardVelocity: 0.018,
        settleToBottom: true,
        lockX: true,
        groundBounce: 0.08,
      })
      return true
    }

    if (
      this.type === RESOURCE_TYPES.stone ||
      this.type === RESOURCE_TYPES.gold ||
      this.type === RESOURCE_TYPES.copper ||
      this.type === RESOURCE_TYPES.iron
    ) {
      spawnSpriteFragmentBurst({
        context: this.context,
        host: this,
        sprite: this.sprite,
        layer: this.parent,
        fragmentSize: 12,
        maxFragments: 14,
        durationMs: 880,
        gravity: 0.0025,
        minSpeed: 0.004,
        maxSpeed: 0.026,
        upwardVelocity: 0.01,
        settleToBottom: true,
        lockX: true,
        groundBounce: 0.05,
      })
      return true
    }
    return false
  }

  hideDepletedResourceSprite() {
    this.sprite.visible = false
    if (this.shadow) this.shadow.visible = false
  }

  prepareFadeOut() {
    const {
      context: { map },
    } = this
    this.eventMode = 'none'
    if (this.sprite) this.sprite.eventMode = 'none'
    const cell = getEntityCell(this, map)
    if (cell?.has === this) {
      cell.has = null
      cell.corpses.add(this)
      cell.solid = false
    }
  }

  clear() {
    if (this.isDestroyed) {
      return
    }
    const {
      context: { map },
    } = this
    this.isDestroyed = true
    this.stopWindMotion()
    const cell = getEntityCell(this, map)
    if (cell?.has === this) {
      cell.has = null
      cell.solid = false
    }
    cell?.corpses.delete(this)
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
    this.sprite.position.y = this.reliefLift
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
    startWindMotion(this)
  }

  stopWindMotion(): void {
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
    syncShadow(this, shadow)
  }

  syncVisualSettings(): void {
    syncVisualSettings(this)
  }

  override pause(): void {
    super.pause()
    ;(this.shadow as AnimatedSprite | null)?.stop?.()
  }

  override resume(): void {
    if (this.type === RESOURCE_TYPES.wheat) {
      this.syncShadow()
      return
    }
    super.resume()
    ;(this.shadow as AnimatedSprite | null)?.play?.()
  }

  override destroy(options?: Parameters<Instance['destroy']>[0]): void {
    this.visualSettingsCleanup?.()
    this.visualSettingsCleanup = null
    this.stopWindMotion()
    this.shadow?.parent?.removeChild(this.shadow)
    this.shadow?.destroy({ children: true, texture: false })
    this.shadow = null
    super.destroy(options)
  }
}
