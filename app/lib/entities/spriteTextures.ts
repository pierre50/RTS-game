import { getSpriteFrameSelection, type DirectionOrder, type TextureMap } from './spriteFrameSelection'
export { getAnimationFrames, getSpriteFrameSelection, getMirroredHalfArcFrameIndex } from './spriteFrameSelection'
import { SHEET_TYPES } from '../constants'
import { applyActionFrameSequence, getConfiguredActionFrameSequence } from '../animations/actionFrameSequences'
import type { AnimatedSprite, Ticker } from 'pixi.js'

type MutableSheetObject = { [key: string]: SheetLike | object | string | number | boolean | null | undefined }
type DestroyOption = boolean | { children?: boolean; texture?: boolean; textureSource?: boolean; context?: boolean }
type DefaultAnchor = { x: number; y: number }
type AnimationCallback = (() => void) | null

type AnimatedSpriteLike<TTexture = AnimatedSprite['textures'][number]> = {
  _afterAnimationUpdate?: (() => void) | null
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
  playingBeforePause?: boolean
  currentSheet?: string
  degree: number
  equipment?: string[] | null
  inventory?: {
    activeWeapons?: Partial<Record<string, string>>
    equipped?: Partial<Record<string, string>>
  } | null
  owner?: { age?: number | null } | null
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
  // Pausing stops animation, not visual synchronization during placement or travel.
  updateUnitTexture(sheet, instance)
  if (instance.context.paused) {
    // A new sheet can start or cancel work during boot/pause. Resume its intended playback,
    // not the stopped state observed by a later, repeated pause request.
    instance.playingBeforePause = Boolean(instance.sprite.playing)
    instance.sprite.stop()
  }
}

function updateUnitTexture(sheet: string, instance: UnitTextureInstance): void {
  const sheets = instance as UnitTextureInstance & MutableSheetObject
  const sheetToReset = [SHEET_TYPES.action, SHEET_TYPES.dying, SHEET_TYPES.corpse]
  if (!sheetToReset.includes(sheet)) {
    instance.sprite.onLoop = null
    instance.sprite.onFrameChange = null
  }
  if (!sheets[sheet]) {
    applyMissingUnitSheet(sheet, instance)
    return
  }
  const { mountedActionSheet, selectedSheet } = selectUnitSheet(sheet, instance, sheets)
  const sameSheet = instance.currentSheet === sheet
  const goto = instance.currentSheet === sheet && instance.sprite.currentFrame
  instance.currentSheet = sheet
  const { textures: selectedTextures, mirrored } = selectUnitDirectionFrames(
    sheet,
    instance,
    mountedActionSheet,
    selectedSheet
  )
  const configuredActionFrameSequence = sheet === SHEET_TYPES.action ? getConfiguredActionFrameSequence(instance) : null
  const textures = applyActionFrameSequence(selectedTextures, configuredActionFrameSequence)
  const spriteScale = instance.spriteScale ?? 1
  instance.sprite.scale.x = mirrored ? -spriteScale : spriteScale
  instance.sprite.scale.y = spriteScale
  // Reassigning Pixi textures resets the animation clock, even for identical frames.
  const sameTextures =
    sameSheet &&
    instance.sprite.textures.length === textures.length &&
    textures.every((texture, index) => texture === instance.sprite.textures[index])
  if (!sameTextures) instance.sprite.textures = textures
  const defaultAnchor = getDefaultAnchor(instance.sprite.textures[0])
  if (defaultAnchor) {
    instance.sprite.anchor.set(defaultAnchor.x, defaultAnchor.y)
  }
  instance.sprite.animationSpeed = getUnitSpritesheetAnimationSpeed(selectedSheet, sheet)
  playSelectedUnitSheet(sheet, instance, selectedSheet, mountedActionSheet, goto, sameTextures)
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
      sprite._afterAnimationUpdate?.()
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

function applyMissingUnitSheet(sheet: string, instance: UnitTextureInstance): void {
  const fallbackSpriteScale = instance.spriteScale ?? 1
  let mirrored = false
  if (sheet === SHEET_TYPES.corpse && applyMissingCorpseSheet(sheet, instance, fallbackSpriteScale)) return
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

function applyMissingCorpseSheet(sheet: string, instance: UnitTextureInstance, fallbackSpriteScale: number): boolean {
  if (!instance.dyingSheet) return false

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
    return true
  }

  return false
}

function selectUnitSheet(sheet: string, instance: UnitTextureInstance, sheets: MutableSheetObject) {
  const mountedActionSheet =
    instance.mountedOnHorse &&
    instance.actionSheet &&
    [SHEET_TYPES.standing, SHEET_TYPES.walking, SHEET_TYPES.action].includes(sheet)
      ? instance.actionSheet
      : null
  const selectedSheet = (mountedActionSheet ?? sheets[sheet]) as SheetLike

  return { mountedActionSheet, selectedSheet }
}

function selectUnitDirectionFrames(
  sheet: string,
  instance: UnitTextureInstance,
  mountedActionSheet: SheetLike | null,
  selectedSheet: SheetLike
) {
  const directionCount =
    mountedActionSheet && sheet !== SHEET_TYPES.action
      ? (instance.sheetDirectionCounts?.[SHEET_TYPES.action] ?? instance.sheetDirectionCounts?.[sheet] ?? null)
      : (instance.sheetDirectionCounts?.[sheet] ?? null)
  const directionOrderOverride =
    mountedActionSheet && sheet !== SHEET_TYPES.action
      ? (instance.sheetDirectionOrders?.[SHEET_TYPES.action] ?? instance.sheetDirectionOrders?.[sheet] ?? null)
      : (instance.sheetDirectionOrders?.[sheet] ?? null)
  return getSpriteFrameSelection(selectedSheet.textures, instance.degree, directionCount, directionOrderOverride)
}

function playSelectedUnitSheet(
  sheet: string,
  instance: UnitTextureInstance,
  selectedSheet: SheetLike,
  mountedActionSheet: SheetLike | null,
  goto: number | false,
  sameTextures: boolean
): void {
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
  if (!sameTextures && goto && goto < instance.sprite.textures.length) instance.sprite.gotoAndPlay(goto)
  else instance.sprite.play()
}
