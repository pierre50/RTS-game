import { FAMILY_TYPES, PASSABLE_RESOURCE_TYPES, RESOURCE_TYPES } from '../../constants'
import {
  cartesianToIsometric,
  getEntityCell,
  getGroundReliefLevel,
  getInstanceZIndex,
  getReliefLiftPixels,
  uuidv4,
  parseTextureRef,
} from '../../lib'
import { updateInstanceRenderVisibility } from '../../lib/grid/visibility'
import { invalidateEconomicKnowledge } from '../../services/world/EconomicKnowledgeUpdates'
import { resourceVisualState, type ResourceViewAdapter } from '../../rendering/ResourceView'
import { ResourceInterface } from '../../ui/entity/ResourceInterface'
import { Instance } from '../Instance'
import type { Resource } from '../Resource'
import { getResourceConfig, type ResourceOptions } from '../ResourceTexture'
import type { GameContextLike } from '../../types/context'
import type { EntityInfoRenderOptions } from '../../types/entities'
import {
  createResourceHandle,
  hasResourceView,
  releaseResourceView,
  type ResourceHandleHooks,
  type ResourceHandleState,
  type ResourceView,
} from './ResourceHandle'
import { ResourceEvents } from './ResourceEvents'

// The handle preserves the gameplay API while the renderer owns its disposable view.
const asResource = (state: ResourceHandleState) => state as unknown as Resource
export type ResourceViewFactory = {
  create(resource: Resource): ResourceViewAdapter<ResourceView>
  isDisplayMethod(key: string): boolean
}
const emitters = new WeakMap<object, ResourceEvents>()
const defaults = new WeakMap<object, object>()

function emitter(resource: object): ResourceEvents {
  let value = emitters.get(resource)
  if (!value) {
    value = new ResourceEvents()
    emitters.set(resource, value)
  }
  return value
}

const overrides: Record<string, unknown> = {
  destroy(this: ResourceHandleState) {
    if (this.destroyedState) return
    this.destroyedState = true
    this.isDestroyed = true
    const resource = asResource(this)
    releaseResourceView(this)
    invalidateEconomicKnowledge(resource.context.map, resource)
    emitters.get(this)?.emit('destroyed', this)
    emitters.delete(this)
  },
  clear(this: ResourceHandleState) {
    if (this.isDestroyed) return
    const resource = asResource(this)
    for (const cell of resource.getFootprintCells()) {
      if (cell.has === resource) {
        cell.has = null
        cell.solid = false
      }
      cell.corpses.delete(resource)
    }
    resource.context.map.resources.delete(resource)
    resource.context.map.removeFromInstanceBucket(resource)
    resource.destroy()
  },
  pause(this: ResourceHandleState) {
    if (hasResourceView(this)) Instance.prototype.pause.call(asResource(this))
  },
  resume(this: ResourceHandleState) {
    if (hasResourceView(this)) Instance.prototype.resume.call(asResource(this))
  },
  on(this: ResourceHandleState, event: string, callback: (...args: unknown[]) => void) {
    emitter(this).on(event, callback)
    return this
  },
  once(this: ResourceHandleState, event: string, callback: (...args: unknown[]) => void) {
    emitter(this).once(event, callback)
    return this
  },
  off(this: ResourceHandleState, event: string, callback: (...args: unknown[]) => void) {
    emitters.get(this)?.off(event, callback)
    return this
  },
  emit(this: ResourceHandleState, event: string, ...args: unknown[]) {
    return emitters.get(this)?.emit(event, ...args) ?? false
  },
  setDefaultInterface(this: ResourceHandleState, ...args: Parameters<Resource['setDefaultInterface']>) {
    return new ResourceInterface(asResource(this)).setDefaultInterface(...args)
  },
}
const hookCache = new WeakMap<ResourceViewFactory, ResourceHandleHooks>()
function resourceHooks(prototype: Resource, viewFactory: ResourceViewFactory): ResourceHandleHooks {
  const cached = hookCache.get(viewFactory)
  if (cached) return cached
  const adapters = new WeakMap<ResourceHandleState, ResourceViewAdapter<ResourceView>>()
  const adapterFor = (state: ResourceHandleState): ResourceViewAdapter<ResourceView> => {
    let adapter = adapters.get(state)
    if (!adapter) {
      adapter = viewFactory.create(asResource(state))
      adapters.set(state, adapter)
    }
    return adapter
  }
  const hooks: ResourceHandleHooks = {
    isDisplayMethod(key) {
      return viewFactory.isDisplayMethod(key)
    },
    property(state, key) {
      if (key === 'interface') {
        const resource = asResource(state)
        state.interface = {
          info: (element: HTMLElement, options?: EntityInfoRenderOptions) =>
            resource.setDefaultInterface(element, getResourceConfig().resources[resource.type], options),
        }
        return state.interface
      }
      if (key === 'getChildByLabel' && !hasResourceView(state)) return () => null
      return undefined
    },
    method(key) {
      return (
        overrides[key] ??
        Object.getOwnPropertyDescriptor(prototype, key)?.value ??
        Object.getOwnPropertyDescriptor(Instance.prototype, key)?.value
      )
    },
    bounds(state) {
      return adapterFor(state).bounds(resourceVisualState(asResource(state)))
    },
    create(state) {
      return adapterFor(state).mount(resourceVisualState(asResource(state)))
    },
    release(state, view) {
      adapterFor(state).unmount(view)
      delete state.sprite
    },
    sync(state, view) {
      const resource = asResource(state)
      if (view) adapterFor(state).update(view, resourceVisualState(resource))
      prototype.syncShadow.call(resource)
    },
  }

  hookCache.set(viewFactory, hooks)
  return hooks
}

