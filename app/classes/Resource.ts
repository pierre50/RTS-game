import { Sprite, Assets, Polygon, AnimatedSprite, type Texture } from 'pixi.js'
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
  parseTextureRef,
  spawnSpriteFragmentBurst,
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
import { onVisualSettingsChange } from '../lib/settings'
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
  type TextureWithCacheIds,
  type WindTick,
} from './ResourceVisuals'
import type { GameContextLike } from '../types/context'
import type { RuntimeEntity } from '../types/entities'
import type { ResourceConfig } from '../types/config'
import type { EntityInfoRenderOptions, EntityInterfaceLike, ResourceEntity, UnitSounds } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { TextureRef } from '../lib'

type ResourceAssetList = TextureRef[]
type ResourceAssetsByTerrain = Record<string, ResourceAssetList>
type ResourceAssets = string | TextureRef | ResourceAssetList | ResourceAssetsByTerrain
type ResourceLifecycleAsset =
  | string
  | {
      sheet: string
      frames?: number[]
    }
type ResourceDefinition = ResourceConfig & {
  assets: ResourceAssets
  lifecycleAssets?: {
    fallen?: ResourceLifecycleAsset
    cut?: ResourceLifecycleAsset
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
const BERRYBUSH_SHEET_ID = 'resources/berrybush'
const EMPTY_BERRYBUSH_FRAME = 0
const RESOURCE_TEXTURE_MIGRATIONS: Record<string, { sheet: string; frameOffset: number }> = {
  'resources/tree/grass-1': { sheet: 'resources/tree/grass', frameOffset: 0 },
  'resources/tree/grass-2': { sheet: 'resources/tree/grass', frameOffset: 1 },
  'resources/tree/grass-3': { sheet: 'resources/tree/grass', frameOffset: 2 },
  'resources/tree/grass-4': { sheet: 'resources/tree/grass', frameOffset: 3 },
  'resources/tree/palm-1': { sheet: 'resources/tree/palm', frameOffset: 0 },
  'resources/tree/palm-2': { sheet: 'resources/tree/palm', frameOffset: 1 },
  'resources/tree/palm-3': { sheet: 'resources/tree/palm', frameOffset: 2 },
  'resources/tree/palm-4': { sheet: 'resources/tree/palm', frameOffset: 3 },
  'resources/tree/dark-forest-1': { sheet: 'resources/tree/dark-forest', frameOffset: 0 },
  'resources/tree/dark-forest-2': { sheet: 'resources/tree/dark-forest', frameOffset: 1 },
  'resources/tree/dark-forest-3': { sheet: 'resources/tree/dark-forest', frameOffset: 2 },
  'resources/tree/dark-forest-4': { sheet: 'resources/tree/dark-forest', frameOffset: 3 },
  'resources/tree/fallen': { sheet: 'resources/tree/dead', frameOffset: 0 },
  'resources/tree/stump': { sheet: 'resources/tree/dead', frameOffset: 4 },
  'resources/gold': { sheet: 'resources/minerals', frameOffset: 0 },
  'resources/stone': { sheet: 'resources/minerals', frameOffset: 3 },
  'resources/copper': { sheet: 'resources/minerals', frameOffset: 6 },
  'resources/iron': { sheet: 'resources/minerals', frameOffset: 9 },
}

export type ResourceOptions = Partial<ResourceDefinition> & {
  currentFrame?: number
  i: number
  isNaturalResource?: boolean
  j: number
  berrybushFullTextureName?: string
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

function normalizeResourceTextureRef(ref: TextureRef): TextureRef {
  const parsed = parseTextureRef(ref)
  const migration = RESOURCE_TEXTURE_MIGRATIONS[parsed.sheet]
  if (!migration) return ref
  return {
    sheet: migration.sheet,
    frame: migration.frameOffset + Math.max(0, parsed.frame),
  }
}

function pickLifecycleTextureRef(asset: ResourceLifecycleAsset | undefined): TextureRef | null {
  if (!asset) return null
  if (typeof asset === 'string') {
    return normalizeResourceTextureRef({ sheet: asset, frame: randomRange(0, 3) })
  }
  const frames = asset.frames?.length ? asset.frames : [0]
  return {
    sheet: asset.sheet,
    frame: frames[randomRange(0, frames.length - 1)],
  }
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
      animatedSprite.animationSpeed = spritesheetJump.data?.animationSpeed ?? 0.3
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
        const frame = startsMature ? lastFrame : Math.max(0, Math.min(lastFrame, Math.floor(options.currentFrame ?? 0)))
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
      const normalizedTextureRef = normalizeResourceTextureRef(textureRef)
      const texture = getTexture(normalizedTextureRef, Assets)
      const textureFile =
        (texture as TextureWithCacheIds).textureCacheIds?.[0] || `${textureRefToString(normalizedTextureRef)}.png`
      const spritesheet = Assets.cache.get(getTextureSheet(normalizedTextureRef))
      this.textureName = textureRefToString(normalizedTextureRef)
      this.sprite = Sprite.from(texture)
      if (this.type === RESOURCE_TYPES.berrybush && this.berrybushFullTextureName == null) {
        const berrybushTextureRef = parseTextureRef(this.textureName)
        if (berrybushTextureRef.frame > 0) {
          this.berrybushFullTextureName = this.textureName
        }
      }
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
