import { SHEET_TYPES, WORK_TYPES } from '../constants'
import { instanceIsInPlayerSight } from './grid'
import { degreeToDirection, uuidv4 } from './maths'
import { playClickSound } from './uiSound'
import { t } from './lang'
import type { GridPosition } from '../types/grid'
import type { AnimatedSprite, Ticker } from 'pixi.js'
import type { ConfigValue } from '../types/config'
import type { RenderableInstance } from './grid/visibility'

type Direction = 'south' | 'southwest' | 'west' | 'northwest' | 'north' | 'northeast' | 'east' | 'southeast'
type DirectionOrder = Direction[]
type TextureMap<TTexture = AnimatedSprite['textures'][number]> = Record<string, TTexture>
type MutableConfigObject = { [key: string]: ConfigValue | SheetLike | object }
type TimeoutId = ReturnType<typeof window.setTimeout> | null
type DestroyOption = boolean | { children?: boolean; texture?: boolean; textureSource?: boolean; context?: boolean }
type DefaultAnchor = { x: number; y: number }
type AnimationCallback = (() => void) | null
type TimerArg = string | number | boolean | object | null | undefined
type TimerThis = object | void

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
const EAST_FIRST_EIGHT_DIRECTION_ORDER: DirectionOrder = [
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'north',
  'northeast',
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
  const names = Object.keys(textures).sort((a, b) => {
    const na = parseInt(a.split('_')[0], 10)
    const nb = parseInt(b.split('_')[0], 10)
    return na - nb
  })

  // Pas de direction => toutes les frames
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

export function getSailAnimationFrames<TTexture>(
  textures: TextureMap<TTexture> | null | undefined,
  instance:
    | {
        degree: number
        sailDirectionCount?: number
        sailDirectionOrder?: DirectionOrder | null
      }
    | null
    | undefined
): { textures: TTexture[]; mirrored: boolean } {
  if (!textures || !instance) {
    return { textures: [], mirrored: false }
  }

  const names = getSortedTextureNames(textures)
  const directionCount = instance.sailDirectionCount ?? 5
  const framesPerDirection = Math.max(1, Math.floor(names.length / directionCount))

  if (directionCount === 9) {
    const { frameIndex, mirrored } = getMirroredHalfArcFrameIndex(instance.degree, directionCount)
    const start = frameIndex * framesPerDirection
    return {
      textures: names.slice(start, start + framesPerDirection).map(name => textures[name]),
      mirrored,
    }
  }

  const direction = (degreeToDirection(instance.degree) ?? 'south') as Direction
  const directionOrder = getSheetDirectionOrder(textures, directionCount, instance.sailDirectionOrder)
  const directionIndex = directionOrder?.indexOf(direction) ?? -1

  if (directionOrder?.length === 8 && directionIndex >= 0) {
    const start = directionIndex * framesPerDirection
    return {
      textures: names.slice(start, start + framesPerDirection).map(name => textures[name]),
      mirrored: false,
    }
  }

  let sailDirection = direction
  let mirrored = false
  if (direction === 'southeast') {
    sailDirection = 'southwest'
    mirrored = true
  } else if (direction === 'northeast') {
    sailDirection = 'northwest'
    mirrored = true
  } else if (direction === 'east') {
    sailDirection = 'west'
    mirrored = true
  }

  const fallbackOrder = directionOrder ?? FIVE_DIRECTION_ORDER
  const fallbackIndex = Math.max(0, fallbackOrder.indexOf(sailDirection))
  const start = fallbackIndex * framesPerDirection

  return {
    textures: names.slice(start, start + framesPerDirection).map(name => textures[name]),
    mirrored,
  }
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
  context: { paused?: boolean }
  currentSheet?: string
  degree: number
  sheetDirectionCounts?: Record<string, number>
  sheetDirectionOrders?: Record<string, DirectionOrder>
  spriteScale?: number
  sprite: AnimatedSpriteLike
  walkingSheet?: SheetLike
  ridingSheet?: SheetLike
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
  const sheets = instance as UnitTextureInstance & MutableConfigObject
  const animationSpeed: Record<string, number> = {
    standingSheet: 0.15,
    corpseSheet: 0,
  }
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
  const mountedRiderSheet =
    instance.mountedOnHorse &&
    instance.ridingSheet &&
    [SHEET_TYPES.standing, SHEET_TYPES.walking, SHEET_TYPES.action].includes(sheet)
      ? instance.ridingSheet
      : null
  const selectedSheet = (mountedRiderSheet ?? sheets[sheet]) as SheetLike
  const goto = instance.currentSheet === sheet && instance.sprite.currentFrame
  instance.currentSheet = sheet
  const directionCount =
    mountedRiderSheet && sheet !== SHEET_TYPES.action
      ? instance.sheetDirectionCounts?.[SHEET_TYPES.action] ?? instance.sheetDirectionCounts?.[sheet] ?? null
      : instance.sheetDirectionCounts?.[sheet] ?? null
  const directionOrderOverride =
    mountedRiderSheet && sheet !== SHEET_TYPES.action
      ? instance.sheetDirectionOrders?.[SHEET_TYPES.action] ?? instance.sheetDirectionOrders?.[sheet] ?? null
      : instance.sheetDirectionOrders?.[sheet] ?? null
  const { textures, mirrored } = getSpriteFrameSelection(
    selectedSheet.textures,
    instance.degree,
    directionCount,
    directionOrderOverride
  )
  const spriteScale = instance.spriteScale ?? 1
  instance.sprite.scale.x = mirrored ? -spriteScale : spriteScale
  instance.sprite.scale.y = spriteScale
  instance.sprite.textures = textures
  const defaultAnchor = getDefaultAnchor(instance.sprite.textures[0])
  if (defaultAnchor) {
    instance.sprite.anchor.set(defaultAnchor.x, defaultAnchor.y)
  }
  instance.sprite.animationSpeed = selectedSheet.data.animationSpeed ?? animationSpeed[sheet] ?? 0.3
  // Humanoid units alias standingSheet to the same walkingSheet asset (no separate idle art),
  // so freeze on frame 0 to avoid playing the walk cycle in place. A distinct standing sheet
  // (e.g. wildlife idle animations) is real art and should play normally.
  if (mountedRiderSheet && sheet !== SHEET_TYPES.action) {
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

export { EAST_FIRST_EIGHT_DIRECTION_ORDER }

export function displayObjectCanUpdateAnimation(displayObject?: DisplayObjectLike | null): boolean {
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

export function filterObject<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Expected an object to filter.')
  }
  return keys.reduce(
    (acc, key) => {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        acc[key] = obj[key]
      }
      return acc
    },
    {} as Pick<T, K>
  )
}

export class Modal {
  _backdrop?: HTMLDivElement
  _closed?: boolean
  _id: string
  _onClose?: () => void
  _onKeyDown: (evt: KeyboardEvent) => void
  _panel?: HTMLDivElement
  _previousActiveElement: Element | null

  constructor({ title, content, onClose }: { title?: string; content?: Node; onClose?: () => void } = {}) {
    this._id = uuidv4()
    this._onClose = onClose
    this._previousActiveElement = document.activeElement
    this._onKeyDown = this._handleKeyDown.bind(this)
    this._build(title, content)
  }

  _build(title?: string, content?: Node): void {
    const backdrop = document.createElement('div')
    this._backdrop = backdrop
    backdrop.id = this._id
    backdrop.className = 'modal'
    backdrop.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.target === backdrop) {
        this._dismiss()
      }
    })

    const panel = document.createElement('div')
    this._panel = panel
    panel.className = 'modal-panel ui-panel-enter'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.tabIndex = -1

    const header = document.createElement('div')
    header.className = 'modal-header'

    if (title) {
      const titleEl = document.createElement('div')
      titleEl.id = `${this._id}-title`
      titleEl.className = 'modal-title'
      titleEl.textContent = title
      panel.setAttribute('aria-labelledby', titleEl.id)
      header.appendChild(titleEl)
    } else {
      panel.setAttribute('aria-label', t('dialog'))
    }

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'modal-close ui-btn'
    closeBtn.textContent = '✕'
    closeBtn.setAttribute('aria-label', t('close'))
    closeBtn.addEventListener('pointerdown', playClickSound)
    closeBtn.addEventListener('click', () => this._dismiss())
    header.appendChild(closeBtn)

    panel.appendChild(header)
    if (content) panel.appendChild(content)

    backdrop.appendChild(panel)
    document.body.appendChild(backdrop)
    document.addEventListener('keydown', this._onKeyDown)
    requestAnimationFrame(() => {
      if (!this._backdrop?.isConnected) return
      this._getFocusableElements()[0]?.focus()
      if (!this._panel?.contains(document.activeElement)) this._panel?.focus()
    })
  }

  _getFocusableElements(): HTMLElement[] {
    if (!this._panel) return []
    return [
      ...this._panel.querySelectorAll(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ),
    ].filter(element => {
      const htmlElement = element as HTMLElement
      return (
        !htmlElement.hidden &&
        htmlElement.getAttribute('aria-hidden') !== 'true' &&
        htmlElement.getClientRects().length > 0
      )
    }) as HTMLElement[]
  }

  _isTopmost(): boolean {
    const modals = document.querySelectorAll('.modal')
    return modals.length > 0 && modals[modals.length - 1] === this._backdrop
  }

  _handleKeyDown(evt: KeyboardEvent): void {
    if (!this._isTopmost()) return

    if (evt.key === 'Escape') {
      evt.preventDefault()
      this._dismiss()
      return
    }

    if (evt.key !== 'Tab') return
    const focusable = this._getFocusableElements()
    if (!focusable.length) {
      evt.preventDefault()
      this._panel?.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (evt.shiftKey && (document.activeElement === first || !this._panel?.contains(document.activeElement))) {
      evt.preventDefault()
      last.focus()
    } else if (!evt.shiftKey && document.activeElement === last) {
      evt.preventDefault()
      first.focus()
    }
  }

  _dismiss(): void {
    if (!this._backdrop?.isConnected) return
    this._removeEl()
    this._onClose?.()
  }

  _removeEl(): void {
    if (this._closed) return
    this._closed = true
    document.removeEventListener('keydown', this._onKeyDown)
    this._backdrop?.remove()
    if (this._previousActiveElement?.isConnected) {
      ;(this._previousActiveElement as HTMLElement).focus()
    }
  }

  close(): void {
    this._removeEl()
  }
}

