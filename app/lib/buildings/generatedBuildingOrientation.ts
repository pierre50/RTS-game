import type { GridPosition } from '../../types/grid'

const VARIED_BUILDINGS = new Set([
  'TownCenter',
  'House',
  'Barracks',
  'ArcheryRange',
  'Stable',
  'Granary',
  'StoragePit',
  'Market',
  'Forge',
  'Temple',
  'WatchTower',
])

/** Stable variation without consuming the simulation's random sequence. */
export function generatedBuildingMirrored(
  type: string,
  position: GridPosition,
  seed: string | number,
  entryAvailable: (position: GridPosition) => boolean
): boolean {
  if (!VARIED_BUILDINGS.has(type)) return false
  let hash = 2166136261
  for (const char of `${seed}:${type}:${position.i}:${position.j}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  }
  hash ^= hash >>> 16
  const preferred = (hash >>> 0) % 2 === 1
  const available = (mirrored: boolean) =>
    entryAvailable({
      i: position.i + (mirrored ? 2 : 1),
      j: position.j + (mirrored ? 1 : 2),
    })
  if (available(preferred)) return preferred
  return available(!preferred) ? !preferred : false
}
