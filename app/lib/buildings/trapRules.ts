import type { GameContextLike } from '../../types/context'

export const TRAP_PREY_TYPES = ['Hare', 'Fox', 'BlackGrouse'] as const

type TrapSightViewer = {
  family?: string
  isDead?: boolean
  isDestroyed?: boolean
  label?: string
}

export function isTrapObservedBySight(
  building: { i: number; j: number; label?: string },
  context: GameContextLike,
  buildingsOnly = false
): boolean {
  const { players } = context
  for (const player of players) {
    const viewers = player.views?.getViewers?.(building.i, building.j)
    if (!viewers) continue
    for (const viewerRef of viewers) {
      if (typeof viewerRef === 'string') continue
      const viewer = viewerRef as TrapSightViewer
      if ((building.label && viewer.label === building.label) || viewer.isDead || viewer.isDestroyed) continue
      if (viewer.family === 'building' || (!buildingsOnly && viewer.family === 'unit')) return true
    }
  }
  return false
}
