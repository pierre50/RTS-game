import {
  BIOME_TREE_PLAYER_SAFE_DIST,
  RESOURCE_TYPES,
  WATER_BORDER_PLACEMENT_CLEARANCE,
} from '../../../constants'
import { hasWaterBorderWithin } from '../../../lib'
import type { ContainerChild } from 'pixi.js'
import type { ResourceEntity } from '../../../types/entities'
import type { GridPosition } from '../../../types/grid'
import type { RuntimeCell } from '../../../types/map'
import { Resource } from '../../Resource'
import { hasSpacedResourceAround } from './MapResourceSpacing'
import { NEUTRAL_RESOURCE_QUANTITY_RANGES, rollResourceQuantity } from './ResourceQuantityRanges'

type ResourceCenter = GridPosition

type ForestResourceMap = {
  context: object
  grid: RuntimeCell[][]
  size: number
  resources: Set<ResourceEntity>
  random(): number
  addChild<T extends ContainerChild>(child: T): T
}

function isForestCellCandidate(grid: RuntimeCell[][], i: number, j: number): boolean {
  const cell = grid[i]?.[j]
  return Boolean(
    cell &&
      !cell.solid &&
      cell.category !== 'Water' &&
      !hasWaterBorderWithin(grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE) &&
      cell.type !== 'Border' &&
      cell.type !== 'Dirt' &&
      cell.type !== 'Snow' &&
      !cell.inclined
  )
}

function isSoloTreeCandidate(grid: RuntimeCell[][], i: number, j: number): boolean {
  const cell = grid[i]?.[j]
  return Boolean(
    cell &&
      cell.category !== 'Water' &&
      !hasWaterBorderWithin(grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE) &&
      !cell.solid &&
      !cell.inclined &&
      cell.type !== 'Dirt' &&
      cell.type !== 'Snow'
  )
}

function createTree(map: ForestResourceMap, i: number, j: number): ResourceEntity {
  const rolledQuantity = rollResourceQuantity(() => map.random(), NEUTRAL_RESOURCE_QUANTITY_RANGES[RESOURCE_TYPES.tree])
  return map.addChild(
    new Resource(
      {
        i,
        j,
        type: RESOURCE_TYPES.tree,
        isNaturalResource: true,
        quantity: rolledQuantity,
        totalQuantity: rolledQuantity,
      },
      map.context as ConstructorParameters<typeof Resource>[1]
    )
  )
}

function distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
  return (x1 - x2) ** 2 + (y1 - y2) ** 2
}

function createCircle(
  map: ForestResourceMap,
  centerI: number,
  centerJ: number,
  radius: number,
  density: number = 0.7,
  edgeNoise: number = 0
): ResourceCenter[] {
  const { grid } = map
  const circleCells: ResourceCenter[] = []
  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      const noise = map.random() * edgeNoise - edgeNoise / 2
      const effectiveRadius = radius - noise
      if (effectiveRadius <= 0 || x * x + y * y > effectiveRadius * effectiveRadius) continue
      const cellI = centerI + x
      const cellJ = centerJ + y
      if (isForestCellCandidate(grid, cellI, cellJ) && map.random() < density) {
        circleCells.push({ i: cellI, j: cellJ })
      }
    }
  }
  return circleCells
}

function findForestCenterNearPlayer(
  map: ForestResourceMap,
  player: GridPosition,
  forestRange: number,
  safeDistanceSq: number,
  maxAttempts: number
): ResourceCenter | null {
  const { grid } = map
  const gridWidth = grid.length
  const gridHeight = grid[0].length

  for (let tries = 0; tries <= maxAttempts; tries++) {
    const i = player.i + Math.floor(map.random() * forestRange * 2 - forestRange)
    const j = player.j + Math.floor(map.random() * forestRange * 2 - forestRange)
    if (
      distanceSquared(i, j, player.i, player.j) >= safeDistanceSq &&
      i >= 0 &&
      i < gridWidth &&
      j >= 0 &&
      j < gridHeight &&
      isForestCellCandidate(grid, i, j)
    ) {
      return { i, j }
    }
  }

  return null
}

