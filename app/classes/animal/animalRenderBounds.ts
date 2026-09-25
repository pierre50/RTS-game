import type { SpritesheetLike } from '../../types/pixi'

// Shared conservative envelope: camera tests must not instantiate an animation.
const boundsByTextures = new WeakMap<
  object,
  Map<number, { width: number; height: number; anchor: { x: number; y: number } }>
>()
export function getAnimalRenderBounds(sheet: SpritesheetLike, scale: number) {
  let sizes = boundsByTextures.get(sheet.textures)
  if (!sizes) boundsByTextures.set(sheet.textures, (sizes = new Map()))
  let bounds = sizes.get(scale)
  if (!bounds) {
    let left = 0,
      right = 0,
      top = 0,
      bottom = 0
    for (const texture of Object.values(sheet.textures)) {
      const width = texture.orig.width * Math.abs(scale)
      const height = texture.orig.height * Math.abs(scale)
      const anchor = texture.defaultAnchor ?? { x: 0.5, y: 1 }
      // Mirrored directions can extend on either side of the ground point.
      left = Math.max(left, width * anchor.x, width * (1 - anchor.x))
      right = left
      top = Math.max(top, height * anchor.y)
      bottom = Math.max(bottom, height * (1 - anchor.y))
    }
    bounds = { width: left + right, height: top + bottom, anchor: { x: 0.5, y: top / (top + bottom || 1) } }
    sizes.set(scale, bounds)
  }
  return bounds
}
