import { Sprite, Assets, Polygon, AnimatedSprite } from 'pixi.js'
import {
  cartesianToIsometric,
  getGroundReliefLevel,
  getInstanceZIndex,
  getReliefLiftPixels,
  playerCanSeeInstance,
  randomRange,
  drawInstanceBlinkingSelection,
  getActionCondition,
  bindAnimatedSpriteToTicker,
  getAnimationFrames,
  getDeterministicCellVariant,
  getTexture,
  getTextureSheet,
  getTextureByFrame,
  playSoundCue,
  playSelectionSound,
  textureRefToString,
} from '../lib'
import {
  TYPE_ACTION,
  CELL_WIDTH,
  CELL_HEIGHT,
  FAMILY_TYPES,
  PLAYER_TYPES,
  LABEL_TYPES,
  RESOURCE_TYPES,
  SOUND_CUES,
} from '../constants'
import { Instance } from './Instance'
import { ResourceInterface } from '../ui/ResourceInterface'
import { getResourceWindAnimationEnabled, getShadowsEnabled, onVisualSettingsChange } from '../lib/settings'
import { canUseRtsEntityPointer } from '../lib/unitControl'
import type { FederatedPointerEvent, Texture } from 'pixi.js'
import type { GameContextLike } from '../types/context'
import type { RuntimeEntity } from '../types/entities'
import type { ResourceConfig } from '../types/config'
import type { EntityInterfaceLike, ResourceEntity, UnitEntity, UnitSounds } from '../types/entities'
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
type UnitWithResourceCommands = UnitEntity & Record<string, ((target: RuntimeEntity) => void) | undefined>
type PlayerWithResourceMemory = PlayerLike & Record<string, Set<RuntimeEntity> | undefined>
type TextureWithCacheIds = Texture & { textureCacheIds?: string[] }
type ResourceShadow = Sprite | AnimatedSprite
type WindTick = (ticker: { deltaMS?: number; elapsedMS?: number }) => void

const SHADOW_ALPHA = 0.42
const SHADOW_SCALE_X = 1.02
const SHADOW_SCALE_Y = -0.5
const WIND_AMPLITUDE = 0.018
const WIND_ROTATION = 0.006
const WIND_SPEED = 0.0018

