import { BUILDING_TYPES } from '../../app/constants'
import {
  findInteriorDecorationCell,
  getBuildingInteriorDecorationLayout,
  interiorCellKey,
} from '../../app/lib/buildings/interiorDecorations'
import { canPlaceBuildingAt } from '../../app/lib/grid/placement'
import type { GameContextLike } from '../../app/types/context'
import type { RuntimeCell } from '../../app/types/map'
import type { BuildingInteriorRuntimeSpace } from './BuildingInteriorSpaceTypes'

function findInteriorDefaultBuildingCell(
  context: GameContextLike,
  space: BuildingInteriorRuntimeSpace,
  type: string,
  preferred: { i: number; j: number },
  blockedCells: Set<string>,
  options: { allowBorderPlacement?: boolean } = {}
): RuntimeCell | null {
  const config = space.building.owner?.config?.buildings?.[type]
  if (!config) return null
  const placementConfig = { ...config, type }
  const placementSize = Number(config.size ?? 1)
  const canUseCell = (cell: RuntimeCell | null | undefined): cell is RuntimeCell => {
    if (!cell) return false
    if (!options.allowBorderPlacement) return canPlaceBuildingAt(space.grid, cell.i, cell.j, placementConfig)
    if (Math.floor(placementSize) !== 1) return canPlaceBuildingAt(space.grid, cell.i, cell.j, placementConfig)
    return (
      cell.category !== 'Water' &&
      !cell.waterBorder &&
      !cell.solid &&
      !cell.inclined &&
      !cell.has &&
      (cell.border || canPlaceBuildingAt(space.grid, cell.i, cell.j, placementConfig))
    )
  }

  return findInteriorDecorationCell(
    { grid: space.grid, randomItem: context.map.randomItem.bind(context.map), size: space.size },
    preferred,
    { blockedCells, canUseCell }
  )
}

function isUsableInteriorDecorationCell(cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  return Boolean(cell && !cell.terrainHidden && cell.category !== 'Water' && !cell.waterBorder)
}

function getOppositeExitInsetCell(
  space: BuildingInteriorRuntimeSpace,
  center: { i: number; j: number }
): RuntimeCell | null {
  if (!space.exitCell) return null
  const exitX = space.exitCell.i - space.exitCell.j
  const exitY = space.exitCell.i + space.exitCell.j
  const centerX = center.i - center.j
  const centerY = center.i + center.j
  const awayX = centerX - exitX
  const awayY = centerY - exitY
  if (awayX === 0 && awayY === 0) return null

  const cells = space.walkableCells.filter(cell => {
    if (!isUsableInteriorDecorationCell(cell) || cell.border) return false
    const cellX = cell.i - cell.j
    const cellY = cell.i + cell.j
    const matchesHorizontalSide = awayX === 0 || (awayX > 0 ? cellX >= centerX : cellX <= centerX)
    const matchesVerticalSide = awayY === 0 || (awayY > 0 ? cellY >= centerY : cellY <= centerY)
    return matchesHorizontalSide && matchesVerticalSide
  })
  const candidates = cells.length ? cells : space.walkableCells
  let best: RuntimeCell | null = null
  let bestScore = -Infinity
  for (const cell of candidates) {
    if (!isUsableInteriorDecorationCell(cell) || cell.border) continue
    const cellX = cell.i - cell.j
    const cellY = cell.i + cell.j
    const score = (cellX - centerX) * awayX + (cellY - centerY) * awayY
    if (score > bestScore) {
      best = cell
      bestScore = score
    }
  }
  return best
}

function getInteriorDefaultBuildingPreferredCell(
  space: BuildingInteriorRuntimeSpace,
  item: ReturnType<typeof getBuildingInteriorDecorationLayout>[number],
  center: { i: number; j: number }
): { i: number; j: number } {
  if (item.placement === 'oppositeExitInset') {
    const cell = getOppositeExitInsetCell(space, center)
    if (cell) return cell
  }
  if (item.placement === 'oppositeExitBorder' && space.exitCell) {
    const directionI = Math.sign(center.i - space.exitCell.i)
    const directionJ = Math.sign(center.j - space.exitCell.j)
    if (directionI === 0 && directionJ === 0) return { i: center.i + item.offsetI, j: center.j + item.offsetJ }
    let i = center.i
    let j = center.j
    let borderCell: RuntimeCell | null = null
    while (i >= 0 && i <= space.size && j >= 0 && j <= space.size) {
      const cell = space.grid[i]?.[j]
      if (cell?.border) borderCell = cell
      i += directionI
      j += directionJ
    }
    if (borderCell) return borderCell
  }
  return { i: center.i + item.offsetI, j: center.j + item.offsetJ }
}

function getInteriorRoomCenter(space: BuildingInteriorRuntimeSpace): { i: number; j: number } {
  const cells = space.walkableCells.length ? space.walkableCells : space.sleepCells
  const first = cells[0]
  if (!first) return { i: Math.round(space.size / 2), j: Math.round(space.size / 2) }
  const total = cells.reduce(
    (sum, cell) => ({
      i: sum.i + cell.i,
      j: sum.j + cell.j,
    }),
    { i: 0, j: 0 }
  )
  const center = {
    i: total.i / cells.length,
    j: total.j / cells.length,
  }
  const nearest = cells.reduce((best, cell) => {
    const bestDistance = (best.i - center.i) ** 2 + (best.j - center.j) ** 2
    const cellDistance = (cell.i - center.i) ** 2 + (cell.j - center.j) ** 2
    return cellDistance < bestDistance ? cell : best
  }, first)
  return { i: nearest.i, j: nearest.j }
}

export function ensureInteriorDefaultBuildings(context: GameContextLike, space: BuildingInteriorRuntimeSpace): void {
  if (space.defaultBuildingsPlaced) return
  if (space.building.type === BUILDING_TYPES.stable) {
    space.defaultBuildingsPlaced = true
    return
  }
  const owner = space.building.owner
  if (!owner?.createBuilding) return
  const center = getInteriorRoomCenter(space)
  const blockedCells = new Set<string>()
  if (space.entryCell) blockedCells.add(interiorCellKey(space.entryCell))

  for (const item of getBuildingInteriorDecorationLayout(space.building)) {
    const label = `${space.id}:default:${item.key}`
    if (owner.buildings.some(building => building.label === label && !building.isDestroyed)) continue
    const preferred = getInteriorDefaultBuildingPreferredCell(space, item, center)
    const cell = findInteriorDefaultBuildingCell(context, space, item.type, preferred, blockedCells, item)
    if (!cell) continue
    const buildingOptions = { ...item.buildingOptions }
    const pendingResources = item.key === 'storage-chest' ? (space.building.inventory?.resources ?? {}) : null
    if (pendingResources != null) {
      buildingOptions.inventory = {
        ...(buildingOptions.inventory ?? {}),
        resources: { ...pendingResources },
      }
    }
    const defaultBuilding = owner.createBuilding({
      ...buildingOptions,
      i: cell.i,
      j: cell.j,
      label,
      spaceId: space.id,
      type: item.type,
      isBuilt: true,
      skipBuiltEffects: true,
    })
    if (defaultBuilding && pendingResources != null) {
      space.building.inventory = space.building.inventory ?? {}
      space.building.inventory.resources = {}
    }
    blockedCells.add(interiorCellKey(cell))
  }
  space.defaultBuildingsPlaced = true
}