export function throttle<TArgs extends TimerArg[]>(
  callback: (this: TimerThis, ...args: TArgs) => void,
  wait: number,
  immediate = false
): (this: TimerThis, ...args: TArgs) => void {
  if (typeof callback !== 'function' || typeof wait !== 'number') {
    throw new Error('Invalid arguments: callback must be a function and wait must be a number.')
  }

  let timeout: ReturnType<typeof setTimeout> | null = null
  let pendingArgs: TArgs | null = null
  let pendingThis: TimerThis = undefined

  const schedule = () => {
    timeout = setTimeout(() => {
      if (!pendingArgs) {
        timeout = null
        return
      }

      const args = pendingArgs
      const context = pendingThis
      pendingArgs = null
      pendingThis = undefined
      callback.apply(context, args)

      if (immediate || pendingArgs) {
        schedule()
      } else {
        timeout = null
      }
    }, wait)
  }

  return function (...args) {
    if (immediate && !timeout) {
      callback.apply(this, args)
      schedule()
      return
    }

    pendingArgs = args
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- preserves the caller's dynamic `this` for the deferred call
    pendingThis = this
    if (!timeout) schedule()
  }
}

export function throttleByKey<TArgs extends TimerArg[]>(
  callback: (this: TimerThis, ...args: TArgs) => void,
  wait: number,
  getKey: (...args: TArgs) => PropertyKey
): (this: TimerThis, ...args: TArgs) => void {
  if (typeof callback !== 'function' || typeof wait !== 'number' || typeof getKey !== 'function') {
    throw new Error('Invalid arguments: callback and getKey must be functions and wait must be a number.')
  }

  const throttledCallbacks = new Map<PropertyKey, (this: TimerThis, ...args: TArgs) => void>()

  return function (...args) {
    const key = getKey(...args)
    let throttled = throttledCallbacks.get(key)
    if (!throttled) {
      throttled = throttle(callback, wait)
      throttledCallbacks.set(key, throttled)
    }
    throttled.apply(this, args)
  }
}

