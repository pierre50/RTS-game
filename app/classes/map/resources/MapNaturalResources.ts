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
import { hasSpacedResourceAround } from './MapResourceSpacing'
import { NEUTRAL_RESOURCE_QUANTITY_RANGES, rollResourceQuantity } from './ResourceQuantityRanges'

const RELOCATED_RESPAWN_TYPES = new Set<string>([RESOURCE_TYPES.berrybush, RESOURCE_TYPES.wheat])

export function respawnNaturalResource(runtime: MapResources, slot: SaveEntityState): boolean {
  if (!Object.hasOwn(NATURAL_RESOURCE_REGROWTH_BY_TYPE, slot.type)) return false
  if (!RELOCATED_RESPAWN_TYPES.has(slot.type)) return respawnInPlace(runtime, slot)
  const border = 10
  const attempts = Math.max(120, runtime.map.size * 2)
  for (let attempt = 0; attempt < attempts; attempt++) {
    const i = runtime.map.randomRange(border, runtime.map.size - border)
    const j = runtime.map.randomRange(border, runtime.map.size - border)
    const cell = runtime.map.grid[i]?.[j]
    if (!isAvailableNaturalResourceCell(cell)) continue
    if (hasWaterBorderWithin(runtime.map.grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE)) continue
    if (hasSpacedResourceAround(runtime.map.grid, i, j)) continue

    const rolledQuantity = rollResourceQuantity(() => runtime.map.random(), NEUTRAL_RESOURCE_QUANTITY_RANGES[slot.type])
    const config = NATURAL_RESOURCE_REGROWTH_BY_TYPE[slot.type as keyof typeof NATURAL_RESOURCE_REGROWTH_BY_TYPE]
    if (!config) return false
    const quantity =
      typeof rolledQuantity === 'number'
        ? Math.max(1, Math.ceil(rolledQuantity * config.respawnQuantityRatio))
        : undefined
    runtime.map.resources.add(
      createResource(
        runtime.map,
        i,
        j,
        slot.type,
        definedProperties({
          isNaturalResource: true,
          textureName: slot.type === RESOURCE_TYPES.berrybush ? slot.textureName : undefined,
          quantity,
          totalQuantity: rolledQuantity,
          startsMature: slot.type === RESOURCE_TYPES.wheat ? true : undefined,
        })
      )
    )
    return true
  }
  return false
}

export async function generateBiomeTreesAsync(
  runtime: MapResources,
  playersPos: GridPosition[],
  options: TreeResourceGenerationOptions = {}
): Promise<void> {
  const yieldFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  const { grid, size } = runtime.map
  // Every environment's ground is single-type (see MapGeneration#generateTerrain). A cell's
  // forest type (DarkForest/Jungle) can come from exactly one of three sources per
  // environment — the dominant groundType (BlackForest/Jungle), a patchwork patch, or a
  // lake shore (both only Desert today) — and each has its own tunable chance instead of
  // BIOME_TREE_CHANCE's default, which was tuned for that type being a small patch on the
  // old mixed-biome map and would leave almost no walkable gaps at full-environment coverage.
  // Patchwork and lake-shore cells can share the same terrainType (both 'Jungle' for Desert)
  // with no per-cell record of which one produced a given cell, so a matching cell resolves
  // patchwork.treeChance first — see EnvironmentTerrainParams.lakes.shoreTreeChance's comment.
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

function respawnInPlace(runtime: MapResources, slot: SaveEntityState): boolean {
  const cell = runtime.map.grid[slot.i]?.[slot.j]
  if (!isAvailableNaturalResourceCell(cell)) return false
  const totalQuantity =
    typeof slot.totalQuantity === 'number'
      ? slot.totalQuantity
      : rollResourceQuantity(() => runtime.map.random(), NEUTRAL_RESOURCE_QUANTITY_RANGES[slot.type])
  const config = NATURAL_RESOURCE_REGROWTH_BY_TYPE[slot.type as keyof typeof NATURAL_RESOURCE_REGROWTH_BY_TYPE]
  if (!config) return false
  const quantity =
    typeof totalQuantity === 'number' ? Math.max(1, Math.ceil(totalQuantity * config.respawnQuantityRatio)) : undefined
  runtime.map.resources.add(
    createResource(
      runtime.map,
      slot.i,
      slot.j,
      slot.type,
      definedProperties({
        isNaturalResource: true,
        quantity,
        totalQuantity,
      })
    )
  )
  return true
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
  } else if (cell.type === params.patchwork?.terrainType && params.patchwork.treeChance != null) {
    chance = params.patchwork.treeChance
  } else if (cell.type === params.lakes?.shoreType && params.lakes.shoreTreeChance != null) {
    chance = params.lakes.shoreTreeChance
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
