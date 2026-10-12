import { Texture, groupD8 } from 'pixi.js'

/** Explicit opt-in: directional sprites, buildings and inventory icons never enter this list. */
const MIRRORED_RESOURCE_TYPES = new Set([
  'GroundWood',
  'GroundStone',
  'MedicinalHerb',
  'ToxicHerb',
  'FiberPlant',
  'Berrybush',
  'Wheat',
])

type PlacedResource = { type: string; i: number; j: number; spaceId?: string | null }

/** Stable pseudo-random 50% choice from persisted placement, also for packed/lazy resources. */
function isResourceMirrored(resource: PlacedResource): boolean {
  if (!MIRRORED_RESOURCE_TYPES.has(resource.type)) return false
  let hash = 2166136261
  for (const char of `resource-mirror-v1:${resource.spaceId || 'outside'}:${resource.type}:${resource.i}:${resource.j}`)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
  return (hash ^ (hash >>> 16)) >>> 0 < 0x80000000
}

const reflectedTextures = new WeakMap<Texture, Texture>()
/** Flip UVs only: sprite transforms, anchors, bounds and hit areas remain untouched. */
export function resourceVisualTexture(resource: PlacedResource, texture: Texture): Texture {
  if (!isResourceMirrored(resource)) return texture
  let reflected = reflectedTextures.get(texture)
  if (!reflected || reflected.destroyed) {
    reflected = new Texture({
      source: texture.source,
      frame: texture.frame.clone(),
      orig: texture.orig.clone(),
      trim: texture.trim?.clone(),
      rotate: groupD8.add(texture.rotate, groupD8.MIRROR_HORIZONTAL),
      defaultAnchor: texture.defaultAnchor,
      defaultBorders: texture.defaultBorders,
    })
    reflectedTextures.set(texture, reflected)
  }
  return reflected
}
