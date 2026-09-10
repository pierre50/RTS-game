import type { ContainerChild } from 'pixi.js'
import type { RuntimeEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { SaveReference, SaveDestination } from '../../types/save'
import type { MapGenerationMap } from './MapGenerationTypes'

function isRuntimeEntity(value: ContainerChild | null): value is RuntimeEntity & ContainerChild {
  return Boolean(value && typeof (value as Partial<RuntimeEntity>).family === 'string')
}

export function isRuntimeDestination(value: RuntimeEntity | RuntimeCell | null): value is RuntimeEntity {
  return Boolean(value && 'family' in value)
}

// --- Saved-game restore helpers -------------------------------------------------
// Shared by generateFromJSON and applySavedStateToGeneratedMap, which rebuild the
// same runtime cross-references (unit destinations, building assignments, AI
// memory) from a serialized save.

// A saved reference is either a [i, j] grid coordinate, a [i, j, label] tuple (an
// entity currently standing on a cell), or a bare label string (entity lookup).
export function getDest(
  val: SaveReference | SaveDestination | RuntimeEntity | RuntimeCell | null | undefined,
  map: MapGenerationMap,
  grid = map.grid
): RuntimeEntity | RuntimeCell | null {
  if (val) {
    if (Array.isArray(val)) {
      return val[2] ? getRuntimeEntityByLabel(map, val[2]) : (grid[val[0]]?.[val[1]] ?? null)
    }
    if (typeof val === 'string') return getRuntimeEntityByLabel(map, val)
    if ('label' in val && val.label) return getRuntimeEntityByLabel(map, val.label)
    if (val.i != null && val.j != null) return grid[val.i]?.[val.j] ?? null
  }
  return null
}

function getRuntimeEntityByLabel(map: MapGenerationMap, label: string): RuntimeEntity | null {
  const child = map.getChildByLabel?.(label)
  if (child && isRuntimeEntity(child)) return child
  for (const player of map.context?.players ?? []) {
    const entity = [...player.units, ...player.corpses, ...player.buildings].find(entity => entity.label === label)
    if (entity) return entity
  }
  return null
}

// Saved references used for unit/building ownership links and AI memory always
// encode an entity label, never a bare grid cell, so this narrows the lookup above.
export function getDestEntity(
  val: SaveReference | RuntimeEntity | RuntimeCell | null | undefined,
  map: MapGenerationMap
): RuntimeEntity | null {
  const dest = getDest(val, map)
  return isRuntimeDestination(dest) ? dest : null
}
