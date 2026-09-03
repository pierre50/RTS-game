import type { RuntimeEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import { getBuildingFootprintCells } from '../grid/cells'
import { getEntityCell, getEntityMapSpace } from '../mapSpaces'
import type { SpriteFragmentBurstGroundTarget } from './spriteFragmentBurst'

function cellToFragmentGroundTarget(cell: RuntimeCell): SpriteFragmentBurstGroundTarget {
  return {
    x: cell.x,
    y: cell.y,
    zIndex: cell.zIndex,
  }
}

export function getEntityFragmentGroundTargets(entity: RuntimeEntity): SpriteFragmentBurstGroundTarget[] {
  const map = entity.context?.map
  if (!map) return []

  const space = getEntityMapSpace(entity, map)
  const grid = space?.grid ?? map.grid
  const footprintCells = getBuildingFootprintCells(
    entity.i,
    entity.j,
    grid,
    entity.size ?? 1,
    cell => cell.has === entity
  )
  if (footprintCells.length) return footprintCells.map(cellToFragmentGroundTarget)

  const cell = getEntityCell(entity, map)
  return cell?.has === entity ? [cellToFragmentGroundTarget(cell)] : []
}
