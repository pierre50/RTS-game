import { updateInstanceRenderVisibility } from '../../lib'
import type { RuntimeEntity } from '../../types/entities'

type VisibleCellContext = {
  map?: {
    revealEverything?: boolean
  }
  player?: {
    views?: {
      isViewed(i: number, j: number): boolean
    }
  }
}

type VisibleCellHost = {
  context: VisibleCellContext
  map?: {
    revealEverything?: boolean
  }
  i: number
  j: number
  visible: boolean
  has: RuntimeEntity | null
  solid: boolean
  corpses: Set<RuntimeEntity>
}

export function updateCellChildVisibility(cell: VisibleCellHost, instance: RuntimeEntity): void {
  if (!updateInstanceRenderVisibility(instance) && instance.isDestroyed && cell.has === instance) {
    cell.has = null
    cell.solid = false
  }
}

export function updateCellVisible(cell: VisibleCellHost): void {
  const { player } = cell.context
  const map = cell.map ?? cell.context.map
  if (!player?.views) return
  if (!map?.revealEverything && !player.views.isViewed(cell.i, cell.j)) return
  cell.visible = true
  if (cell.has) updateCellChildVisibility(cell, cell.has)
  for (const corpse of cell.corpses) updateCellChildVisibility(cell, corpse)
}

export function placeCellEntity(cell: VisibleCellHost, entity: RuntimeEntity): void {
  cell.has = entity
  updateCellVisible(cell)
}
