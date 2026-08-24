import { MINING_RESOURCE_CONFIG, WORK_TYPES } from '../constants'
import { instanceIsInPlayerSight } from './grid'
export { Modal } from './Modal'
export {
  bindAnimatedSpriteToTicker,
  getAnimationFrames,
  getSpriteFrameSelection,
  setUnitTexture,
} from './spriteTextures'
export type { UnitTextureInstance } from './spriteTextures'
import type { GridPosition } from '../types/grid'
import type { ConfigValue } from '../types/config'
import type { RenderableInstance } from './grid/visibility'

type MutableConfigObject = { [key: string]: ConfigValue | object }
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

export function getWorkWithLoadingType(loadingType: string): string {
  const miningConfig = Object.values(MINING_RESOURCE_CONFIG ?? {}).find(config => config.loadingType === loadingType)
  if (miningConfig) return miningConfig.work
  const workMapping: Record<string, string> = {
    wheat: WORK_TYPES.farmer,
    wood: WORK_TYPES.woodcutter,
    berry: WORK_TYPES.forager,
    meat: WORK_TYPES.hunter,
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

const playerOwnsInstance = (instance?: VisibleInstance | null, player?: PlayerLike | null): boolean => {
  if (!instance || !player) return false
  return instance.owner?.label === player.label
}

const playerHasVisionOfInstance = (instance?: VisibleInstance | null, player?: PlayerLike | null): boolean => {
  if (!instance || !player) return false
  return instanceIsInPlayerSight(instance as RenderableInstance, player)
}

export const canUpdateMinimap = (instance: VisibleInstance, player?: PlayerLike | null): boolean => {
  if (instance.context?.map?.revealEverything) return true
  return playerOwnsInstance(instance, player)
}

export const playerCanSeeInstance = (instance?: VisibleInstance | null, player?: PlayerLike | null): boolean => {
  return playerOwnsInstance(instance, player) || playerHasVisionOfInstance(instance, player)
}
