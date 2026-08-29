import { BUILDING_TYPES } from '../../constants'
import type { BuildingEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../types/map'

export type BuildingInteriorDecorationSpec = {
  key: string
  offsetI: number
  offsetJ: number
  type: string
}

export function getBuildingInteriorDecorationLayout(
  building: Pick<BuildingEntity, 'type'>,
  options: { includeFireCamp?: boolean } = {}
): BuildingInteriorDecorationSpec[] {
  const { includeFireCamp = true } = options
  const base = includeFireCamp ? [{ key: 'firecamp-center', type: BUILDING_TYPES.fireCamp, offsetI: 0, offsetJ: 0 }] : []
  if (building.type === BUILDING_TYPES.house) {
    return [...base, { key: 'jar-se', type: BUILDING_TYPES.campJarSmall, offsetI: 2, offsetJ: 1 }]
  }
  return [
    ...base,
    { key: 'crate-nw', type: BUILDING_TYPES.campCrate, offsetI: -3, offsetJ: -2 },
    { key: 'rock-se', type: BUILDING_TYPES.campRockPile, offsetI: 3, offsetJ: 2 },
  ]
}

export function interiorCellKey(cell: Pick<RuntimeCell, 'i' | 'j'>): string {
  return `${cell.i}:${cell.j}`
}

function isInteriorDecorationFloorCell(cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  return Boolean(cell && !cell.has && !cell.solid && !cell.border && cell.category !== 'Water' && !cell.terrainHidden)
}

export function findInteriorDecorationCell(
  map: Pick<RuntimeMap, 'grid' | 'size'> & { randomItem?: RuntimeMap['randomItem'] },
  preferred: Pick<RuntimeCell, 'i' | 'j'>,
  options: {
    blockedCells?: Set<string>
    canUseCell?: (cell: RuntimeCell | null | undefined) => cell is RuntimeCell
    searchRadius?: number
  } = {}
): RuntimeCell | null {
  const {
    blockedCells = new Set<string>(),
    canUseCell = isInteriorDecorationFloorCell,
    searchRadius = Math.max(3, Math.floor(map.size / 2)),
  } = options
  const isAvailable = (cell: RuntimeCell | null | undefined): cell is RuntimeCell =>
    Boolean(cell && !blockedCells.has(interiorCellKey(cell)) && canUseCell(cell))

  const directCell = map.grid[preferred.i]?.[preferred.j]
  if (isAvailable(directCell)) return directCell

  for (let radius = 1; radius <= searchRadius; radius += 1) {
    const cells: RuntimeCell[] = []
    for (let i = preferred.i - radius; i <= preferred.i + radius; i += 1) {
      for (let j = preferred.j - radius; j <= preferred.j + radius; j += 1) {
        const cell = map.grid[i]?.[j]
        if (isAvailable(cell)) cells.push(cell)
      }
    }
    if (cells.length) return map.randomItem?.(cells) ?? cells[0]
  }
  return null
}
