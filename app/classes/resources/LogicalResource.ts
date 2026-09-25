import { Container, EventEmitter, Polygon } from 'pixi.js'
import { CELL_WIDTH, CELL_HEIGHT, FAMILY_TYPES, PASSABLE_RESOURCE_TYPES, RESOURCE_TYPES } from '../../constants'
import {
  cartesianToIsometric,
  getEntityCell,
  getEntityMapSpace,
  getGroundReliefLevel,
  getInstanceZIndex,
  getReliefLiftPixels,
  uuidv4,
  parseTextureRef,
} from '../../lib'
import { updateInstanceRenderVisibility } from '../../lib/grid/visibility'
import { onVisualSettingsChange } from '../../lib/audio/settings'
import { invalidateEconomicKnowledge } from '../../services/world/EconomicKnowledgeUpdates'
import { ResourceInterface } from '../../ui/entity/ResourceInterface'
import { Instance } from '../Instance'
import { Resource } from '../Resource'
import { getResourceConfig, type ResourceOptions } from '../ResourceTexture'
import { prepareStaticResourceTexture } from '../ResourceSpriteFactory'
import type { GameContextLike } from '../../types/context'
import type { EntityInfoRenderOptions } from '../../types/entities'
import {
  attachResourceView,
  createResourceHandle,
  hasResourceView,
  releaseResourceView,
  type ResourceHandleHooks,
  type ResourceHandleState,
  type ResourceView,
} from './ResourceHandle'

// The adapter preserves the existing gameplay API while only its optional view is a Container.
const asResource = (state: ResourceHandleState) => state as unknown as Resource
const emitters = new WeakMap<object, EventEmitter>()
const bounds = new Map<string, { width: number; height: number; anchor: { x: number; y: number } }>()
const defaults = new WeakMap<object, object>()

function emitter(resource: object): EventEmitter {
  let value = emitters.get(resource)
  if (!value) {
    value = new EventEmitter()
    emitters.set(resource, value)
  }
  return value
}
function dropView(state: ResourceHandleState, view: ResourceView): void {
  const resource = asResource(state)
  resource.stopWindMotion()
  resource.visualSettingsCleanup?.()
  resource.visualSettingsCleanup = null
  resource.shadow?.parent?.removeChild(resource.shadow)
  resource.shadow?.destroy({ children: true, texture: false })
  resource.shadow = null
  const container = view as unknown as Container
  container.parent?.removeChild(container)
  container.destroy({ children: true, texture: false, textureSource: false })
  delete state.sprite
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
const hooks: ResourceHandleHooks = {
  isDisplayMethod(key) {
    return typeof Object.getOwnPropertyDescriptor(Container.prototype, key)?.value === 'function'
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
      Object.getOwnPropertyDescriptor(Resource.prototype, key)?.value ??
      Object.getOwnPropertyDescriptor(Instance.prototype, key)?.value
    )
  },
  bounds(state) {
    const resource = asResource(state)
    const key = `${resource.type}:${resource.textureName}:${resource.spriteScale ?? 1}`
    let result = bounds.get(key)
    if (!result) {
      const cell = getEntityCell(resource, resource.context.map)!
      const { texture } = prepareStaticResourceTexture(resource, cell)
      result = {
        width: texture.width * (resource.spriteScale ?? 1),
        height: texture.height * (resource.spriteScale ?? 1),
        anchor: { x: texture.defaultAnchor?.x ?? 0, y: texture.defaultAnchor?.y ?? 0 },
      }
      bounds.set(key, result)
    }
    return result
  },
  create(state) {
    const resource = asResource(state)
    const container = new Container()
    const view = container as unknown as ResourceView
    attachResourceView(state, view)
    container.position.set(resource.x, resource.y)
    container.zIndex = resource.zIndex
    container.visible = resource.visible
    container.alpha = Number(state.alpha ?? 1)
    container.eventMode = 'auto'
    container.label = resource.label
    const space = getEntityMapSpace(resource, resource.context.map)
    ;(space?.container ?? resource.context.map).addChild(container)
    resource.initializeResourceVisuals(
      resource as unknown as ResourceOptions,
      getEntityCell(resource, resource.context.map)!
    )
    if (resource.type === RESOURCE_TYPES.tree && resource.hitPoints <= 0 && !resource.isDead) {
      resource.sprite.hitArea = new Polygon([
        -CELL_WIDTH / 2,
        0,
        0,
        -CELL_HEIGHT / 2,
        CELL_WIDTH / 2,
        0,
        0,
        CELL_HEIGHT / 2,
      ])
    }
    resource.visualSettingsCleanup = onVisualSettingsChange(() => resource.syncVisualSettings())
    return view
  },
  release: dropView,
  sync(state) {
    Resource.prototype.syncShadow.call(asResource(state))
  },
}

export function createLogicalResource(options: ResourceOptions, context: GameContextLike): Resource {
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
  const resource = asResource(createResourceHandle(state, hooks))
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
