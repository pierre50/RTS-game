import { Resource } from '../Resource'
import {
  getBuildingFootprintCells,
  getBuildingFootprintRadius,
  getPlainCellsAroundPoint,
} from '../../lib'
import type { GameContextLike } from '../../types/context'
import type { ResourceEntity } from '../../types/entities'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import type { MapGenerationMap } from './MapGenerationTypes'

export const PORTAL_RESOURCE_TYPE = 'Portal'
const PORTAL_FOOTPRINT_SIZE = 3

function runtimeContext(context: MapGenerationMap['context']): GameContextLike {
  if (!context.app || !context.gamebox || !context.map || !context.scheduler) {
    throw new Error('Map generation requires a runtime context')
  }
  return context as GameContextLike
}

function isValidPortalFootprint(map: MapGenerationMap, i: number, j: number, radius: number): boolean {
  const centerZ = map.grid[i]?.[j]?.z
  if (centerZ === undefined) return false
  const cells = getPlainCellsAroundPoint(i, j, map.grid, radius)
  if (cells.length !== (radius * 2 + 1) ** 2) return false
  return cells.every(
    cell => !cell.solid && !cell.has && cell.category !== 'Water' && !cell.border && !cell.inclined && cell.z === centerZ
  )
}

function findPortalPosition(map: MapGenerationMap): GridPosition | null {
  const footprintRadius = getBuildingFootprintRadius(PORTAL_FOOTPRINT_SIZE)
  const center = Math.round(map.size / 2)
  const border = 10
  const playerSafeDistanceSq = 15 ** 2

  for (const clearance of [3, 2, 1, 0]) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const i = attempt === 0 ? center : map.randomRange(border, map.size - border)
      const j = attempt === 0 ? center : map.randomRange(border, map.size - border)
      if (!isValidPortalFootprint(map, i, j, footprintRadius + clearance)) continue
      const tooCloseToPlayer = map.playersPos.some(
        pos => pos && (pos.i - i) ** 2 + (pos.j - j) ** 2 < playerSafeDistanceSq
      )
      if (tooCloseToPlayer) continue
      return { i, j }
    }
  }

  return null
}

export function reservePortalFootprint(portal: ResourceEntity, grid: RuntimeCell[][]): void {
  getBuildingFootprintCells(portal.i, portal.j, grid, portal.size || PORTAL_FOOTPRINT_SIZE, cell => {
    cell.solid = true
    cell.has = portal
    return true
  })
}

export function placePortal(map: MapGenerationMap): void {
  if ([...map.resources].some(resource => resource.type === PORTAL_RESOURCE_TYPE)) return

  const position = findPortalPosition(map)
  if (!position) return

  const context = runtimeContext(map.context)
  const portal = map.addChild(
    new Resource({ i: position.i, j: position.j, type: PORTAL_RESOURCE_TYPE, size: PORTAL_FOOTPRINT_SIZE }, context)
  )
  map.resources.add(portal)
  reservePortalFootprint(portal, map.grid)
}
