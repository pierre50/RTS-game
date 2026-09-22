import type { Bounds } from '../../types/geometry'
import type { Point } from '../../types/grid'
import type { RuntimeMap } from '../../types/map'
import { getEntityMapPoint } from '../mapSpaces'

export type BoundsSource = {
  context?: {
    map?: unknown
  }
  x: number
  y: number
  destroyed?: boolean
  isDestroyed?: boolean
  position?: { x?: number; y?: number } | null
  spaceId?: string
  deferredSpriteBounds?: { width: number; height: number; anchor: { x: number; y: number } }
  sprite?: { destroyed?: boolean; width: number; height: number; anchor?: { x: number; y: number } }
}

export function getVisibilityRuntimeMap(instance?: { context?: { map?: unknown } } | null): RuntimeMap | null {
  const map = instance?.context?.map
  if (!map || typeof map !== 'object') return null
  const candidate = map as Partial<RuntimeMap>
  return Array.isArray(candidate.grid) && typeof candidate.size === 'number' ? (candidate as RuntimeMap) : null
}

export function getRenderablePosition(instance: BoundsSource): Point | null {
  if (instance.isDestroyed || instance.destroyed || instance.position === null) return null
  const x = instance.position?.x ?? instance.x
  const y = instance.position?.y ?? instance.y
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const map = getVisibilityRuntimeMap(instance)
  if (map) return getEntityMapPoint({ spaceId: instance.spaceId, x, y }, map)
  return { x, y }
}

// Buildings (and other sprite-based instances) are anchored on a single ground point but their
// sprite typically extends well beyond it (upward especially, in this isometric projection), so
// culling on the anchor point alone hides them while part of the sprite is still on screen. This
// derives the instance's actual on-screen bounding box so camera culling — and other overlap
// tests, e.g. hero-occlusion fade — can use it instead.
export function getInstanceScreenBounds(instance: BoundsSource, position?: Point | null): Bounds | undefined {
  const sprite: BoundsSource['sprite'] = instance.deferredSpriteBounds ?? instance.sprite
  if (!sprite) return undefined
  if (sprite.destroyed) return undefined
  if (position === undefined) position = getRenderablePosition(instance)
  if (!position) return undefined

  const anchorX = sprite.anchor?.x ?? 0.5
  const anchorY = sprite.anchor?.y ?? 1
  const width = sprite.width
  const height = sprite.height

  return {
    minX: position.x - width * anchorX,
    minY: position.y - height * anchorY,
    width,
    height,
  }
}

// Approximate ground shadows for every sprite with half its height plus a small margin.
// Extending only the lower edge delays culling when an entity exits through the top.
export function getInstanceCameraBounds(instance: BoundsSource, position?: Point | null): Bounds | undefined {
  const bounds = getInstanceScreenBounds(instance, position)
  if (bounds) bounds.height += bounds.height * 0.5 + 16
  return bounds
}
