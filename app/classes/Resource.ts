import { Sprite, Assets, Polygon, AnimatedSprite, Rectangle, Texture } from 'pixi.js'
import {
  cartesianToIsometric,
  getGroundReliefLevel,
  getInstanceZIndex,
  getReliefLiftPixels,
  randomRange,
  bindAnimatedSpriteToTicker,
  getAnimationFrames,
  getDeterministicCellVariant,
  getTexture,
  getTextureSheet,
  getTextureByFrame,
  textureRefToString,
} from '../lib'
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  FADE_DURATION_MS,
  FAMILY_TYPES,
  PLAYER_TYPES,
  LABEL_TYPES,
  RESOURCE_TYPES,
} from '../constants'
import { Instance } from './Instance'
import { ResourceInterface } from '../ui/ResourceInterface'
import { fadeOutThenClear } from '../lib/entityFade'
import { getResourceWindAnimationEnabled, getShadowsEnabled, onVisualSettingsChange } from '../lib/settings'
import type { GameContextLike } from '../types/context'
import type { RuntimeEntity } from '../types/entities'
import type { ResourceConfig } from '../types/config'
import type { EntityInfoRenderOptions, EntityInterfaceLike, ResourceEntity, UnitSounds } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { TextureRef } from '../lib'

type ResourceAssetList = TextureRef[]
type ResourceAssetsByTerrain = Record<string, ResourceAssetList>
type ResourceAssets = string | TextureRef | ResourceAssetList | ResourceAssetsByTerrain
type ResourceDefinition = ResourceConfig & {
  assets: ResourceAssets
  lifecycleAssets?: {
    fallen?: string
    cut?: string
  }
  isAnimated?: boolean
  sounds?: UnitSounds
}
type ResourceConfigCache = {
  resources: Record<string, ResourceDefinition>
  units: {
    Villager: {
      sounds: UnitSounds
    }
  }
}
type PlayerWithResourceMemory = PlayerLike & Record<string, Set<RuntimeEntity> | undefined>
type TextureWithCacheIds = Texture & { textureCacheIds?: string[] }
type ResourceShadow = Sprite | AnimatedSprite
type WindTick = (ticker: { deltaMS?: number; elapsedMS?: number }) => void
const resourceShadowTextureFrameCache = new Map<string, Texture>()

const SHADOW_MASK_ALPHA = 1
const SHADOW_SCALE_X = 1.02
const SHADOW_SCALE_Y = -0.5
const WIND_AMPLITUDE = 0.018
const WIND_ROTATION = 0.006
const WIND_SPEED = 0.0018
const BERRYBUSH_SHEET_ID = 'resources/berrybush'
const EMPTY_BERRYBUSH_FRAME = 0

export type ResourceOptions = Partial<ResourceDefinition> & {
  currentFrame?: number
  i: number
  isNaturalResource?: boolean
  j: number
  type: string
  textureName?: string
  startsMature?: boolean
}

function getResourceConfig(): ResourceConfigCache {
  return Assets.cache.get('config') as ResourceConfigCache
}

function getTerrainAssets(
  assets: ResourceAssets | undefined,
  terrainType: string
): string | TextureRef | ResourceAssetList | undefined {
  if (!assets) return undefined
  if (typeof assets === 'string' || Array.isArray(assets)) return assets
  if ('sheet' in assets) return assets as TextureRef
  const terrainAssets = assets as ResourceAssetsByTerrain
  return terrainAssets[terrainType] || Object.values(terrainAssets).find(value => Array.isArray(value))
}

