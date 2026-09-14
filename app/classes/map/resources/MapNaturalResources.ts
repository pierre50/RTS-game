import { naturalRespawnPlacement } from './NaturalRespawnPlacement'
import { NATURAL_RESOURCE_REGROWTH_BY_TYPE } from '../../../config/gameplay'
import {
  BIOME_TREE_CHANCE,
  BIOME_TREE_PLAYER_SAFE_DIST,
  RESOURCE_TYPES,
  WATER_BORDER_PLACEMENT_CLEARANCE,
  getEnvironmentTerrainParams,
} from '../../../constants'
import { hasWaterBorderWithin } from '../../../lib'
import { definedProperties } from '../../../lib/definedProperties'
import type { GridPosition } from '../../../types/grid'
import type { RuntimeCell } from '../../../types/map'
import type { SaveEntityState } from '../../../types/save'
import { createResource } from './MapResourceCreation'
import type { MapResources, TreeResourceGenerationOptions } from './MapResources'
import { NEUTRAL_RESOURCE_QUANTITY_RANGES, rollResourceQuantity } from './ResourceQuantityRanges'

export function respawnNaturalResource(runtime: MapResources, slot: SaveEntityState): boolean {
  if (!Object.hasOwn(NATURAL_RESOURCE_REGROWTH_BY_TYPE, slot.type)) return false
  const wheat = slot.type === RESOURCE_TYPES.wheat
  const session = wheat ? null : naturalRespawnPlacement(runtime)
  let destination: GridPosition | null = slot
  if (wheat) {
    if (!isAvailableNaturalResourceCell(runtime.map.grid[slot.i]?.[slot.j])) return false
  } else if (session && !session.placement.canPlace(slot, slot, 0)) {
    // Keep the original natural patch when its cell is still suitable. Only a
    // displaced respawn needs new spacing and a ranked replacement location.
    const { placement, regions, anchors } = session
    let anchor = anchors.find(point => regions.reachable(slot, point))
    if (!anchor) { anchor = { i: slot.i, j: slot.j }; anchors.push(anchor) }
    destination = placement.find(slot, anchor, () => false, { spacing: [3], clearances: [0] })
  }
  if (!destination) return false
  const config = NATURAL_RESOURCE_REGROWTH_BY_TYPE[slot.type as keyof typeof NATURAL_RESOURCE_REGROWTH_BY_TYPE]
  const totalQuantity = slot.type === RESOURCE_TYPES.berrybush || typeof slot.totalQuantity !== 'number'
    ? rollResourceQuantity(() => runtime.map.random(), NEUTRAL_RESOURCE_QUANTITY_RANGES[slot.type])
    : slot.totalQuantity
  const quantity = typeof totalQuantity === 'number'
    ? Math.max(1, Math.ceil(totalQuantity * (wheat ? 1 : config.respawnQuantityRatio))) : undefined
  runtime.map.resources.add(createResource(runtime.map, destination.i, destination.j, slot.type,
    definedProperties({ isNaturalResource: true, textureName: slot.textureName, quantity, totalQuantity,
      ...(wheat ? { startsMature: false } : {}),
    })))
  session?.placement.record({ ...slot, ...destination })
  return true
}

export async function generateBiomeTreesAsync(
  runtime: MapResources,
  playersPos: GridPosition[],
  options: TreeResourceGenerationOptions = {}
): Promise<void> {
  const yieldFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  const { grid, size } = runtime.map
  const params = getEnvironmentTerrainParams(runtime.map.environment)
  for (let i = 1; i < size; i++) {
    for (let j = 1; j < size; j++) {
      const cell = grid[i]?.[j]
      if (!isAvailableNaturalResourceCell(cell)) continue
      if (hasWaterBorderWithin(grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE)) continue
      placeBiomeTree(runtime, cell, i, j, playersPos, params, options)
    }
    if (i % 8 === 0) await yieldFrame()
  }
}

function placeBiomeTree(
  runtime: MapResources,
  cell: RuntimeCell,
  i: number,
  j: number,
  playersPos: GridPosition[],
  params: ReturnType<typeof getEnvironmentTerrainParams>,
  options: TreeResourceGenerationOptions
): void {
  const safeDistSq = BIOME_TREE_PLAYER_SAFE_DIST ** 2
  let chance = BIOME_TREE_CHANCE[cell.type as keyof typeof BIOME_TREE_CHANCE] ?? 0
  if (cell.type === params.groundType && params.groundTreeChance != null) {
    chance = params.groundTreeChance
  }
  chance = options.treeChanceForCell?.(cell) ?? chance
  if (chance === 0) return
  if (playersPos.some(p => (p.i - i) ** 2 + (p.j - j) ** 2 < safeDistSq)) return
  if (runtime.map.random() < chance) {
    const rolledQuantity = rollResourceQuantity(
      () => runtime.map.random(),
      NEUTRAL_RESOURCE_QUANTITY_RANGES[RESOURCE_TYPES.tree]
    )
    runtime.map.resources.add(
      createResource(
        runtime.map,
        i,
        j,
        RESOURCE_TYPES.tree,
        definedProperties({
          textureName: runtime.pickTreeTextureName(
            options.treeTextureFamilyForCell?.(cell) ?? options.treeTextureFamily
          ),
          quantity: rolledQuantity,
          totalQuantity: rolledQuantity,
        })
      )
    )
  }
}

function isAvailableNaturalResourceCell(cell: RuntimeCell | undefined): cell is RuntimeCell {
  return !!cell && !cell.solid && cell.category !== 'Water' && !cell.has && !cell.border && !cell.inclined
}
