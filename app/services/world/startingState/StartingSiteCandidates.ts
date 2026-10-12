import { storagePitResources, storagePitSiteScore } from '../../../lib/grid/storagePitPlacement'
import type { SaveEntityState, SaveGridPoint } from '../../../types/save'
import type { OfflineWorldSpatial } from '../offline/OfflineWorldSpatial'
import type { StartingVillageRoads } from './StartingVillageRoads'
import type { VillageDistrictPlan } from './VillageDistrictPlan'

type SiteLayout = {
  plan: VillageDistrictPlan
  preferred: SaveGridPoint
  spatial: OfflineWorldSpatial
  roads?: StartingVillageRoads
  clearableTypes: Set<string>
  protectedResources: SaveEntityState[]
  movableResources: SaveEntityState[]
  placed: SaveEntityState[]
  blocksEntrance(point: SaveGridPoint, size: number): boolean
  nearGranary(center: SaveEntityState, point: SaveGridPoint, size: number): boolean
}
export function startingSiteCandidates(
  layout: SiteLayout,
  center: SaveEntityState,
  size: number,
  type: string,
  towerRange: number
): SaveGridPoint[] {
  const plan = layout.plan
  const preferred = layout.preferred
  const distance = (a: SaveGridPoint, b: SaveGridPoint) => Math.hypot(a.i - b.i, a.j - b.j)
  const deposits = type === 'StoragePit' ? storagePitResources(layout.movableResources, center) : []
  const protectedResources = layout.protectedResources
  const lots: Array<{ point: SaveGridPoint; score: number }> = []
  const clearance = type === 'Farm' ? 0 : 1
  const before = Math.floor((size - 1) / 2) + clearance
  const after = size - Math.floor((size - 1) / 2) - 1 + clearance
  for (let di = -24; di <= 24; di++) {
    for (let dj = -24; dj <= 24; dj++) {
      const candidate = { i: center.i + di, j: center.j + dj }
      if (!layout.spatial.reachable(center, candidate)) continue
      // Fields have no general circulation ring, but must leave room around
      // door approaches so multiple wheat patches cannot enclose an entrance.
      if (layout.blocksEntrance(candidate, type === 'Farm' ? size + 4 : size)) continue
      if (type === 'WatchTower' && distance(candidate, center) < 10) continue
      if (type === 'Farm' && !layout.nearGranary(center, candidate, size)) continue
      if (
        protectedResources.some(
          resource =>
            resource.i >= candidate.i - before &&
            resource.i <= candidate.i + after &&
            resource.j >= candidate.j - before &&
            resource.j <= candidate.j + after
        )
      )
        continue
      // Keep an actual shared courtyard. Campfires decorate its edge.
      if (type !== 'FireCamp' && distance(candidate, plan.square) < Math.ceil(size / 2) + 2) continue
      const gateTower =
        type === 'WatchTower' && layout.roads?.entrances(center).some(entry => distance(candidate, entry) <= towerRange)
      let free = true
      let displaced = 0
      let breathingRoom = 0
      for (let i = candidate.i - before; i <= candidate.i + after && free; i++) {
        for (let j = candidate.j - before; j <= candidate.j + after; j++) {
          // Diagonal neighbors do not obstruct the one-cell circulation along house walls.
          if (
            type === 'House' &&
            (i === candidate.i - before || i === candidate.i + after) &&
            (j === candidate.j - before || j === candidate.j + after)
          )
            continue
          // A gate tower's walking ring can share the road verge; its footprint
          // still respects the full road clearance and all other obstacles.
          const circulation =
            i === candidate.i - before ||
            i === candidate.i + after ||
            j === candidate.j - before ||
            j === candidate.j + after
          if (!layout.spatial.naturalCell({ i, j }, layout.clearableTypes, Boolean(gateTower && circulation))) {
            free = false
            break
          }
          if (!layout.spatial.available({ i, j })) displaced++
        }
      }
      if (!free) continue
      // Prefer an additional free tile around large roofs, without making it a
      // hard constraint on narrow shorelines.
      if (size >= 2) {
        for (let i = candidate.i - before - 1; i <= candidate.i + after + 1; i++)
          for (let j = candidate.j - before - 1; j <= candidate.j + after + 1; j++)
            if (!layout.spatial.naturalCell({ i, j }, layout.clearableTypes)) breathingRoom++
      }
      let score =
        distance(candidate, preferred) * 3 + distance(candidate, center) * 0.12 + displaced * 0.15 + breathingRoom * 0.8
      if (type === 'StoragePit' && deposits.length) {
        // Explicit starting profiles require their depots even if the TownCenter already serves the area.
        const value = storagePitSiteScore(candidate, center, deposits, [], {
          required: true,
          clearance: Math.max(before, after),
        })
        if (value === null) continue
        score = -value + displaced * 2 + breathingRoom
      }
      const placed = layout.placed
      const cityPerimeter = center.type === 'TownCenter'
      score += layout.roads?.score(center, candidate, type, placed, towerRange, cityPerimeter) ?? 0
      if (type === 'WatchTower' && cityPerimeter) {
        // Spread the remaining defenses around the city, even without roads.
        // Gate and uncovered-approach bonuses still take priority when feasible.
        const radius = distance(candidate, center)
        score += Math.abs(radius - 18) * 15
        for (const tower of placed.filter(building => building.type === 'WatchTower')) {
          const towerRadius = distance(tower, center)
          if (!towerRadius) continue
          const alignment =
            ((candidate.i - center.i) * (tower.i - center.i) + (candidate.j - center.j) * (tower.j - center.j)) /
            (radius * towerRadius)
          score += Math.max(0, alignment - 0.5) * 300
        }
      }
      if (type === 'WatchTower') score += Math.max(0, 13 - distance(candidate, center)) * 5
      lots.push({ point: candidate, score })
    }
  }
  return lots.sort((a, b) => a.score - b.score).map(lot => lot.point)
}