export function createLogicalResource(
  options: ResourceOptions,
  context: GameContextLike,
  prototype: Resource,
  viewFactory: ResourceViewFactory
): Resource {
  const definition = getResourceConfig().resources[options.type]
  let shared = defaults.get(definition)
  if (!shared) {
    shared = {
      ...definition,
      family: FAMILY_TYPES.resource,
      size: 1,
      selected: false,
      isDead: false,
      isDestroyed: false,
      visible: false,
      renderable: true,
      alpha: 1,
      shadow: null,
      windTick: null,
      windTime: 0,
      windPhase: 0,
      visualSettingsCleanup: null,
      interval: null,
      timeoutId: null,
    }
    defaults.set(definition, shared)
  }
  const state = Object.assign(Object.create(shared), options, {
    context,
    label: (options as { label?: string }).label ?? uuidv4(),
  }) as ResourceHandleState
  const resource = asResource(createResourceHandle(state, resourceHooks(prototype, viewFactory)))
  const cell = getEntityCell(resource, context.map)
  if (!cell) throw new Error(`Missing resource cell ${options.i},${options.j}`)
  resource.quantity = resource.quantity ?? resource.totalQuantity
  resource.hitPoints = resource.hitPoints ?? resource.totalHitPoints
  if (
    resource.type === RESOURCE_TYPES.berrybush &&
    resource.berrybushFullTextureName == null &&
    parseTextureRef(resource.textureName).frame > 0
  ) {
    resource.berrybushFullTextureName = resource.textureName
  }
  const [x, y] = cartesianToIsometric(resource.i, resource.j)
  resource.x = x
  resource.y = y
  resource.z = cell.z
  resource.zIndex = getInstanceZIndex(resource)
  resource.reliefLift = -getReliefLiftPixels(getGroundReliefLevel(cell))
  cell.solid = !PASSABLE_RESOURCE_TYPES.has(resource.type)
  cell.has = resource
  context.map.addToInstanceBucket(resource)
  invalidateEconomicKnowledge(context.map, resource)
  updateInstanceRenderVisibility(resource)
  return resource
}
