import { trackNaturalGrowth } from '../../services/NaturalGrowthQueue'
/** Compatibility boundary between gameplay entities and disposable display objects.
 * All gameplay methods run on the stable handle, never on the display object.
 */
export type ResourceView = {
  visible: boolean
  destroyed?: boolean
  destroy(options?: unknown): void
  [key: string]: unknown
}
export type ResourceHandleState = Record<string, unknown> & { visible: boolean; isDestroyed: boolean }
export type ResourceHandleHooks = {
  property?(handle: ResourceHandleState, key: string): unknown
  isDisplayMethod?(key: string): boolean
  method(key: string): unknown
  create(handle: ResourceHandleState): ResourceView
  release(handle: ResourceHandleState, view: ResourceView): void
  bounds(handle: ResourceHandleState): unknown
  sync(handle: ResourceHandleState): void
}
type Entry = { state: ResourceHandleState; hooks: ResourceHandleHooks; view?: ResourceView; creating?: boolean }
const entries = new WeakMap<object, Entry>()
const activeViews = new WeakMap<object, Set<ResourceHandleState>>()
const displayFields = new Set(['alpha', 'tint', 'zIndex', 'eventMode', 'renderable', 'x', 'y', 'rotation'])

export function releaseResourceView(handle: object): void {
  const entry = entries.get(handle)
  if (!entry?.view) return
  const view = entry.view
  entry.hooks.release(handle as ResourceHandleState, view)
  entry.view = undefined
  const map = (entry.state.context as { map?: object } | undefined)?.map
  if (map) activeViews.get(map)?.delete(handle as ResourceHandleState)
}

export function hasResourceView(handle: object): boolean {
  return Boolean(entries.get(handle)?.view)
}

function ensureView(handle: object, entry: Entry): ResourceView | undefined {
  if (entry.view || entry.creating || entry.state.isDestroyed) return entry.view
  entry.creating = true
  try {
    entry.view = entry.hooks.create(handle as ResourceHandleState)
    return entry.view
  } catch (error) {
    releaseResourceView(handle)
    throw error
  } finally {
    entry.creating = false
  }
}

function syncHandle(this: ResourceHandleState): void {
  const entry = entries.get(this)!
  if (this.visible) {
    ensureView(this, entry)
    entry.hooks.sync(this)
  } else if (!this.selected && !this.isDead) releaseResourceView(this)
  else if (entry.view) entry.hooks.sync(this)
}

const handler: ProxyHandler<ResourceHandleState> = {
  get(state, key, handle) {
    const entry = entries.get(handle)!
    if (key === 'syncShadow') return syncHandle
    if (key === 'deferredSpriteBounds') return entry.view ? undefined : entry.hooks.bounds(handle)
    if (key === 'sprite' && !state.sprite) ensureView(handle, entry)
    if (key === 'position') return entry.view?.position ?? { x: state.x, y: state.y }
    if (key === 'parent') return entry.view?.parent ?? null
    if (key === 'destroyed') return state.isDestroyed
    if (Reflect.has(state, key)) return Reflect.get(state, key)
    if (typeof key !== 'string') return undefined
    if (key === 'width' || key === 'height') return (entry.hooks.bounds(handle) as Record<string, unknown>)?.[key]
    const property = entry.hooks.property?.(handle, key)
    if (property !== undefined) return property
    const method = entry.hooks.method(key)
    if (method !== undefined) return method
    if (!entry.view && entry.hooks.isDisplayMethod?.(key)) ensureView(handle, entry)
    const value = entry.view?.[key]
    return typeof value === 'function' ? value.bind(entry.view) : value
  },
  set(state, key, value, handle) {
    Reflect.set(state, key, value)
    if (key === 'quantity') trackNaturalGrowth(handle)
    const entry = entries.get(handle)!
    if (entry.view && (displayFields.has(String(key)) || key === 'visible')) entry.view[String(key)] = value
    return true
  },
  has(state, key) {
    return key === 'deferredSpriteBounds' || Reflect.has(state, key)
  },
}

export function createResourceHandle(state: ResourceHandleState, hooks: ResourceHandleHooks): ResourceHandleState {
  const handle = new Proxy(state, handler)
  entries.set(handle, { state, hooks })
  return handle
}

/** Attach before initializing sprites: their methods may already need the container. */
export function attachResourceView(handle: object, view: ResourceView): void {
  const entry = entries.get(handle)
  if (!entry) throw new Error('Unknown resource handle')
  entry.view = view
  const map = (entry.state.context as { map?: object } | undefined)?.map
  if (map) {
    let active = activeViews.get(map)
    if (!active) {
      active = new Set()
      activeViews.set(map, active)
    }
    active.add(handle as ResourceHandleState)
  }
}

export function destroyLogicalResourceViews(map: object): void {
  for (const handle of activeViews.get(map) ?? []) releaseResourceView(handle)
  activeViews.delete(map)
}

export function trimLogicalResourceViews(map: object): void {
  for (const handle of activeViews.get(map) ?? []) {
    if (!handle.visible && !handle.selected && !handle.isDead) releaseResourceView(handle)
  }
}
