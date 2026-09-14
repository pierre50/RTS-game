import { NaturalResourcePlacement } from '../../../lib/resources/NaturalResourcePlacement'
import { createNonReservedPassageCellCondition } from '../../../lib/buildings/passageCells'
import { OfflineWorldSpatial } from '../../../services/world/OfflineWorldSpatial'
import type { GameContextLike } from '../../../types/context'
import type { SaveEntityState, SaveGridPoint } from '../../../types/save'
import type { MapResources } from './MapResources'

const sessions = new WeakMap<MapResources, { day: number; placement: NaturalResourcePlacement; regions: OfflineWorldSpatial; anchors: SaveGridPoint[] }>()

export function naturalRespawnPlacement(runtime: MapResources) {
  const map = runtime.map
  const context = map.context as GameContextLike
  const day = context.dayNight?.state?.day ?? 1
  let session = sessions.get(runtime)
  if (session?.day === day) return session
  const nonPassage = createNonReservedPassageCellCondition(context)
  // Connectivity is terrain-only; live occupancy and building access are checked below.
  const regions = new OfflineWorldSpatial(map.grid, { camera: { x: 0, y: 0 }, resources: [], animals: [], players: [] }, () => 1)
  const resources: SaveEntityState[] = [...map.resources].filter(r => !r.isDestroyed).map(r => ({
    type: r.type, i: r.i, j: r.j, ...(r.textureName ? { textureName: r.textureName } : {}),
  }))
  const placement = new NaturalResourcePlacement(resources, map.grid, {
    reachable: (from, to) => regions.reachable(from, to),
    naturalCell: point => {
      const cell = map.grid[point.i]?.[point.j]
      if (!cell || cell.solid || cell.has || cell.border || cell.terrainHidden || cell.inclined || cell.category === 'Water' || !nonPassage(cell)) return false
      for (let i = point.i - 2; i <= point.i + 2; i++) for (let j = point.j - 2; j <= point.j + 2; j++) {
        if (map.grid[i]?.[j]?.has?.family === 'building') return false
      }
      return true
    },
  })
  session = { day, placement, regions, anchors: [] }
  sessions.set(runtime, session)
  return session
}
