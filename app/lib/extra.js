import { SHEET_TYPES, WORK_TYPES } from '../constants'
import { instanceIsInPlayerSight } from './grid'
import { degreeToDirection, uuidv4 } from './maths'
import { playClickSound } from './uiSound'
import { t } from './lang'

const FIVE_DIRECTION_ORDER = ['south', 'southwest', 'west', 'northwest', 'north']
const EIGHT_DIRECTION_ORDER = ['south', 'southwest', 'west', 'northwest', 'north', 'northeast', 'east', 'southeast']
const EAST_FIRST_EIGHT_DIRECTION_ORDER = [
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'north',
  'northeast',
]

function getSheetDirectionOrder(textures, directionCount, explicitOrder = null) {
  const frameCount = Object.keys(textures).length

  if (explicitOrder?.length) {
    return explicitOrder
  }
  if (directionCount === 8) {
    return EIGHT_DIRECTION_ORDER
  }
  if (directionCount === 5) {
    return FIVE_DIRECTION_ORDER
  }
  if (frameCount % 5 === 0) {
    return FIVE_DIRECTION_ORDER
  }
  if (frameCount % 8 === 0) {
    return EIGHT_DIRECTION_ORDER
  }
  return null
}

export function getAnimationFrames(textures, direction, directionCount = null, directionOrderOverride = null) {
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

export function getMirroredHalfArcFrameIndex(degree, frameCount) {
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

export function setUnitTexture(sheet, instance) {
  const animationSpeed = {
    standingSheet: 0.15,
    corpseSheet: 0,
  }
  const { paused } = instance.context
  if (paused) {
    return
  }
  const sheetToReset = [SHEET_TYPES.action, SHEET_TYPES.dying, SHEET_TYPES.corpse]
  if (!instance[sheet]) {
    if (instance.currentSheet !== SHEET_TYPES.walking && instance.walkingSheet) {
      instance.sprite.textures = [instance.walkingSheet.textures[Object.keys(instance.walkingSheet.textures)[0]]]
    } else {
      instance.sprite.textures = [instance.sprite.textures[instance.sprite.currentFrame]]
    }
    instance.currentSheet = SHEET_TYPES.walking
    instance.sprite.stop()
    instance.sprite.anchor.set(
      instance.sprite.textures[instance.sprite.currentFrame].defaultAnchor.x,
      instance.sprite.textures[instance.sprite.currentFrame].defaultAnchor.y
    )
    return
  }
  if (!sheetToReset.includes(sheet)) {
    instance.sprite.onLoop = null
    instance.sprite.onFrameChange = null
  }
  const goto = instance.currentSheet === sheet && instance.sprite.currentFrame
  instance.currentSheet = sheet
  const direction = degreeToDirection(instance.degree)
  const directionCount = instance.sheetDirectionCounts?.[sheet] ?? null
  const directionOrderOverride = instance.sheetDirectionOrders?.[sheet] ?? null
  if (directionCount === 9) {
    const names = Object.keys(instance[sheet].textures).sort((a, b) => {
      const na = parseInt(a.split('_')[0], 10)
      const nb = parseInt(b.split('_')[0], 10)
      return na - nb
    })
    const framesPerDirection = Math.floor(names.length / directionCount)
    const { frameIndex, mirrored } = getMirroredHalfArcFrameIndex(instance.degree, directionCount)
    const start = frameIndex * framesPerDirection
    const end = start + framesPerDirection

    instance.sprite.scale.x = mirrored ? -1 : 1
    instance.sprite.textures = names.slice(start, end).map(name => instance[sheet].textures[name])
    instance.sprite.animationSpeed = instance[sheet].data.animationSpeed ?? animationSpeed[sheet] ?? 0.3
    goto && goto < instance.sprite.textures.length ? instance.sprite.gotoAndPlay(goto) : instance.sprite.play()
    return
  }
  const directionOrder = getSheetDirectionOrder(instance[sheet].textures, directionCount, directionOrderOverride)

  if (directionOrder?.length === 8) {
    instance.sprite.scale.x = 1
    instance.sprite.textures = getAnimationFrames(
      instance[sheet].textures,
      direction,
      directionCount,
      directionOrderOverride
    )
  } else {
    switch (direction) {
      case 'southeast':
        instance.sprite.scale.x = -1
        instance.sprite.textures = getAnimationFrames(
          instance[sheet].textures,
          'southwest',
          directionCount,
          directionOrderOverride
        )
        break
      case 'northeast':
        instance.sprite.scale.x = -1
        instance.sprite.textures = getAnimationFrames(
          instance[sheet].textures,
          'northwest',
          directionCount,
          directionOrderOverride
        )
        break
      case 'east':
        instance.sprite.scale.x = -1
        instance.sprite.textures = getAnimationFrames(
          instance[sheet].textures,
          'west',
          directionCount,
          directionOrderOverride
        )
        break
      default:
        instance.sprite.scale.x = 1
        instance.sprite.textures = getAnimationFrames(
          instance[sheet].textures,
          direction,
          directionCount,
          directionOrderOverride
        )
    }
  }
  instance.sprite.animationSpeed = instance[sheet].data.animationSpeed ?? animationSpeed[sheet] ?? 0.3
  goto && goto < instance.sprite.textures.length ? instance.sprite.gotoAndPlay(goto) : instance.sprite.play()
}

export { EAST_FIRST_EIGHT_DIRECTION_ORDER }

export function bindAnimatedSpriteToTicker(sprite, app) {
  if (!sprite || !app?.ticker || sprite._usesAppTicker) {
    return sprite
  }

  sprite.autoUpdate = false

  const tick = deltaTime => {
    if (!sprite.destroyed) {
      sprite.update(deltaTime)
    }
  }

  const originalDestroy = sprite.destroy.bind(sprite)
  sprite.destroy = (...args) => {
    app.ticker.remove(tick)
    sprite._usesAppTicker = false
    return originalDestroy(...args)
  }

  sprite._usesAppTicker = true
  app.ticker.add(tick)
  return sprite
}

export function filterObject(obj, keys) {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Expected an object to filter.')
  }
  return keys.reduce((acc, key) => {
    if (obj.hasOwnProperty(key)) {
      acc[key] = obj[key]
    }
    return acc
  }, {})
}

export class Modal {
  constructor({ title, content, onClose } = {}) {
    this._id = uuidv4()
    this._onClose = onClose
    this._previousActiveElement = document.activeElement
    this._onKeyDown = this._handleKeyDown.bind(this)
    this._build(title, content)
  }

  _build(title, content) {
    const backdrop = document.createElement('div')
    this._backdrop = backdrop
    backdrop.id = this._id
    backdrop.className = 'modal'
    backdrop.addEventListener('pointerdown', e => {
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
      if (!this._panel.contains(document.activeElement)) this._panel.focus()
    })
  }

  _getFocusableElements() {
    if (!this._panel) return []
    return [
      ...this._panel.querySelectorAll(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ),
    ].filter(
      element =>
        !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0
    )
  }

  _isTopmost() {
    const modals = document.querySelectorAll('.modal')
    return modals.length > 0 && modals[modals.length - 1] === this._backdrop
  }

  _handleKeyDown(evt) {
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
      this._panel.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (evt.shiftKey && (document.activeElement === first || !this._panel.contains(document.activeElement))) {
      evt.preventDefault()
      last.focus()
    } else if (!evt.shiftKey && document.activeElement === last) {
      evt.preventDefault()
      first.focus()
    }
  }

  _dismiss() {
    if (!this._backdrop?.isConnected) return
    this._removeEl()
    this._onClose?.()
  }

  _removeEl() {
    if (this._closed) return
    this._closed = true
    document.removeEventListener('keydown', this._onKeyDown)
    this._backdrop?.remove()
    if (this._previousActiveElement?.isConnected) {
      this._previousActiveElement.focus()
    }
  }

  close() {
    this._removeEl()
  }
}

export var CustomTimeout = function (callback, delay) {
  if (typeof callback !== 'function' || typeof delay !== 'number') {
    throw new Error('Invalid arguments for CustomTimeout.')
  }

  let timerId,
    start,
    remaining = delay

  this.pause = () => {
    window.clearTimeout(timerId)
    timerId = null
    remaining -= Date.now() - start
    return remaining
  }

  this.resume = () => {
    if (timerId) {
      return
    }

    start = Date.now()
    timerId = window.setTimeout(callback, remaining)
  }

  this.reset = () => {
    this.pause()
    remaining = delay
    this.resume()
  }

  this.resume()
}

export function throttle(callback, wait, immediate = false) {
  if (typeof callback !== 'function' || typeof wait !== 'number') {
    throw new Error('Invalid arguments: callback must be a function and wait must be a number.')
  }

  let timeout = null
  let pendingArgs = null
  let pendingThis = null

  const schedule = () => {
    timeout = setTimeout(() => {
      if (!pendingArgs) {
        timeout = null
        return
      }

      const args = pendingArgs
      const context = pendingThis
      pendingArgs = null
      pendingThis = null
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
    pendingThis = this
    if (!timeout) schedule()
  }
}

export function throttleByKey(callback, wait, getKey) {
  if (typeof callback !== 'function' || typeof wait !== 'number' || typeof getKey !== 'function') {
    throw new Error('Invalid arguments: callback and getKey must be functions and wait must be a number.')
  }

  const throttledCallbacks = new Map()

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

export const debounce = (callback, wait) => {
  if (typeof callback !== 'function' || typeof wait !== 'number') {
    throw new Error('Invalid arguments: callback must be a function and wait must be a number.')
  }

  let timeoutId = null
  return function (...args) {
    window.clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => {
      callback.apply(this, args)
    }, wait)
  }
}

export function getWorkWithLoadingType(loadingType) {
  const workMapping = {
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

export function capitalizeFirstLetter(string) {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string')
  }
  return string.length > 0 ? string.charAt(0).toUpperCase() + string.slice(1) : ''
}

export const updateObject = (target, operation) => {
  if (typeof target !== 'object' || target === null) {
    throw new Error('Target must be a non-null object.')
  }

  if (!operation || !operation.key || !operation.op || typeof operation.value !== 'number') {
    throw new Error('Invalid operation: key, op, and value are required.')
  }

  function setToValue(obj, value, path) {
    const keys = path.split('.')
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) {
        throw new Error(`Path not found: ${keys.slice(0, i + 1).join('.')}`)
      }
      obj = obj[keys[i]]
    }
    obj[keys[keys.length - 1]] = value
  }

  const resolvedKey =
    operation.key === 'quantityMax' && target.quantityMax === undefined && target.totalQuantity !== undefined
      ? 'totalQuantity'
      : operation.key

  const keys = resolvedKey.split('.')
  let result = target

  for (const key of keys) {
    if (result[key] === undefined) {
      throw new Error(`Key not found: ${resolvedKey}`)
    }
    result = result[key]
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

export const canUpdateMinimap = (instance, player) => {
  if (instance.context?.map?.revealEverything) return true
  return playerCanSeeInstance(instance, player)
}

export const playerCanSeeInstance = (instance, player) => {
  if (!instance || !player) return false
  return instance.owner?.label === player.label || instanceIsInPlayerSight(instance, player)
}
