import { RESOURCE_TYPES, WATER_BORDER_PLACEMENT_CLEARANCE } from '../../../constants'
import { hasWaterBorderWithin } from '../../../lib'
import { definedProperties } from '../../../lib/definedProperties'
import type { GridPosition } from '../../../types/grid'
import { createResource } from './MapResourceCreation'
import type { MapResources, ResourceCenter, ResourcePlacementOptions, ResourceType } from './MapResources'
import { hasSpacedResourceAround } from './MapResourceSpacing'
import { NEUTRAL_RESOURCE_QUANTITY_RANGES, rollResourceQuantity } from './ResourceQuantityRanges'

function berryBushTextureName(frame: number): string {
  return `${String(frame).padStart(3, '0')}_resources/berrybush`
}

export function findNeutralResourceCenter(
  runtime: MapResources,
  playersPos: GridPosition[],
  placedCenters: GridPosition[],
  playerSafeDistance: number,
  minNeutralDistance: number
): GridPosition | null {
  const border = 10
  const playerSafeDistanceSq = playerSafeDistance ** 2
  const minNeutralDistanceSq = minNeutralDistance ** 2

  for (let attempt = 0; attempt < 300; attempt++) {
    const i = runtime.map.randomRange(border, runtime.map.size - border)
    const j = runtime.map.randomRange(border, runtime.map.size - border)
    const cell = runtime.map.grid[i]?.[j]
    if (!cell || cell.solid || cell.category === 'Water' || cell.has || cell.border || cell.inclined) continue
    if (hasWaterBorderWithin(runtime.map.grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE)) continue

    const tooCloseToPlayer = playersPos.some(pos => (pos.i - i) ** 2 + (pos.j - j) ** 2 < playerSafeDistanceSq)
    if (tooCloseToPlayer) continue

    const tooCloseToGroup = placedCenters.some(pos => (pos.i - i) ** 2 + (pos.j - j) ** 2 < minNeutralDistanceSq)
    if (tooCloseToGroup) continue

    return { i, j }
  }

  return null
}

export function placeResourceGroupAt(
  runtime: MapResources,
  center: GridPosition,
  instance: ResourceType,
  quantity: number,
  clusterRadius: number = 2,
  options: ResourcePlacementOptions = {}
): boolean {
  const { grid } = runtime.map
  const playerAvoidPositions = options.playerAvoidPositions ?? []
  const playerClearanceSq = (options.playerClearance ?? 0) ** 2

  function getValidCells(ci: number, cj: number, radius: number): ResourceCenter[] {
    const cells: ResourceCenter[] = []
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const newI = ci + dx
        const newJ = cj + dy
        const cell = grid[newI]?.[newJ]
        if (!cell) continue
        if (
          !hasSpacedResourceAround(grid, cell.i, cell.j) &&
          !playerAvoidPositions.some(pos => (pos.i - cell.i) ** 2 + (pos.j - cell.j) ** 2 < playerClearanceSq) &&
          !cell.solid &&
          cell.category !== 'Water' &&
          !hasWaterBorderWithin(grid, cell.i, cell.j, WATER_BORDER_PLACEMENT_CLEARANCE) &&
          !cell.has &&
          !cell.border &&
          !cell.inclined &&
          // Dirt/Snow patches are meant to read as bare ground; trees there would also
          // fall back to the wrong sprite since resources.json has no matching tree variants.
          (instance !== RESOURCE_TYPES.tree || (cell.type !== 'Dirt' && cell.type !== 'Snow'))
        ) {
          cells.push({ i: newI, j: newJ })
        }
      }
    }
    return cells
  }

  let validCells = getValidCells(center.i, center.j, clusterRadius)
  if (validCells.length < quantity) validCells = getValidCells(center.i, center.j, clusterRadius + 1)
  if (validCells.length < quantity) return false

  const cellsToPlace: ResourceCenter[] = []
  for (let i = 0; i < quantity; i++) {
    if (!validCells.length) break
    const idx = Math.floor(runtime.map.random() * validCells.length)
    const selected = validCells.splice(idx, 1)[0]
    if (!selected) return false
    cellsToPlace.push(selected)
  }

  const sharedTextureName = options.textureName ?? runtime.getSharedGroupTextureName(instance)
  for (const cell of cellsToPlace) {
    const rolledQuantity =
      options.quantity ?? rollResourceQuantity(() => runtime.map.random(), NEUTRAL_RESOURCE_QUANTITY_RANGES[instance])
    runtime.map.resources.add(
      createResource(
        runtime.map,
        cell.i,
        cell.j,
        instance,
        definedProperties({
          textureName: options.textureNameFactory?.(grid[cell.i]?.[cell.j]) ?? sharedTextureName,
          isNaturalResource: options.isNaturalResource ?? true,
          quantity: rolledQuantity,
          totalQuantity: rolledQuantity,
          startsMature: options.startsMature,
        })
      )
    )
  }
  return true
}

export function getSharedGroupTextureName(runtime: MapResources, instance: ResourceType): string | undefined {
  if (instance !== RESOURCE_TYPES.berrybush) return undefined
  return berryBushTextureName(runtime.map.randomItem([1, 2]))
}
