import {
  getEntityMapSpace,
  getBuildingFootprintCells,
  getEntityCell,
  spawnSpriteFragmentBurst,
  type SpriteFragmentBurstGroundTarget,
} from '../../lib'
import { RESOURCE_TYPES, WILDGRASS_RESOURCE_TYPES } from '../../constants'
import type { Resource } from '../Resource'
import type { RuntimeCell } from '../../types/map'

function isResourceCellVisible(resource: Resource): boolean {
  const { map, player } = resource.context
  if (map.revealEverything || map.revealTerrain) return true
  const views = player?.views
  if (!views?.isVisible) return true
  const check = () => views.isVisible(resource.i, resource.j)
  return views.withSpace?.(resource.spaceId, check) ?? check()
}

export function resourceFootprintCells(resource: Resource): RuntimeCell[] {
  const { map } = resource.context
  const space = getEntityMapSpace(resource, map)
  const grid = space?.grid ?? map.grid
  const cells = getBuildingFootprintCells(resource.i, resource.j, grid, resource.size ?? 1)
  if (cells.length) return cells
  const cell = getEntityCell(resource, map)
  return cell ? [cell] : []
}

export function resourceFragmentGroundTargets(resource: Resource): SpriteFragmentBurstGroundTarget[] {
  return resource.getSolidFootprintCells().map(cell => ({
    x: cell.x,
    y: cell.y,
    ...(cell.zIndex !== undefined ? { zIndex: cell.zIndex } : {}),
  }))
}

export function spawnResourceTreeFragments(resource: Resource): void {
  spawnSpriteFragmentBurst({
    context: resource.context,
    host: resource,
    sprite: resource.sprite,
    layer: resource.parent,
    sourceVisibility: () => isResourceCellVisible(resource),
    fragmentSize: 12,
    maxFragments: 18,
    durationMs: 940,
    gravity: 0.0021,
    minSpeed: 0.012,
    maxSpeed: 0.07,
    upwardVelocity: 0.035,
    settleToBottom: true,
    lockX: true,
    groundTargets: resource.getFragmentGroundTargets(),
    settleSpread: 22,
    settleStrength: 0.00007,
    groundBounce: 0.12,
  })
}

export function spawnDepletedResourceFragments(resource: Resource): boolean {
  const isWildgrass = WILDGRASS_RESOURCE_TYPES.has(resource.type)
  if (resource.type === RESOURCE_TYPES.berrybush || resource.type === RESOURCE_TYPES.wheat || isWildgrass) {
    spawnSpriteFragmentBurst({
      context: resource.context,
      host: resource,
      sprite: resource.sprite,
      layer: resource.parent,
      fragmentSize: isWildgrass ? 8 : 12,
      maxFragments: isWildgrass ? 8 : 12,
      sourceVisibility: () => isResourceCellVisible(resource),
      durationMs: isWildgrass ? 620 : 760,
      gravity: 0.0017,
      minSpeed: 0.006,
      maxSpeed: 0.035,
      upwardVelocity: 0.018,
      settleToBottom: true,
      lockX: true,
      groundTargets: resource.getFragmentGroundTargets(),
      groundBounce: 0.08,
    })
    return true
  }

  if (
    resource.type === RESOURCE_TYPES.stone ||
    resource.type === RESOURCE_TYPES.gold ||
    resource.type === RESOURCE_TYPES.copper ||
    resource.type === RESOURCE_TYPES.iron
  ) {
    spawnSpriteFragmentBurst({
      context: resource.context,
      host: resource,
      sprite: resource.sprite,
      layer: resource.parent,
      fragmentSize: 12,
      maxFragments: 14,
      sourceVisibility: () => isResourceCellVisible(resource),
      durationMs: 880,
      gravity: 0.0025,
      minSpeed: 0.004,
      maxSpeed: 0.026,
      upwardVelocity: 0.01,
      settleToBottom: true,
      lockX: true,
      groundTargets: resource.getFragmentGroundTargets(),
      groundBounce: 0.05,
    })
    return true
  }
  return false
}
