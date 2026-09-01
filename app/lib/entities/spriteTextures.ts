import { SHEET_TYPES } from '../constants'
import { degreeToDirection } from '../maths'
import { applyActionFrameSequence, getConfiguredActionFrameSequence } from '../animations/actionFrameSequences'
import type { AnimatedSprite, Ticker } from 'pixi.js'

type Direction = 'south' | 'southwest' | 'west' | 'northwest' | 'north' | 'northeast' | 'east' | 'southeast'
type DirectionOrder = Direction[]
type TextureMap<TTexture = AnimatedSprite['textures'][number]> = Record<string, TTexture>
type MutableSheetObject = { [key: string]: SheetLike | object | string | number | boolean | null | undefined }
type DestroyOption = boolean | { children?: boolean; texture?: boolean; textureSource?: boolean; context?: boolean }
type DefaultAnchor = { x: number; y: number }
type AnimationCallback = (() => void) | null

const THREE_DIRECTION_ORDER: DirectionOrder = ['north', 'west', 'south']
const FIVE_DIRECTION_ORDER: DirectionOrder = ['south', 'southwest', 'west', 'northwest', 'north']
const FOUR_DIRECTION_ORDER: DirectionOrder = ['north', 'west', 'south', 'east']
const EIGHT_DIRECTION_ORDER: DirectionOrder = [
  'south',
  'southwest',
  'west',
  'northwest',
  'north',
  'northeast',
  'east',
  'southeast',
]

function getSheetDirectionOrder<TTexture>(
  textures: TextureMap<TTexture>,
  directionCount: number | null,
  explicitOrder: DirectionOrder | string[] | null = null
): DirectionOrder | null {
  const frameCount = Object.keys(textures).length

  if (explicitOrder?.length) {
    return explicitOrder as DirectionOrder
  }
  if (directionCount === 1) {
    return null
  }
  if (directionCount === 8) {
    return EIGHT_DIRECTION_ORDER
  }
  if (directionCount === 5) {
    return FIVE_DIRECTION_ORDER
  }
  if (directionCount === 4) {
    return FOUR_DIRECTION_ORDER
  }
  if (directionCount === 3) {
    return THREE_DIRECTION_ORDER
  }
  if (frameCount % 5 === 0) {
    return FIVE_DIRECTION_ORDER
  }
  if (frameCount % 8 === 0) {
    return EIGHT_DIRECTION_ORDER
  }
  return null
}

export function getAnimationFrames<TTexture>(
  textures: TextureMap<TTexture>,
  direction?: Direction,
  directionCount: number | null = null,
  directionOrderOverride: DirectionOrder | string[] | null = null
): TTexture[] {
  const names = getSortedTextureNames(textures)

  if (!direction) {
    return names.map(name => textures[name])
  }

  const directionOrder = getSheetDirectionOrder(textures, directionCount, directionOrderOverride)
  if (!directionOrder) {
    return names.map(name => textures[name])
  }
  const framesPerDirection = names.length / directionOrder.length
  const directionIndex = directionOrder.indexOf(direction)

  if (directionIndex < 0) {
    throw new Error(`Unknown direction: ${direction}`)
  }

  const start = directionIndex * framesPerDirection
  const end = start + framesPerDirection

  return names.slice(start, end).map(name => textures[name])
}

