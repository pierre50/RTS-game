import { BUILDING_TYPES } from '../../app/constants'
import {
  findInteriorDecorationCell,
  getBuildingInteriorDecorationLayout,
  interiorCellKey,
} from '../../app/lib/buildings/interiorDecorations'
import { canPlaceBuildingAt } from '../../app/lib/grid/placement'
import {
  getInteriorRoomCenter,
  isNearInteriorDoor,
  preservesInteriorPassages,
} from '../../app/lib/buildings/interiorFurniturePlacement'
import type { GameContextLike } from '../../app/types/context'
import type { RuntimeCell } from '../../app/types/map'
import type { BuildingInteriorRuntimeSpace } from './BuildingInteriorSpaceTypes'

function findInteriorDefaultBuildingCell(
  context: GameContextLike,
  space: BuildingInteriorRuntimeSpace,
  type: string,
  preferred: { i: number; j: number },
  blockedCells: Set<string>,
  options: { allowBorderPlacement?: boolean; searchRadius?: number } = {}
): RuntimeCell | null {
  const config = space.building.owner?.config?.buildings?.[type]
  if (!config) return null
  const placementConfig = { ...config, type }
  const placementSize = Number(config.size ?? 1)
  const canUseCell = (cell: RuntimeCell | null | undefined): cell is RuntimeCell => {
    if (!cell) return false
    if (cell.terrainHidden || isNearInteriorDoor(cell, [space.entryCell, space.exitCell])) return false
    if (!preservesInteriorPassages(space.grid, cell)) return false
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
    { blockedCells, canUseCell, searchRadius: options.searchRadius ?? 2, mirrored: space.building.placementMirrored }
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
  const offsetI = space.building.placementMirrored ? item.offsetJ : item.offsetI
  const offsetJ = space.building.placementMirrored ? item.offsetI : item.offsetJ
  if (item.placement === 'oppositeExitInset') {
    const cell = getOppositeExitInsetCell(space, center)
    if (cell) return cell
  }
  if (item.placement === 'oppositeExitBorder' && space.exitCell) {
    const directionI = Math.sign(center.i - space.exitCell.i)
    const directionJ = Math.sign(center.j - space.exitCell.j)
    if (directionI === 0 && directionJ === 0) return { i: center.i + offsetI, j: center.j + offsetJ }
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
  return { i: center.i + offsetI, j: center.j + offsetJ }
}

export function ensureInteriorDefaultBuildings(context: GameContextLike, space: BuildingInteriorRuntimeSpace): void {
  if (space.defaultBuildingsPlaced) return
  const saved = space.building.interiorBuildings
  if (saved) {
    const owner = space.building.owner
    if (!owner) throw new Error('Cannot restore building interior without an owner')
    for (const building of saved) {
      // Retire the old automatically generated cave props, keeping player-placed contents.
      if (space.building.type === BUILDING_TYPES.cave && building.label?.startsWith(`${space.id}:default:`)) continue
      if (!space.grid[building.i]?.[building.j]) {
        throw new Error(
          `Cannot restore interior building ${building.label ?? building.type} on missing interior cell (${building.i}, ${building.j})`
        )
      }
      const contentOwner = building.interiorOwner
        ? context.players.find(
            player => (player.label || player.factionId || player.name || 'owner') === building.interiorOwner
          )
        : owner
      if (!contentOwner) throw new Error(`Missing interior owner: ${building.interiorOwner}`)
      let position = { i: building.i, j: building.j }
      const savedCell = space.grid[building.i]?.[building.j]
      if (
        savedCell.terrainHidden ||
        savedCell.solid ||
        savedCell.has ||
        isNearInteriorDoor(savedCell, [space.exitCell])
      ) {
        // A saved prop may lie beyond the new walls or in the relocated doorway.
        const relocated = findInteriorDefaultBuildingCell(context, space, building.type, position, new Set(), {
          allowBorderPlacement: true,
          searchRadius: space.size,
        })
        if (!relocated)
          throw new Error(`Cannot find room for saved interior building ${building.label ?? building.type}`)
        position = { i: relocated.i, j: relocated.j }
      }
      contentOwner.createBuilding({
        ...building,
        ...position,
        // Older saves mirrored the cells but omitted the furniture's visual orientation.
        // Recompute defaults from the parent; preserve manually placed furniture.
        ...(building.label?.startsWith(`${space.id}:default:`)
          ? { placementMirrored: Boolean(space.building.placementMirrored) }
          : {}),
        spaceId: space.id,
        skipBuiltEffects: true,
        deferTrainingResume: true,
      })
    }
    delete space.building.interiorBuildings
    space.defaultBuildingsPlaced = true
    return
  }
  if (space.building.type === BUILDING_TYPES.cave) {
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
    let cell = findInteriorDefaultBuildingCell(context, space, item.type, preferred, blockedCells, item)
    // Older/custom blueprints can be smaller than the montage; never lose their storage chest.
    if (!cell && item.key === 'storage-chest') {
      const fallback = getOppositeExitInsetCell(space, center)
      if (fallback) cell = findInteriorDefaultBuildingCell(context, space, item.type, fallback, blockedCells, item)
    }
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
      placementMirrored: Boolean(space.building.placementMirrored),
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
