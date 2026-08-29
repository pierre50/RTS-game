import type { UnitEntity } from '../../types/entities'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import { sameGridCell } from '../grid/interactionCells'
import { getActiveMapSpace, getEntityMapSpace } from '../mapSpaces'

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
  if (!map) return null
  const activeSpace = getActiveMapSpace(map)
  if (activeSpace?.kind === 'interior') {
    if (isInteriorFloorCell(activeSpace.exitCell)) return activeSpace.exitCell
    return findBestInteriorExitCell(activeSpace.grid, activeSpace.size, activeSpace.entryCell)
  }
  if (map.mapType !== 'interior') return null

  const configuredExit = (map as InteriorExitRuntimeMap).interiorExits?.find(exit => Boolean(exit))
  const configuredCell = cellAt(map, configuredExit)
  if (isInteriorFloorCell(configuredCell)) return configuredCell

  return findBestInteriorExitCell(map.grid, map.size)
}

function findBestInteriorExitCell(
  grid: RuntimeMap['grid'],
  size: number,
  preferredCell: RuntimeCell | null | undefined = null
): RuntimeCell | null {
  if (isInteriorFloorCell(preferredCell)) return preferredCell
  const centerI = Math.round(size / 2)
  let best: RuntimeCell | null = null
  for (let i = 0; i <= size; i++) {
    for (let j = 0; j <= size; j++) {
      const cell = grid[i]?.[j]
      if (!isInteriorFloorCell(cell)) continue
      if (!best || j > best.j || (j === best.j && Math.abs(i - centerI) < Math.abs(best.i - centerI))) {
        best = cell
      }
    }
  }

  return best
}

export function isHeroOnInteriorExitCell(hero: UnitEntity | null | undefined): boolean {
  if (!hero) return false
  const map = hero.context?.map
  const space = getEntityMapSpace(hero, map)
  const exitCell = space?.kind === 'interior' ? space.exitCell : getInteriorExitCell(map)
  if (!exitCell) return false
  return sameGridCell(hero, exitCell)
}