export function getSpriteFrameSelection<TTexture>(
  textures: TextureMap<TTexture>,
  degree: number,
  directionCount: number | null = null,
  directionOrderOverride: DirectionOrder | string[] | null = null
): { textures: TTexture[]; mirrored: boolean } {
  const names = getSortedTextureNames(textures)
  const direction = (degreeToDirection(degree) ?? 'south') as Direction

  if (directionCount === 1) {
    return {
      textures: getAnimationFrames(textures, 'south', directionCount, directionOrderOverride),
      mirrored: false,
    }
  }

  if (directionCount === 9) {
    const { frameIndex, mirrored } = getMirroredHalfArcFrameIndex(degree, directionCount)
    const framesPerDirection = Math.max(1, Math.floor(names.length / directionCount))
    const start = frameIndex * framesPerDirection
    return {
      textures: names.slice(start, start + framesPerDirection).map(name => textures[name]),
      mirrored,
    }
  }

  const directionOrder = getSheetDirectionOrder(textures, directionCount, directionOrderOverride)

  if (directionOrder?.length === 4) {
    const cardinalDirection =
      direction === 'northwest' || direction === 'northeast'
        ? 'north'
        : direction === 'southwest' || direction === 'southeast'
          ? 'south'
          : direction

    return {
      textures: getAnimationFrames(textures, cardinalDirection, directionCount, directionOrderOverride),
      mirrored: false,
    }
  }

  if (directionOrder?.length === 3) {
    const cardinalDirection =
      direction === 'northwest' || direction === 'northeast'
        ? 'north'
        : direction === 'southwest' || direction === 'southeast'
          ? 'south'
          : direction

    const spriteDirection = cardinalDirection === 'east' ? 'west' : cardinalDirection

    return {
      textures: getAnimationFrames(textures, spriteDirection, directionCount, directionOrderOverride),
      mirrored: cardinalDirection === 'east',
    }
  }

  if (directionOrder?.length === 8) {
    return {
      textures: getAnimationFrames(textures, direction, directionCount, directionOrderOverride),
      mirrored: false,
    }
  }

  let spriteDirection = direction
  let mirrored = false
  if (direction === 'southeast') {
    spriteDirection = 'southwest'
    mirrored = true
  } else if (direction === 'northeast') {
    spriteDirection = 'northwest'
    mirrored = true
  } else if (direction === 'east') {
    spriteDirection = 'west'
    mirrored = true
  }

  return {
    textures: getAnimationFrames(textures, spriteDirection, directionCount, directionOrderOverride),
    mirrored,
  }
}

export function getMirroredHalfArcFrameIndex(
  degree: number,
  frameCount: number
): { frameIndex: number; mirrored: boolean } {
  const normalizedDegree = ((degree % 360) + 360) % 360
  const mirrored = normalizedDegree > 90 && normalizedDegree < 270
  const halfArcDegree = mirrored
    ? 270 - normalizedDegree
    : normalizedDegree >= 270
      ? normalizedDegree - 270
      : normalizedDegree + 90
  const maxIndex = Math.max(frameCount - 1, 0)
  const step = maxIndex > 0 ? 180 / maxIndex : 180
  const frameIndex = Math.max(0, Math.min(maxIndex, Math.round(halfArcDegree / step)))

  return { frameIndex, mirrored }
}

function getSortedTextureNames<TTexture>(textures: TextureMap<TTexture>): string[] {
  return Object.keys(textures).sort((a, b) => {
    const na = parseInt(a.split('_')[0], 10)
    const nb = parseInt(b.split('_')[0], 10)
    return na - nb
  })
}

type AnimatedSpriteLike<TTexture = AnimatedSprite['textures'][number]> = {
  _usesAppTicker?: boolean
  anchor: { set: (x: number, y: number) => void }
  animationSpeed?: number
  autoUpdate?: boolean
  currentFrame: number
  destroyed?: boolean
  destroy: (options?: DestroyOption) => void
  gotoAndPlay: (frame: number) => void
  onComplete?: AnimationCallback
  onFrameChange?: ((frame: number) => void) | null
  onLoop?: AnimationCallback
  parent?: DisplayObjectLike | null
  play: () => void
  playing?: boolean
  renderable?: boolean
  scale: { x: number; y: number }
  stop: () => void
  textures: TTexture[] | AnimatedSprite['textures']
  update: (ticker: Ticker) => void
  visible?: boolean
}

type DisplayObjectLike = {
  destroyed?: boolean
  onComplete?: AnimationCallback
  onFrameChange?: ((frame: number) => void) | null
  onLoop?: AnimationCallback
  parent?: DisplayObjectLike | null
  playing?: boolean
  renderable?: boolean
  visible?: boolean
}

type SheetLike<TTexture = AnimatedSprite['textures'][number]> = {
  data: { animationSpeed?: number }
  textures: TextureMap<TTexture>
}

const UNIT_SHEET_FALLBACK_ANIMATION_SPEED: Record<string, number> = {
  [SHEET_TYPES.standing]: 0.2,
  [SHEET_TYPES.corpse]: 0,
}

export function getUnitSpritesheetAnimationSpeed(
  sheet: { data?: { animationSpeed?: number } } | null | undefined,
  sheetType?: string | null
): number {
  return sheet?.data?.animationSpeed ?? (sheetType ? UNIT_SHEET_FALLBACK_ANIMATION_SPEED[sheetType] : undefined) ?? 0.4
}

