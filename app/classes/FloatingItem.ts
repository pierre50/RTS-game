import { Assets, Graphics, Sprite } from 'pixi.js'
import type { Container, Ticker } from 'pixi.js'
import { FAMILY_TYPES, LABEL_TYPES, RESOURCE_TYPES } from '../constants'
import {
  cartesianToIsometric,
  getGroundReliefLevel,
  getInstanceZIndex,
  getReliefLiftPixels,
  getTexture,
  updateInstanceRenderVisibility,
} from '../lib'
import { Instance } from './Instance'
import type { GameContextLike } from '../types/context'
import type { FloatingItemEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { TextureRef } from '../lib'

const FLOATING_ITEM_TEXTURES: Record<string, TextureRef> = {
  [RESOURCE_TYPES.gold]: { sheet: 'resources/gold', frame: 0 },
}

const SHADOW_ALPHA = 0.26
const SHADOW_WIDTH = 18
const SHADOW_HEIGHT = 8
const FLOAT_AMPLITUDE = 3
const FLOAT_SPEED = 0.004
const SPRITE_SCALE = 0.42
const SPRITE_BASE_Y = -13

export type FloatingItemOptions = {
  i: number
  j: number
  type?: string
  resourceType?: string
  amount?: number
  x?: number
  y?: number
  z?: number | null
}

export class FloatingItem extends Instance implements FloatingItemEntity {
  declare family: 'floatingItem'
  resourceType: string
  amount: number
  declare sprite: Sprite
  shadow: Graphics
  tick: ((ticker: Ticker) => void) | null = null
  floatPhase: number

  constructor(options: FloatingItemOptions, context: GameContextLike) {
    super(context)

    const { map } = this.context
    const cell = map.grid[options.i]?.[options.j] as RuntimeCell | undefined
    if (!cell) throw new Error(`Cannot create floating item outside map at ${options.i}:${options.j}`)

    this.family = FAMILY_TYPES.floatingItem as 'floatingItem'
    this.type = options.type ?? options.resourceType ?? RESOURCE_TYPES.gold
    this.resourceType = options.resourceType ?? this.type
    this.amount = options.amount ?? 1
    this.size = 1
    this.i = options.i
    this.j = options.j
    const [flatX, flatY] = cartesianToIsometric(this.i, this.j)
    this.x = options.x ?? flatX
    this.y = options.y ?? flatY
    this.z = options.z ?? cell.z
    this.zIndex = getInstanceZIndex(this)
    this.reliefLift = -getReliefLiftPixels(getGroundReliefLevel(cell))
    this.eventMode = 'none'
    this.sortableChildren = true
    this.floatPhase = ((this.i * 29 + this.j * 17) % 360) * (Math.PI / 180)

    this.shadow = this.createShadow()
    this.sprite = this.createSprite()
    this.shadow.position.y = this.reliefLift
    this.addChild(this.shadow, this.sprite)

    map.floatingItems?.add(this)
    map.addChild(this)
    map.addToInstanceBucket(this)
    this.startFloating()
    updateInstanceRenderVisibility(this)
  }

  createSprite(): Sprite {
    const textureRef = FLOATING_ITEM_TEXTURES[this.resourceType] ?? FLOATING_ITEM_TEXTURES[RESOURCE_TYPES.gold]
    const sprite = Sprite.from(getTexture(textureRef, Assets))
    sprite.label = LABEL_TYPES.sprite
    sprite.eventMode = 'none'
    sprite.roundPixels = true
    sprite.scale.set(SPRITE_SCALE)
    sprite.y = SPRITE_BASE_Y + (this.reliefLift ?? 0)
    return sprite
  }

  createShadow(): Graphics {
    const shadow = new Graphics()
    shadow.label = LABEL_TYPES.shadow
    shadow.eventMode = 'none'
    shadow.ellipse(0, 0, SHADOW_WIDTH / 2, SHADOW_HEIGHT / 2)
    shadow.fill({ color: 0x000000, alpha: SHADOW_ALPHA })
    shadow.zIndex = -1
    return shadow
  }

  startFloating(): void {
    if (this.tick) return
    this.tick = ticker => this.updateFloating(ticker.deltaMS ?? ticker.elapsedMS ?? 16.67)
    this.context.app.ticker.add(this.tick)
  }

  stopFloating(): void {
    if (!this.tick) return
    this.context.app.ticker.remove(this.tick)
    this.tick = null
  }

  updateFloating(deltaMS: number): void {
    if (this.context.paused) return
    this.floatPhase += deltaMS * FLOAT_SPEED
    const bob = Math.sin(this.floatPhase) * FLOAT_AMPLITUDE
    this.sprite.y = SPRITE_BASE_Y + bob + (this.reliefLift ?? 0)
    this.shadow.scale.set(1 + Math.abs(bob) * 0.018)
  }

  clear(): void {
    if (this.isDestroyed) return
    const { map } = this.context
    this.isDestroyed = true
    this.stopFloating()
    map.floatingItems?.delete(this)
    map.removeFromInstanceBucket(this)
    map.removeChild(this)
    this.destroy({ children: true, texture: false })
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.stopFloating()
    super.destroy(options)
  }
}