function removePathCells(forestCells: ResourceCenter[], pathCells: Set<string>): ResourceCenter[] {
  return forestCells.filter(cell => !pathCells.has(`${cell.i},${cell.j}`))
}

function pickRandomCells(cells: ResourceCenter[], count: number, random: () => number): ResourceCenter[] {
  const cellsToPlace: ResourceCenter[] = []
  for (let i = 0; i < count; i++) {
    if (cells.length === 0) break
    const itemIndex = Math.floor(random() * cells.length)
    const cell = cells[itemIndex]
    cellsToPlace.push(cell)
    cells.splice(itemIndex, 1)
  }
  return cellsToPlace
}

export function generateForestAroundPlayer(
  map: ForestResourceMap,
  player: GridPosition,
  treeCount: number,
  clusterCount: number = 12,
  minClusterRadius: number = 5,
  maxClusterRadius: number = 10,
  safeDistance: number = BIOME_TREE_PLAYER_SAFE_DIST,
  clearingProbability: number = 0.6
): void {
  const { grid } = map
  let forestCells: ResourceCenter[] = []
  const pathCells = new Set<string>()
  const forestRange = Math.max(30, Math.floor(map.size * 0.4))
  const safeDistanceSq = safeDistance ** 2

  for (let cluster = 0; cluster < clusterCount; cluster++) {
    const center = findForestCenterNearPlayer(map, player, forestRange, safeDistanceSq, 100)
    if (!center) continue
    const clusterRadius = Math.floor(map.random() * (maxClusterRadius - minClusterRadius + 1)) + minClusterRadius
    const clusterDensity = map.random() * 0.5 + 0.5
    const edgeNoise = map.random() * 2
    forestCells.push(...createCircle(map, center.i, center.j, clusterRadius, clusterDensity, edgeNoise))
  }

  const scatteredTreeCount = Math.floor(treeCount * 0.2)
  for (let i = 0; i < scatteredTreeCount; i++) {
    const center = findForestCenterNearPlayer(map, player, forestRange, safeDistanceSq, 50)
    if (center && isSoloTreeCandidate(grid, center.i, center.j)) forestCells.push(center)
  }

  for (let clearing = 0; clearing < clusterCount; clearing++) {
    if (map.random() >= clearingProbability) continue
    const center = findForestCenterNearPlayer(map, player, forestRange, safeDistanceSq, 100)
    if (!center) continue
    const clearingRadius = Math.floor(map.random() * 8) + 5
    const edgeNoise = map.random() * 1.5
    const clearingCells = createCircle(map, center.i, center.j, clearingRadius, 0, edgeNoise)
    const clearingSet = new Set(clearingCells.map(c => `${c.i},${c.j}`))
    forestCells = forestCells.filter(c => !clearingSet.has(`${c.i},${c.j}`))
  }

  const pathLength = 20
  const pathDirection = map.random() > 0.5 ? 1 : -1
  for (let step = 0; step < pathLength; step++) {
    const ni = player.i + step * pathDirection
    const nj = player.j + step
    if (
      ni >= 0 &&
      ni < grid.length &&
      nj >= 0 &&
      nj < grid[0].length &&
      distanceSquared(ni, nj, player.i, player.j) >= safeDistanceSq
    ) {
      const randOffsetX = map.random() > 0.5 ? 1 : -1
      const randOffsetY = map.random() > 0.5 ? 1 : -1
      pathCells.add(`${ni + randOffsetX},${nj + randOffsetY}`)
    }
  }

  const cellsToPlace = pickRandomCells(removePathCells(forestCells, pathCells), treeCount, () => map.random())
  for (const cell of cellsToPlace) {
    if (
      grid[cell.i][cell.j].category !== 'Water' &&
      !grid[cell.i][cell.j].waterBorder &&
      !hasWaterBorderWithin(grid, cell.i, cell.j, WATER_BORDER_PLACEMENT_CLEARANCE) &&
      !grid[cell.i][cell.j].solid &&
      !grid[cell.i][cell.j].inclined &&
      !hasSpacedResourceAround(grid, cell.i, cell.j)
    ) {
      map.resources.add(createTree(map, cell.i, cell.j))
    }
  }
}