function getDefaultAnchor(texture: unknown): DefaultAnchor | null {
  if (typeof texture !== 'object' || texture === null) return null
  const directAnchor = (texture as { defaultAnchor?: unknown }).defaultAnchor
  if (isDefaultAnchor(directAnchor)) return directAnchor
  const frameTexture = (texture as { texture?: { defaultAnchor?: unknown } }).texture
  return isDefaultAnchor(frameTexture?.defaultAnchor) ? frameTexture.defaultAnchor : null
}

function isDefaultAnchor(value: unknown): value is DefaultAnchor {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { x?: unknown }).x === 'number' &&
    typeof (value as { y?: unknown }).y === 'number'
  )
}

export type UnitTextureInstance = {
  actionFrameSequence?: number[] | null
  action?: string | null
  context: { paused?: boolean }
  currentSheet?: string
  degree: number
  sheetDirectionCounts?: Record<string, number>
  sheetDirectionOrders?: Record<string, DirectionOrder>
  spriteScale?: number
  sprite: AnimatedSpriteLike
  work?: string | null
  walkingSheet?: SheetLike
  actionSheet?: SheetLike
  dyingSheet?: SheetLike
  mountedOnHorse?: boolean
}

function getWalkingFallbackTexture(
  instance: UnitTextureInstance
): { texture: AnimatedSprite['textures'][number]; mirrored: boolean } | undefined {
  const walkingSheet = instance.walkingSheet
  if (!walkingSheet) return undefined

  const directionCount = instance.sheetDirectionCounts?.[SHEET_TYPES.walking] ?? null
  const { textures, mirrored } = getSpriteFrameSelection(
    walkingSheet.textures,
    instance.degree,
    directionCount,
    instance.sheetDirectionOrders?.[SHEET_TYPES.walking] ?? null
  )

  return textures[0] === undefined ? undefined : { texture: textures[0], mirrored }
}

