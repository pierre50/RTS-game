import { instanceIsInPlayerSight } from './grid'
import { getEntitySpaceId } from './mapSpaces'
export { Modal } from './ui/Modal'
export {
  bindAnimatedSpriteToTicker,
  getAnimationFrames,
  getSpriteFrameSelection,
  getUnitSpritesheetAnimationSpeed,
  setUnitTexture,
} from './entities/spriteTextures'
export type { UnitTextureInstance } from './entities/spriteTextures'
import type { GridPosition } from '../types/grid'
import type { RenderableInstance } from './grid/visibility'

type TimeoutId = ReturnType<typeof window.setTimeout> | null
type TimerArg = string | number | boolean | object | null | undefined
type TimerThis = object | void

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

export function capitalizeFirstLetter(string: string): string {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string')
  }
  return string.length > 0 ? string.charAt(0).toUpperCase() + string.slice(1) : ''
}

type VisibleInstance = GridPosition & {
  context?: {
    map?: {
      activeSpaceId?: string | null
      revealEverything?: boolean
    }
  }
  owner?: {
    label?: string
  } | null
  size?: number
  spaceId?: string | null
}

type PlayerLike = {
  label?: string
  views?: {
    isVisible: (i: number, j: number) => boolean
  }
}

const playerOwnsInstance = (instance?: VisibleInstance | null, player?: PlayerLike | null): boolean => {
  if (!instance || !player) return false
  return instance.owner?.label === player.label
}

const playerHasVisionOfInstance = (instance?: VisibleInstance | null, player?: PlayerLike | null): boolean => {
  if (!instance || !player) return false
  return instanceIsInPlayerSight(instance as RenderableInstance, player)
}

export const canUpdateMinimap = (instance: VisibleInstance, player?: PlayerLike | null): boolean => {
  const activeSpaceId = instance.context?.map?.activeSpaceId || 'outside'
  if (getEntitySpaceId(instance) !== activeSpaceId) return false
  if (instance.context?.map?.revealEverything) return true
  return playerOwnsInstance(instance, player)
}

export const playerCanSeeInstance = (instance?: VisibleInstance | null, player?: PlayerLike | null): boolean => {
  return playerOwnsInstance(instance, player) || playerHasVisionOfInstance(instance, player)
}