function getShadowTexture(sheet: string, spriteTexture: Texture, spriteAnchor: { x: number; y: number }): Texture | null {
  const shadowAtlasId = `${sheet}/shadow`
  const shadowAtlas = Assets.cache.has(shadowAtlasId)
    ? ((Assets.cache.get(shadowAtlasId) as Texture | undefined) ?? null)
    : null
  if (!shadowAtlas) return null

  const { frame, rotate } = spriteTexture
  const source = shadowAtlas.source
  const atlasExtraWidth = Math.max(0, source.width - spriteTexture.source.width)
  const atlasExtraHeight = Math.max(0, source.height - spriteTexture.source.height)
  const atlasPadX = atlasExtraWidth / 2
  const shadowFrameWidth = frame.width + atlasExtraWidth
  const shadowFrameHeight = frame.height + atlasExtraHeight

  if (frame.x + shadowFrameWidth > source.width || frame.y + shadowFrameHeight > source.height) return null

  const cacheKey = `${sheet}/shadow:${frame.x}:${frame.y}:${shadowFrameWidth}:${shadowFrameHeight}`
  let shadowTexture = resourceShadowTextureFrameCache.get(cacheKey)
  if (!shadowTexture) {
    const anchorX = (spriteAnchor.x * frame.width + atlasPadX) / shadowFrameWidth
    const anchorY = (spriteAnchor.y * frame.height) / shadowFrameHeight
    shadowTexture = new Texture({
      source,
      frame: new Rectangle(frame.x, frame.y, shadowFrameWidth, shadowFrameHeight),
      orig: new Rectangle(0, 0, shadowFrameWidth, shadowFrameHeight),
      rotate,
      defaultAnchor: { x: anchorX, y: anchorY },
    })
    resourceShadowTextureFrameCache.set(cacheKey, shadowTexture)
  }
  return shadowTexture
}

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

    const startsMature = options.startsMature === true
    this.assignProperties(options)
    const config = getResourceConfig()
    this.assignProperties(config.resources[this.type])

    this.quantity = this.quantity ?? this.totalQuantity
    this.hitPoints = this.hitPoints ?? this.totalHitPoints
    const [flatX, flatY] = cartesianToIsometric(this.i, this.j)
    this.x = flatX
    this.y = flatY
    this.z = map.grid[this.i][this.j].z
    this.zIndex = getInstanceZIndex(this)
    this.visible = false

    // Set solid zone
    const cell = map.grid[this.i][this.j]
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
    if (this.isAnimated) {
      const spritesheetJump = Assets.cache.get(this.assets as string)
      const animatedSprite = new AnimatedSprite(getAnimationFrames(spritesheetJump.textures) as Texture[])
      bindAnimatedSpriteToTicker(animatedSprite, this.context.app)
      animatedSprite.animationSpeed = spritesheetJump.data?.animationSpeed ?? 0.2
      animatedSprite.loop = spritesheetJump.data?.loop ?? true
      if (animatedSprite.texture.defaultAnchor) {
        animatedSprite.anchor.copyFrom(animatedSprite.texture.defaultAnchor)
      }
      if (this.type === RESOURCE_TYPES.wheat) {
        animatedSprite.onFrameChange = () => {
          if (this.isWindAnimatedWheat()) this.startWindMotion()
        }
        animatedSprite.onComplete = () => this.startWindMotion()
      }
      this.sprite = animatedSprite
      if (this.type === RESOURCE_TYPES.wheat) {
        const lastFrame = Math.max(0, animatedSprite.textures.length - 1)
        const frame = startsMature
          ? lastFrame
          : Math.max(0, Math.min(lastFrame, Math.floor(options.currentFrame ?? 0)))
        animatedSprite.gotoAndStop(frame)
        if (this.isWindAnimatedWheat()) this.startWindMotion()
      } else {
        animatedSprite.play()
      }
    } else {
      const terrainAssets = getTerrainAssets(this.assets, cell.type)
      const textureRef =
        this.textureName ||
        (typeof terrainAssets === 'string'
          ? { sheet: terrainAssets, frame: 0 }
          : Array.isArray(terrainAssets)
            ? map.randomItem(terrainAssets)
            : terrainAssets)
      if (!textureRef) {
        throw new Error(`Missing texture for resource ${this.type} on ${cell.type}`)
      }
      const texture = getTexture(textureRef, Assets)
      const textureFile =
        (texture as TextureWithCacheIds).textureCacheIds?.[0] || `${textureRefToString(textureRef)}.png`
      const spritesheet = Assets.cache.get(getTextureSheet(textureRef))
      this.textureName = textureRefToString(textureRef)
      this.sprite = Sprite.from(texture)
      this.sprite.hitArea =
        spritesheet?.data?.frames?.[textureFile]?.hitArea && new Polygon(spritesheet.data.frames[textureFile].hitArea)
    }

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
        this.context.map.shadowLayer?.addChild(this.shadow)
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
      if (players[i].type === PLAYER_TYPES.ai) {
        const list = (players[i] as PlayerWithResourceMemory)[listName]
        if (list) {
          list.delete(this)
        }
      }
    }
    map.resources.delete(this)
    this.registerNaturalRespawnSlot()
    menu.updateResourcesMiniMap()
    map.removeFromInstanceBucket(this)
    this.isDead = true
    this.stopWindMotion()
    if (this.type === RESOURCE_TYPES.tree && !immediate) {
      this.onTreeDie()
    } else {
      this.prepareFadeOut()
    }
    fadeOutThenClear(this, FADE_DURATION_MS)
  }

  setCuttedTreeTexture() {
    const { sprite } = this
    const sheetId = this.lifecycleAssets?.cut
    if (!sheetId) return
    const frameIndex = randomRange(0, 3)
    const texture = getTextureByFrame(sheetId, frameIndex, Assets)
    this.textureName = textureRefToString({ sheet: sheetId, frame: frameIndex })
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
    const textureRef = {
      sheet: BERRYBUSH_SHEET_ID,
      frame: (this.quantity ?? 0) <= 0 ? EMPTY_BERRYBUSH_FRAME : 1,
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
    const sheetId = this.lifecycleAssets?.fallen
    if (sheetId) {
      const frameIndex = randomRange(0, 3)
      const texture = getTextureByFrame(sheetId, frameIndex, Assets)
      this.textureName = textureRefToString({ sheet: sheetId, frame: frameIndex })
      this.sprite.texture = texture
      this.zIndex--
      this.syncShadow()
    }
    this.prepareFadeOut()
  }

  prepareFadeOut() {
    const {
      context: { map },
    } = this
    this.eventMode = 'none'
    if (this.sprite) this.sprite.eventMode = 'none'
    if (map.grid[this.i][this.j].has === this) {
      map.grid[this.i][this.j].has = null
      map.grid[this.i][this.j].corpses.add(this)
      map.grid[this.i][this.j].solid = false
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
    if (map.grid[this.i][this.j].has === this) {
      map.grid[this.i][this.j].has = null
      map.grid[this.i][this.j].solid = false
    }
    map.grid[this.i][this.j].corpses.delete(this)
    map.removeChild(this)
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
    const cell = map.grid[this.i]?.[this.j]
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
    const cell = map.grid[this.i]?.[this.j]
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
    return !this.isDestroyed && !this.destroyed && this.isWindMotionEligible() && getResourceWindAnimationEnabled()
  }

  isWindMotionEligible(): boolean {
    return (
      !this.isDead &&
      !this.isCutOrFallenTree() &&
      (this.type === RESOURCE_TYPES.tree || this.type === RESOURCE_TYPES.berrybush || this.isWindAnimatedWheat())
    )
  }

  isWindAnimatedWheat(): boolean {
    if (this.type !== RESOURCE_TYPES.wheat || !(this.sprite instanceof AnimatedSprite)) return false
    return (
      this.sprite.currentFrame > 0 ||
      (!this.sprite.playing && this.sprite.currentFrame >= this.sprite.textures.length - 1)
    )
  }

  isCutOrFallenTree(): boolean {
    if (this.type !== RESOURCE_TYPES.tree || !this.textureName) return false
    const sheet = getTextureSheet(this.textureName)
    return sheet === this.lifecycleAssets?.cut || sheet === this.lifecycleAssets?.fallen
  }

  startWindMotion(): void {
    if (!this.shouldUseWindMotion() || this.windTick || !this.canApplyWindMotion(this.sprite)) return
    this.windPhase = ((this.i * 37 + this.j * 17) % 360) * (Math.PI / 180)
    this.windTick = ticker => this.updateWindMotion(ticker.deltaMS ?? ticker.elapsedMS ?? 16.67)
    this.context.app.ticker.add(this.windTick)
  }

  stopWindMotion(): void {
    if (this.windTick) {
      this.context.app.ticker.remove(this.windTick)
      this.windTick = null
    }
    this.resetWindMotion()
  }

  resetWindMotion(): void {
    const sprite = this.sprite
    if (!this.canApplyWindMotion(sprite)) return
    sprite.skew.x = 0
    sprite.rotation = 0
    if (this.canApplyWindMotion(this.shadow)) {
      this.shadow.skew.x = 0
      this.shadow.rotation = 0
    }
  }

  updateWindMotion(deltaMS: number): void {
    const sprite = this.sprite
    if (!this.canApplyWindMotion(sprite)) {
      this.stopWindMotion()
      return
    }
    if (this.context.paused) return
    if (!this.shouldUseWindMotion()) {
      this.resetWindMotion()
      return
    }
    this.windTime += deltaMS
    const sway = Math.sin(this.windPhase + this.windTime * WIND_SPEED)
    const secondary = Math.sin(this.windPhase * 0.7 + this.windTime * WIND_SPEED * 0.47)
    sprite.skew.x = sway * WIND_AMPLITUDE
    sprite.rotation = secondary * WIND_ROTATION
    if (this.canApplyWindMotion(this.shadow)) {
      this.shadow.skew.x = sprite.skew.x * 0.45
    }
  }

  canApplyWindMotion(displayObject: ResourceShadow | null | undefined): displayObject is ResourceShadow {
    return Boolean(displayObject && !displayObject.destroyed && displayObject.skew)
  }

  createShadow(): ResourceShadow | null {
    const shadowTexture =
      this.sprite && this.textureName ? getShadowTexture(getTextureSheet(this.textureName), this.sprite.texture, this.sprite.anchor) : null
    this.usesTextureShadow = Boolean(shadowTexture)
    const shadow = shadowTexture
      ? new Sprite(shadowTexture)
      : this.sprite instanceof AnimatedSprite
        ? new AnimatedSprite(this.sprite.textures as Texture[])
        : new Sprite(this.sprite.texture)
    if (!shadowTexture && shadow instanceof AnimatedSprite) {
      bindAnimatedSpriteToTicker(shadow, this.context.app)
    }
    shadow.label = LABEL_TYPES.shadow
    shadow.eventMode = 'none'
    shadow.roundPixels = true
    if (!shadowTexture) {
      shadow.tint = 0x000000
      shadow.alpha = SHADOW_MASK_ALPHA
    }
    shadow.zIndex = -2
    this.syncShadow(shadow)
    return shadow
  }

  syncShadow(shadow = this.shadow): void {
    if (!shadow || !this.sprite) return
    shadow.visible = getShadowsEnabled() && this.visible && !this.isDestroyed
    if (this.usesTextureShadow && shadow instanceof Sprite) {
      const shadowTexture = this.textureName ? getShadowTexture(getTextureSheet(this.textureName), this.sprite.texture, this.sprite.anchor) : null
      if (shadowTexture) {
        shadow.texture = shadowTexture
        if (shadowTexture.defaultAnchor) {
          shadow.anchor.set(shadowTexture.defaultAnchor.x, shadowTexture.defaultAnchor.y)
        } else {
          shadow.anchor.set(this.sprite.anchor.x, this.sprite.anchor.y)
        }
        shadow.alpha = SHADOW_MASK_ALPHA
        shadow.rotation = 0
        shadow.scale.set(this.sprite.scale.x, this.sprite.scale.y)
        shadow.position.set(this.x, this.y + (this.reliefLift ?? 0))
        shadow.tint = 0xffffff
        return
      }
      this.usesTextureShadow = false
    }
    if (this.sprite instanceof AnimatedSprite && shadow instanceof AnimatedSprite) {
      const frame = Math.min(this.sprite.currentFrame, Math.max(this.sprite.textures.length - 1, 0))
      shadow.textures = this.sprite.textures
      shadow.animationSpeed = this.sprite.animationSpeed
      shadow.loop = this.sprite.loop
      shadow.anchor.set(this.sprite.anchor.x, this.sprite.anchor.y)
      if (this.sprite.playing) {
        shadow.gotoAndPlay(frame)
      } else {
        shadow.gotoAndStop(frame)
      }
    } else if (this.sprite instanceof Sprite && shadow instanceof Sprite) {
      shadow.texture = this.sprite.texture
      shadow.anchor.set(this.sprite.anchor.x, this.sprite.anchor.y)
    }
    shadow.alpha = SHADOW_MASK_ALPHA
    shadow.rotation = 0
    shadow.scale.set(Math.abs(this.sprite.scale.x) * SHADOW_SCALE_X, Math.abs(this.sprite.scale.y) * SHADOW_SCALE_Y)
    shadow.position.set(this.x, this.y + (this.reliefLift ?? 0))
  }

  syncVisualSettings(): void {
    if (this.shadow) {
      this.shadow.visible = getShadowsEnabled() && this.visible && !this.isDestroyed
    }
    if (getResourceWindAnimationEnabled()) {
      this.startWindMotion()
    } else {
      this.stopWindMotion()
    }
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
