import { instancesDistance } from '../maths'
import { LABEL_TYPES } from '../../constants'
import { getPlainCellsAroundPoint, getRandomZoneInGridWithCondition, getZoneInGridWithCondition } from './cells'

export function clearCellTerrainSet(cell) {
  if (!cell) return

  const set = cell.terrainSet || cell.getChildByLabel?.(LABEL_TYPES.set)
  if (!set) return

  cell.removeChild?.(set)
  set.parent?.removeChild(set)
  set.destroy?.()
  cell.terrainSet = null
  cell.context?.map?.terrainChunkManager?.invalidateCell(cell)
}

function createPlacementZone(instance, maxSpace) {
  return {
    minX: Math.max(instance.i - maxSpace, 0),
    minY: Math.max(instance.j - maxSpace, 0),
    maxX: Math.min(instance.i + maxSpace, instance.parent.size - 1),
    maxY: Math.min(instance.j + maxSpace, instance.parent.size - 1),
  }
}

function createPositionCondition(instance, minSpace, maxSpace, allowInclined, extraCondition) {
  return cell => {
    const distance = instancesDistance(instance, cell, true)
    return (
      distance >= minSpace &&
      distance <= maxSpace &&
      !cell.solid &&
      !cell.border &&
      (allowInclined || !cell.inclined) &&
      (!extraCondition || extraCondition(cell))
    )
  }
}

function getBuildingFootprintCells(grid, i, j, building) {
  const dist = building.size === 3 ? 1 : 0
  const cells = getPlainCellsAroundPoint(i, j, grid, dist)
  const expectedCells = dist === 0 ? 1 : (dist * 2 + 1) ** 2
  return { cells, expectedCells }
}

function canPlaceWaterBuilding(cells, requireVisible) {
  let waterBorderedCells = 0
  let waterCells = 0

  for (const cell of cells) {
    if (cell.inclined || cell.solid || (requireVisible && !cell.visible)) return false
    if (cell.waterBorder) waterBorderedCells++
    else if (cell.category === 'Water') waterCells++
  }

  return waterBorderedCells >= 2 || waterCells >= 4
}

function canPlaceGroundBuilding(cells, requireVisible) {
  const groundLevel = cells[0].z
  return cells.every(
    cell =>
      cell.category !== 'Water' &&
      !cell.waterBorder &&
      !cell.solid &&
      !cell.inclined &&
      !cell.border &&
      cell.z === groundLevel &&
      (!requireVisible || cell.visible)
  )
}

export function getPositionInGridAroundInstance(
  instance,
  grid,
  space,
  size,
  allowInclined = false,
  extraCondition,
  random = true
) {
  const [minSpace, maxSpace] = space
  const zone = createPlacementZone(instance, maxSpace)
  const cellCondition = createPositionCondition(instance, minSpace, maxSpace, allowInclined, extraCondition)

  return random
    ? getRandomZoneInGridWithCondition(zone, grid, size, cellCondition) || null
    : getZoneInGridWithCondition(zone, grid, size, cellCondition) || null
}

export function canPlaceBuildingAt(grid, i, j, building, { requireVisible = false } = {}) {
  const { cells, expectedCells } = getBuildingFootprintCells(grid, i, j, building)
  if (cells.length !== expectedCells) return false

  return building.buildOnWater
    ? canPlaceWaterBuilding(cells, requireVisible)
    : canPlaceGroundBuilding(cells, requireVisible)
}
