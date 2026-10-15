export type EntityHudAnchor = {
  spaceId: string
  position: { x: number; y: number; z: number }
}

type HudCell = { z?: number | null }
type HudGrid = Array<Array<HudCell | null | undefined> | null | undefined>

export type EntityHudAnchorSource = {
  x?: number
  y?: number
  z?: number | null
  i?: number
  j?: number
  spaceId?: string | null
  currentCell?: HudCell | null
  context?: {
    map?: {
      grid?: HudGrid
      spaces?: { get(id: string): { grid?: HudGrid } | undefined }
    }
  }
}

function finiteCoordinate(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** World coordinates for HUD elements. Cell height takes precedence over an entity's cached z. */
export function entityHudAnchor(source: EntityHudAnchorSource): EntityHudAnchor {
  const spaceId = source.spaceId || 'outside'
  const { i, j } = source
  const map = source.context?.map
  const spaceCell = i != null && j != null ? map?.spaces?.get(spaceId)?.grid?.[i]?.[j] : undefined
  const currentCell = source.currentCell
  const outsideCell = i != null && j != null ? map?.grid?.[i]?.[j] : undefined
  const cell = spaceCell ?? currentCell ?? outsideCell
  return {
    spaceId,
    position: {
      x: finiteCoordinate(source.x),
      y: finiteCoordinate(source.y),
      z: finiteCoordinate(cell?.z ?? source.z),
    },
  }
}