export type ResourceOptions = Partial<ResourceDefinition> & { i: number; j: number; type: string }

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
  isAnimated?: boolean
  assets!: ResourceAssets
  lifecycleAssets?: ResourceDefinition['lifecycleAssets']
  textureName!: string
  category?: string
  sounds?: UnitSounds

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

    Object.assign(this, options)
    const config = getResourceConfig()
    Object.assign(this, config.resources[this.type])

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
      info: (element: HTMLElement) => {
        const data = config.resources[this.type]
        this.setDefaultInterface(element, data)
      },
    }
    if (this.isAnimated) {
      const spritesheetJump = Assets.cache.get(this.assets as string)
      const animatedSprite = new AnimatedSprite(getAnimationFrames(spritesheetJump.textures) as Texture[])
      bindAnimatedSpriteToTicker(animatedSprite, this.context.app)
      animatedSprite.play()
      animatedSprite.animationSpeed = 0.2
      this.sprite = animatedSprite
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
      const textureFile = (texture as TextureWithCacheIds).textureCacheIds?.[0] || `${textureRefToString(textureRef)}.png`
      const spritesheet = Assets.cache.get(getTextureSheet(textureRef))
      this.textureName = textureRefToString(textureRef)
      this.sprite = Sprite.from(texture)
      this.sprite.hitArea =
        spritesheet?.data?.frames?.[textureFile]?.hitArea && new Polygon(spritesheet.data.frames[textureFile].hitArea)
    }

    const interactiveSprite = this.sprite as Sprite & { updateAnchor?: boolean }
    interactiveSprite.updateAnchor = true
    interactiveSprite.label = LABEL_TYPES.sprite
    this.sprite.position.y = this.reliefLift
    if (this.sprite) {
      interactiveSprite.eventMode = 'static'
      interactiveSprite.roundPixels = true

      this.sprite.on('pointertap', () => {
        const {
          context: { player, menu, controls, editor },
        } = this
        if (editor?.handleEntityInteraction(this) || controls.isInteractionBlocked() || !canUseRtsEntityPointer(controls)) return
        if (!player.selectedUnits.length && (playerCanSeeInstance(this, player) || map.revealEverything)) {
          player.unselectAll()
          this.select()
          menu.setBottombar(this)
          player.selectedOther = this
          playSelectionSound(this)
        }
      })
      this.sprite.on('pointerup', (evt: FederatedPointerEvent) => {
        const {
          context: { player, controls, editor },
        } = this
        if (editor?.handleEntityInteraction(this) || !canUseRtsEntityPointer(controls)) return
        const action = (TYPE_ACTION as Record<string, string>)[this.category || this.type]
        if (controls.rallyPointController?.active) {
          controls.mouse.prevent = true
          controls.rallyPointController.handleMouseUpOnEntity(this)
          return
        }
        if (controls.mouseBuilding || controls.mouseRectangle || !controls.isMouseInApp(evt)) {
          return
        }
        controls.mouse.prevent = true
        let hasActionOrder = false
        let hasFallbackOrder = false
        let hasSilentCommandOrder = false
        for (let i = 0; i < player.selectedUnits.length; i++) {
          const unit = player.selectedUnits[i]
          if (getActionCondition(unit, this, action)) {
            hasActionOrder = true
            if (this.category === 'Fish' && unit.silentWorkSounds?.includes('fishing')) {
              hasSilentCommandOrder = true
            }
            const sendToFunc = `sendTo${this.category || this.type}`
            const dynamicUnit = unit as UnitWithResourceCommands
            typeof dynamicUnit[sendToFunc] === 'function' ? dynamicUnit[sendToFunc]?.(this) : unit.sendTo(this)
          } else {
            hasFallbackOrder = true
            unit.sendTo(this)
          }
        }
        if (hasActionOrder) {
          drawInstanceBlinkingSelection(this)
        }
        if (hasFallbackOrder) {
          playSoundCue(SOUND_CUES.unit.militaryCommand)
        } else if (hasActionOrder && !hasSilentCommandOrder) {
          playSoundCue(this.sounds?.command ?? getResourceConfig().units.Villager.sounds.command)
        }
      })

      this.shadow = this.createShadow()
      if (this.shadow) {
        this.addChild(this.shadow, this.sprite)
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
    menu.updateResourcesMiniMap()
    map.removeFromInstanceBucket(this)
    this.isDead = true
    this.stopWindMotion()
    if (this.type === RESOURCE_TYPES.tree && !immediate) {
      this.onTreeDie()
    } else {
      this.clear()
    }
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

  onTreeDie() {
    const {
      context: { map },
    } = this
    const sheetId = this.lifecycleAssets?.fallen
    if (!sheetId) return this.clear()
    const frameIndex = randomRange(0, 3)
    const texture = getTextureByFrame(sheetId, frameIndex, Assets)
    this.textureName = textureRefToString({ sheet: sheetId, frame: frameIndex })
    const { sprite } = this
    sprite.texture = texture
    sprite.eventMode = 'none'
    this.zIndex--
    this.syncShadow()
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

  setDefaultInterface(element: HTMLElement, data: ResourceConfig) {
    return this.resourceInterface.setDefaultInterface(element, data)
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
    return this.isWindMotionEligible() && getResourceWindAnimationEnabled()
  }

  isWindMotionEligible(): boolean {
    return (
      !this.isDead &&
      !this.isCutOrFallenTree() &&
      (this.type === RESOURCE_TYPES.tree || this.type === RESOURCE_TYPES.berrybush)
    )
  }

  isCutOrFallenTree(): boolean {
    if (this.type !== RESOURCE_TYPES.tree || !this.textureName) return false
    const sheet = getTextureSheet(this.textureName)
    return sheet === this.lifecycleAssets?.cut || sheet === this.lifecycleAssets?.fallen
  }

  startWindMotion(): void {
    if (!this.shouldUseWindMotion() || this.windTick) return
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
    if (!this.sprite) return
    this.sprite.skew.x = 0
    this.sprite.rotation = 0
    if (this.shadow) {
      this.shadow.skew.x = 0
      this.shadow.rotation = 0
    }
  }

  updateWindMotion(deltaMS: number): void {
    if (this.context.paused) return
    if (!this.shouldUseWindMotion()) {
      this.resetWindMotion()
      return
    }
    this.windTime += deltaMS
    const sway = Math.sin(this.windPhase + this.windTime * WIND_SPEED)
    const secondary = Math.sin(this.windPhase * 0.7 + this.windTime * WIND_SPEED * 0.47)
    this.sprite.skew.x = sway * WIND_AMPLITUDE
    this.sprite.rotation = secondary * WIND_ROTATION
    if (this.shadow) {
      this.shadow.skew.x = this.sprite.skew.x * 0.45
    }
  }

  shouldShowShadow(): boolean {
    return this.category !== 'Fish' && this.type !== RESOURCE_TYPES.salmon
  }

  createShadow(): ResourceShadow | null {
    if (!this.shouldShowShadow()) return null
    const shadow =
      this.sprite instanceof AnimatedSprite
        ? new AnimatedSprite(this.sprite.textures as Texture[])
        : new Sprite(this.sprite.texture)
    if (shadow instanceof AnimatedSprite) {
      bindAnimatedSpriteToTicker(shadow, this.context.app)
    }
    shadow.label = LABEL_TYPES.shadow
    shadow.eventMode = 'none'
    shadow.roundPixels = true
    shadow.tint = 0x000000
    shadow.alpha = SHADOW_ALPHA
    shadow.zIndex = -2
    this.syncShadow(shadow)
    return shadow
  }

  syncShadow(shadow = this.shadow): void {
    if (!shadow || !this.sprite || !this.shouldShowShadow()) return
    shadow.visible = getShadowsEnabled()
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
    shadow.alpha = SHADOW_ALPHA
    shadow.rotation = 0
    shadow.scale.set(Math.abs(this.sprite.scale.x) * SHADOW_SCALE_X, Math.abs(this.sprite.scale.y) * SHADOW_SCALE_Y)
    shadow.position.set(0, this.reliefLift ?? 0)
  }

  syncVisualSettings(): void {
    if (this.shadow) {
      this.shadow.visible = getShadowsEnabled() && this.shouldShowShadow()
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
    super.resume()
    ;(this.shadow as AnimatedSprite | null)?.play?.()
  }

  override destroy(options?: Parameters<Instance['destroy']>[0]): void {
    this.visualSettingsCleanup?.()
    this.visualSettingsCleanup = null
    this.stopWindMotion()
    super.destroy(options)
  }
}
