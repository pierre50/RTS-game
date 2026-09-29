import type { Viewport } from '../../types/geometry'
import { SOUND_DISTANCE_PROFILES } from '../../config/soundDistance'

export function getCameraWorkVolume(point: { x: number; y: number }, viewport: Viewport): number {
  const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = viewport
  if (visibleWidth <= 0 || visibleHeight <= 0) return 0
  const edgeDistance = Math.max(
    Math.abs(((point.x - visibleLeft) / visibleWidth) * 2 - 1),
    Math.abs(((point.y - visibleTop) / visibleHeight) * 2 - 1)
  )
  // Full volume in the central half, fading smoothly to silence at the viewport edges.
  const fade = Math.max(0, Math.min(1, (1 - edgeDistance) / 0.5))
  return SOUND_DISTANCE_PROFILES.work.maxVolume * fade * fade * (3 - 2 * fade)
}
