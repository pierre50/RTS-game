import { cartesianToIsometric } from '../../lib/maths'
import type { GameContextLike } from '../../types/context'
import type { GridPosition } from '../../types/grid'

// World pixels: enough room for residents to approach the viewport before becoming visible.
export const AMBIENT_CAMERA_MARGIN = 256
export const AMBIENT_CAMERA_EXIT_MARGIN = 384

export function ambientActivityArea(
  context: GameContextLike,
  margin = AMBIENT_CAMERA_MARGIN
): (point: GridPosition & { spaceId?: string | null }) => boolean {
  if ((context.map.activeSpaceId ?? 'outside') !== 'outside') return () => false
  const viewport = context.controls?.getViewportMetrics?.()
  return point => {
    const outside =
      !point.spaceId || point.spaceId === 'outside'
        ? point
        : context.map.spaces?.get(point.spaceId)?.portals?.find(portal => portal.targetSpaceId === 'outside')
            ?.targetCell
    if (!outside) return false
    const cell = context.map.grid?.[outside.i]?.[outside.j]
    const [isoX, isoY] = cartesianToIsometric(outside.i, outside.j)
    const x = cell?.x ?? isoX,
      y = cell?.y ?? isoY
    if (!viewport) return Boolean(context.controls?.instanceInCamera?.({ x, y }))
    return (
      x >= viewport.visibleLeft - margin &&
      x <= viewport.visibleLeft + viewport.visibleWidth + margin &&
      y >= viewport.visibleTop - margin &&
      y <= viewport.visibleTop + viewport.visibleHeight + margin
    )
  }
}
