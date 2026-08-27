import type { UnitEntity } from '../../types/entities'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import { sameGridCell } from '../grid/interactionCells'

type InteriorExitRuntimeMap = RuntimeMap & {
  interiorExits?: Array<GridPosition | null>
}

function isInteriorFloorCell(cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  return Boolean(cell && !cell.terrainHidden && cell.category !== 'Water')
}

function cellAt(map: RuntimeMap, position: GridPosition | null | undefined): RuntimeCell | null {
  if (!position || !Number.isFinite(position.i) || !Number.isFinite(position.j)) return null
  return map.grid[position.i]?.[position.j] ?? null
}

export function getInteriorExitCell(map: RuntimeMap | null | undefined): RuntimeCell | null {
  if (!map || map.mapType !== 'interior') return null

  const configuredExit = (map as InteriorExitRuntimeMap).interiorExits?.find(exit => Boolean(exit))
  const configuredCell = cellAt(map, configuredExit)
  if (isInteriorFloorCell(configuredCell)) return configuredCell

  const centerI = Math.round(map.size / 2)
  let best: RuntimeCell | null = null
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i]?.[j]
      if (!isInteriorFloorCell(cell)) continue
      if (!best || j > best.j || (j === best.j && Math.abs(i - centerI) < Math.abs(best.i - centerI))) {
        best = cell
      }
    }
  }

  return best
}

export function isHeroOnInteriorExitCell(hero: UnitEntity | null | undefined): boolean {
  const map = hero?.context?.map
  const exitCell = getInteriorExitCell(map)
  if (!hero || !exitCell) return false
  return sameGridCell(hero, exitCell)
}
