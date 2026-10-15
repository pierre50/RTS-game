import { Container, Polygon } from 'pixi.js'
import { CELL_HEIGHT, CELL_WIDTH, RESOURCE_TYPES } from '../../constants'
import { getEntityCell, getEntityMapSpace } from '../../lib'
import { onVisualSettingsChange } from '../../lib/audio/settings'
import type { Resource } from '../../classes/Resource'
import { prepareStaticResourceTexture } from '../../classes/ResourceSpriteFactory'
import type { ResourceOptions } from '../../classes/ResourceTexture'
import { attachResourceView, type ResourceView } from '../../classes/resources/ResourceHandle'
import type { ResourceViewAdapter, ResourceVisualBounds, ResourceVisualState } from '../ResourceView'

const boundsCache = new Map<string, ResourceVisualBounds>()

/** Compatibility adapter for static resources while their gameplay API is being separated. */
export class PixiResourceView implements ResourceViewAdapter<ResourceView> {
  constructor(private readonly resource: Resource) {}

  static isDisplayMethod(key: string): boolean {
    return typeof Object.getOwnPropertyDescriptor(Container.prototype, key)?.value === 'function'
  }

  bounds(state: ResourceVisualState): ResourceVisualBounds {
    const resource = this.resource
    const key = `${state.type}:${state.textureName}:${resource.spriteScale ?? 1}`
    let bounds = boundsCache.get(key)
    if (!bounds) {
      const cell = getEntityCell(resource, resource.context.map)!
      const { texture } = prepareStaticResourceTexture(resource, cell)
      bounds = {
        width: texture.width * (resource.spriteScale ?? 1),
        height: texture.height * (resource.spriteScale ?? 1),
        anchor: { x: texture.defaultAnchor?.x ?? 0, y: texture.defaultAnchor?.y ?? 0 },
      }
      boundsCache.set(key, bounds)
    }
    return bounds
  }

  mount(state: ResourceVisualState): ResourceView {
    const resource = this.resource
    const container = new Container()
    this.update(container as unknown as ResourceView, state)
    container.eventMode = 'auto'
    container.label = state.id
    attachResourceView(resource, container as unknown as ResourceView)
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
    return container as unknown as ResourceView
  }

  update(view: ResourceView, state: ResourceVisualState): void {
    const container = view as unknown as Container
    container.position.set(state.position.x, state.position.y)
    container.zIndex = state.sortOrder
    container.visible = state.visible
    container.alpha = state.alpha
  }

  unmount(view: ResourceView): void {
    const resource = this.resource
    resource.stopWindMotion()
    resource.visualSettingsCleanup?.()
    resource.visualSettingsCleanup = null
    resource.shadow?.parent?.removeChild(resource.shadow)
    resource.shadow?.destroy({ children: true, texture: false })
    resource.shadow = null
    const container = view as unknown as Container
    container.parent?.removeChild(container)
    container.destroy({ children: true, texture: false, textureSource: false })
  }
}