export function setUnitTexture(sheet: string, instance: UnitTextureInstance): void {
  const sheets = instance as UnitTextureInstance & MutableSheetObject
  const sheetToReset = [SHEET_TYPES.action, SHEET_TYPES.dying, SHEET_TYPES.corpse]
  if (!sheetToReset.includes(sheet)) {
    instance.sprite.onLoop = null
    instance.sprite.onFrameChange = null
  }
  const { paused } = instance.context
  if (paused) {
    return
  }
  if (!sheets[sheet]) {
    const fallbackSpriteScale = instance.spriteScale ?? 1
    let mirrored = false
    if (sheet === SHEET_TYPES.corpse && instance.dyingSheet) {
      const directionCount = instance.sheetDirectionCounts?.[SHEET_TYPES.dying] ?? null
      const directionOrderOverride = instance.sheetDirectionOrders?.[SHEET_TYPES.dying] ?? null
      const fallback = getSpriteFrameSelection(
        instance.dyingSheet.textures,
        instance.degree,
        directionCount,
        directionOrderOverride
      )
      const corpseTexture = fallback.textures[fallback.textures.length - 1]
      if (corpseTexture) {
        instance.currentSheet = sheet
        instance.sprite.textures = [corpseTexture]
        instance.sprite.currentFrame = 0
        instance.sprite.animationSpeed = 0
        instance.sprite.stop()
        instance.sprite.scale.x = fallback.mirrored ? -fallbackSpriteScale : fallbackSpriteScale
        instance.sprite.scale.y = fallbackSpriteScale
        const defaultAnchor = getDefaultAnchor(corpseTexture)
        if (defaultAnchor) {
          instance.sprite.anchor.set(defaultAnchor.x, defaultAnchor.y)
        }
        return
      }
    }
    if (instance.walkingSheet) {
      const fallback = getWalkingFallbackTexture(instance)
      if (fallback) {
        instance.sprite.textures = [fallback.texture]
        mirrored = fallback.mirrored
      }
    } else {
      instance.sprite.textures = [instance.sprite.textures[instance.sprite.currentFrame]]
      mirrored = instance.sprite.scale.x < 0
    }
    instance.currentSheet = SHEET_TYPES.walking
    instance.sprite.stop()
    instance.sprite.scale.x = mirrored ? -fallbackSpriteScale : fallbackSpriteScale
    instance.sprite.scale.y = fallbackSpriteScale
    const currentTexture = instance.sprite.textures[instance.sprite.currentFrame]
    const defaultAnchor = getDefaultAnchor(currentTexture)
    if (defaultAnchor) {
      instance.sprite.anchor.set(defaultAnchor.x, defaultAnchor.y)
    }
    return
  }
  const mountedActionSheet =
    instance.mountedOnHorse &&
    instance.actionSheet &&
    [SHEET_TYPES.standing, SHEET_TYPES.walking, SHEET_TYPES.action].includes(sheet)
      ? instance.actionSheet
      : null
  const selectedSheet = (mountedActionSheet ?? sheets[sheet]) as SheetLike
  const goto = instance.currentSheet === sheet && instance.sprite.currentFrame
  instance.currentSheet = sheet
  const directionCount =
    mountedActionSheet && sheet !== SHEET_TYPES.action
      ? (instance.sheetDirectionCounts?.[SHEET_TYPES.action] ?? instance.sheetDirectionCounts?.[sheet] ?? null)
      : (instance.sheetDirectionCounts?.[sheet] ?? null)
  const directionOrderOverride =
    mountedActionSheet && sheet !== SHEET_TYPES.action
      ? (instance.sheetDirectionOrders?.[SHEET_TYPES.action] ?? instance.sheetDirectionOrders?.[sheet] ?? null)
      : (instance.sheetDirectionOrders?.[sheet] ?? null)
  const { textures: selectedTextures, mirrored } = getSpriteFrameSelection(
    selectedSheet.textures,
    instance.degree,
    directionCount,
    directionOrderOverride
  )
  const configuredActionFrameSequence =
    sheet === SHEET_TYPES.action
      ? getConfiguredActionFrameSequence(instance)
      : null
  const textures = applyActionFrameSequence(selectedTextures, configuredActionFrameSequence)
  const spriteScale = instance.spriteScale ?? 1
  instance.sprite.scale.x = mirrored ? -spriteScale : spriteScale
  instance.sprite.scale.y = spriteScale
  instance.sprite.textures = textures
  const defaultAnchor = getDefaultAnchor(instance.sprite.textures[0])
  if (defaultAnchor) {
    instance.sprite.anchor.set(defaultAnchor.x, defaultAnchor.y)
  }
  instance.sprite.animationSpeed = getUnitSpritesheetAnimationSpeed(selectedSheet, sheet)
  // Humanoid units alias standingSheet to the same walkingSheet asset (no separate idle art),
  // so freeze on frame 0 to avoid playing the walk cycle in place. A distinct standing sheet
  // (e.g. wildlife idle animations) is real art and should play normally.
  if (mountedActionSheet && sheet !== SHEET_TYPES.action) {
    instance.sprite.textures = [instance.sprite.textures[0]]
    instance.sprite.stop()
    return
  }
  if (sheet === SHEET_TYPES.standing && selectedSheet === instance.walkingSheet) {
    instance.sprite.textures = [instance.sprite.textures[0]]
    instance.sprite.stop()
    return
  }
  goto && goto < instance.sprite.textures.length ? instance.sprite.gotoAndPlay(goto) : instance.sprite.play()
}

function displayObjectCanUpdateAnimation(displayObject?: DisplayObjectLike | null): boolean {
  if (!displayObject?.playing || displayObject.destroyed) return false
  if (displayObject.onLoop || displayObject.onFrameChange || displayObject.onComplete) return true
  let current: DisplayObjectLike | null | undefined = displayObject
  while (current) {
    if (current.visible === false || current.renderable === false) return false
    current = current.parent
  }
  return true
}

export function bindAnimatedSpriteToTicker<TSprite extends AnimatedSpriteLike | null | undefined>(
  sprite: TSprite,
  app?: { ticker?: { add: (tick: (ticker: Ticker) => void) => void; remove: (tick: (ticker: Ticker) => void) => void } }
): TSprite {
  const ticker = app?.ticker
  if (!sprite || !ticker || sprite._usesAppTicker) {
    return sprite
  }

  sprite.autoUpdate = false

  const tick = (ticker: Ticker) => {
    if (displayObjectCanUpdateAnimation(sprite)) {
      sprite.update(ticker)
    }
  }

  const originalDestroy = sprite.destroy.bind(sprite)
  sprite.destroy = (options?: DestroyOption) => {
    ticker.remove(tick)
    sprite._usesAppTicker = false
    return originalDestroy(options)
  }

  sprite._usesAppTicker = true
  ticker.add(tick)
  return sprite
}