export const debounce = <TArgs extends TimerArg[]>(
  callback: (this: TimerThis, ...args: TArgs) => void,
  wait: number
): ((this: TimerThis, ...args: TArgs) => void) => {
  if (typeof callback !== 'function' || typeof wait !== 'number') {
    throw new Error('Invalid arguments: callback must be a function and wait must be a number.')
  }

  let timeoutId: TimeoutId = null
  return function (...args) {
    if (timeoutId !== null) window.clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => {
      callback.apply(this, args)
    }, wait)
  }
}

export function getWorkWithLoadingType(loadingType: string): string {
  const workMapping: Record<string, string> = {
    wheat: WORK_TYPES.farmer,
    wood: WORK_TYPES.woodcutter,
    berry: WORK_TYPES.forager,
    stone: WORK_TYPES.stoneminer,
    gold: WORK_TYPES.goldminer,
    meat: WORK_TYPES.hunter,
    fish: WORK_TYPES.fisher,
  }
  return workMapping[loadingType] || 'default'
}

export function capitalizeFirstLetter(string: string): string {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string')
  }
  return string.length > 0 ? string.charAt(0).toUpperCase() + string.slice(1) : ''
}

type NumericOperation = {
  key: string
  op: '*' | '+'
  value: number
}

export const updateObject = (target: MutableConfigObject, operation: NumericOperation): void => {
  if (typeof target !== 'object' || target === null) {
    throw new Error('Target must be a non-null object.')
  }

  if (!operation || !operation.key || !operation.op || typeof operation.value !== 'number') {
    throw new Error('Invalid operation: key, op, and value are required.')
  }

  function isRecord(value: object | ConfigValue): value is MutableConfigObject {
    return typeof value === 'object' && value !== null
  }

  function setToValue(obj: MutableConfigObject, value: number, path: string): void {
    const keys = path.split('.')
    for (let i = 0; i < keys.length - 1; i++) {
      const next = obj[keys[i]]
      if (!isRecord(next)) {
        throw new Error(`Path not found: ${keys.slice(0, i + 1).join('.')}`)
      }
      obj = next
    }
    obj[keys[keys.length - 1]] = value
  }

  const resolvedKey =
    operation.key === 'quantityMax' && target.quantityMax === undefined && target.totalQuantity !== undefined
      ? 'totalQuantity'
      : operation.key

  const keys = resolvedKey.split('.')
  let result: ConfigValue | MutableConfigObject | object = target

  for (const key of keys) {
    if (!isRecord(result)) {
      throw new Error(`Key not found: ${resolvedKey}`)
    }
    if (result[key] === undefined) {
      throw new Error(`Key not found: ${resolvedKey}`)
    }
    result = result[key]
  }

  if (typeof result !== 'number') {
    throw new Error(`Value is not numeric: ${resolvedKey}`)
  }

  switch (operation.op) {
    case '*':
      setToValue(target, result * Number(operation.value), resolvedKey)
      break
    case '+':
      setToValue(target, result + Number(operation.value), resolvedKey)
      break
    default:
      throw new Error(`Invalid operation: ${operation.op}`)
  }
}

type VisibleInstance = GridPosition & {
  context?: {
    map?: {
      revealEverything?: boolean
    }
  }
  owner?: {
    label?: string
  } | null
  size?: number
}

type PlayerLike = {
  label?: string
  views?: {
    isVisible: (i: number, j: number) => boolean
  }
}

export const canUpdateMinimap = (instance: VisibleInstance, player?: PlayerLike | null): boolean => {
  if (instance.context?.map?.revealEverything) return true
  return playerCanSeeInstance(instance, player)
}

export const playerCanSeeInstance = (instance?: VisibleInstance | null, player?: PlayerLike | null): boolean => {
  if (!instance || !player) return false
  return (
    instance.owner?.label === player.label ||
    instanceIsInPlayerSight(instance as RenderableInstance, player)
  )
}
