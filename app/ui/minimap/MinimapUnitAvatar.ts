import { renderUnitHeadAvatar } from '../../lib/avatar'
import type { MinimapHostLike } from '../../types/context'
import type { RuntimeEntity,UnitEntity } from '../../types/entities'

export function getMinimapUnitAvatar(menu: MinimapHostLike, cache: WeakMap<RuntimeEntity, HTMLCanvasElement>, unit: RuntimeEntity): HTMLCanvasElement | null {
  const cached = cache.get(unit)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  if (!renderUnitHeadAvatar(menu.context.app, unit as UnitEntity, canvas)) return null
  cache.set(unit, canvas)
  return canvas
}
