import { BUILDING_INTERIOR_TYPES } from '../../lib/buildings/interiorProfiles'
import { storagePitResources, storagePitSiteScore } from '../../lib/grid/storagePitPlacement'
import { StartingResourceRelocation } from './StartingResourceRelocation'
import { planVillageDistricts, type VillageDistrictPlan } from './VillageDistrictPlan'
import { OfflineWorldSpatial, type OfflineTerrainCell } from './offline/OfflineWorldSpatial'
import type { OfflineWorkRules } from './offline/OfflineWorldWork'
import type { SaveEntityState, SaveGridPoint, SerializedSave } from '../../types/save'

/** Initial layouts use runtime-sized footprints and a free circulation ring, rather
 * than the historical path reservations needed when extending a live village. */
export class StartingVillageLayout {
  readonly spatial: OfflineWorldSpatial
  private readonly relocation: StartingResourceRelocation
  private readonly movableResources: SaveEntityState[]
  private readonly protectedResources = new Set<SaveEntityState>()
  private readonly clearableTypes: Set<string>
  private readonly districts = new Map<SaveEntityState, VillageDistrictPlan>()
  private readonly entrances = new Set<string>()
  private readonly placed = new Map<SaveEntityState, SaveEntityState[]>()
  private readonly farmSites = new Map<SaveEntityState, SaveGridPoint[]>()

  constructor(state: SerializedSave, terrain: (OfflineTerrainCell | null | undefined)[][], rules: OfflineWorkRules) {
    this.spatial = new OfflineWorldSpatial(
      terrain,
      state,
      (building, index) => Number(rules.buildingConfig(index, building.type).size) || 2,
      { protectVillageAccess: false, exactBuildingFootprints: true }
    )
    for (const owner of state.players) for (const building of owner.buildings ?? []) this.reserveEntrance(building)
    this.movableResources = state.resources.filter(
      resource =>
        !resource.isDestroyed && resource.type !== 'Wheat' && (!resource.spaceId || resource.spaceId === 'outside')
    )
    this.clearableTypes = new Set(this.movableResources.map(resource => resource.type))
    this.relocation = new StartingResourceRelocation(this.movableResources, terrain, this.spatial)
  }

  reserveBuilding(building: SaveEntityState): void {
    this.reserveEntrance(building)
    const size = Math.max(1, Math.floor(building.size ?? 1))
    const before = Math.floor((size - 1) / 2)
    const after = size - before - 1
    for (let i = building.i - before; i <= building.i + after; i++)
      for (let j = building.j - before; j <= building.j + after; j++) this.spatial.reserve(building, { i, j })
  }

  private plan(center: SaveEntityState): VillageDistrictPlan {
    let plan = this.districts.get(center)
    if (!plan) {
      plan = planVillageDistricts(center, point => this.spatial.naturalCell(point, this.clearableTypes))
      // Keep the shared yard clear of both structures and resource nodes.
      let square: SaveGridPoint | undefined
      for (let ring = 0; ring <= 6 && !square; ring++) {
        for (let di = -ring; di <= ring && !square; di++) {
          for (let dj = -ring; dj <= ring; dj++) {
            if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue
            const candidate = { i: plan.square.i + di, j: plan.square.j + dj }
            if (!this.spatial.reachable(center, candidate)) continue
            let free = true
            for (let i = candidate.i - 1; i <= candidate.i + 1 && free; i++)
              for (let j = candidate.j - 1; j <= candidate.j + 1; j++)
                if (this.entrances.has(`${i}:${j}`) || !this.spatial.naturalCell({ i, j }, this.clearableTypes)) {
                  free = false
                  break
                }
            if (free) {
              square = candidate
              break
            }
          }
        }
      }
      if (square) {
        plan.square = square
        this.relocateResources(center, square, 1, 1, center.label ?? 'village')
      }
      this.districts.set(center, plan)
      this.placed.set(center, [])
      this.farmSites.set(center, [])
    }
    return plan
  }

  private preferredSite(center: SaveEntityState, type: string): SaveGridPoint {
    const plan = this.plan(center)
    const buildings = this.placed.get(center)!
    const count = buildings.filter(building => building.type === type).length
    const nearest = (types: string[], fallback: SaveGridPoint) =>
      [center, ...buildings].find(building => types.includes(building.type)) ?? fallback
    switch (type) {
      case 'Farm':
        return nearest(['Granary'], this.farmSites.get(center)![0] ?? plan.farms)
      case 'Granary':
        return this.farmSites.get(center)![0] ?? plan.farms
      case 'House': {
        const home = plan.homes[Math.floor(count / 3) % plan.homes.length]
        const [di, dj] = [
          [-2, 0],
          [2, 3],
          [2, -3],
        ][count % 3]
        return { i: home.i + di, j: home.j + dj }
      }
      case 'Forge':
        return nearest(['StoragePit', 'Market'], plan.square)
      case 'Market':
        return plan.square
      case 'CampBrazier': {
        const districts = [plan.square, ...plan.homes, plan.defence, plan.farms, ...plan.towers]
        return districts[count % districts.length]
      }
      case 'FireCamp':
        return count ? plan.homes[0] : plan.square
      case 'Barracks':
      case 'ArcheryRange':
      case 'Stable':
        return plan.defence
      case 'WatchTower':
        return plan.towers[count % plan.towers.length]
      case 'CampCrate':
        return nearest(['StoragePit', 'Market'], plan.square)
      case 'CampBucket':
      case 'CampDryingRack':
      case 'CampMeatRack':
        return nearest(['Granary'], plan.farms)
      case 'CampJarSmall':
      case 'CampJarLarge':
        return nearest(['House'], plan.homes[0])
      default:
        return center
    }
  }

  recordSite(center: SaveEntityState, type: string, point: SaveGridPoint, size: number): void {
    this.plan(center)
    if (type === 'Farm') this.farmSites.get(center)!.push(point)
    else this.placed.get(center)!.push({ ...point, type, size })
  }

  findSite(
    center: SaveEntityState,
    anchor: SaveEntityState,
    size: number,
    civilization: string,
    type = ''
  ): SaveGridPoint | null {
    const plan = this.plan(center)
    const preferred = type ? this.preferredSite(center, type) : anchor
    const distance = (a: SaveGridPoint, b: SaveGridPoint) => Math.hypot(a.i - b.i, a.j - b.j)
    const deposits = type === 'StoragePit' ? storagePitResources(this.movableResources, center) : []
    const protectedResources = [...this.protectedResources]
    const lots: Array<{ point: SaveGridPoint; score: number }> = []
    const clearance = type === 'Farm' ? 0 : 1
    const before = Math.floor((size - 1) / 2) + clearance
    const after = size - Math.floor((size - 1) / 2) - 1 + clearance
    for (let di = -24; di <= 24; di++) {
      for (let dj = -24; dj <= 24; dj++) {
        const candidate = { i: center.i + di, j: center.j + dj }
        if (!this.spatial.reachable(center, candidate)) continue
        // Fields have no general circulation ring, but must leave room around
        // door approaches so multiple wheat patches cannot enclose an entrance.
        if (this.blocksEntrance(candidate, type === 'Farm' ? size + 2 : size)) continue
        if (type === 'WatchTower' && distance(candidate, center) < 10) continue
        if (type === 'Farm' && !this.nearGranary(center, candidate, size)) continue
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
            if (!this.spatial.naturalCell({ i, j }, this.clearableTypes)) {
              free = false
              break
            }
            if (!this.spatial.available({ i, j })) displaced++
          }
        }
        if (!free) continue
        // Prefer an additional free tile around large roofs, without making it a
        // hard constraint on narrow shorelines.
        if (size >= 2) {
          for (let i = candidate.i - before - 1; i <= candidate.i + after + 1; i++)
            for (let j = candidate.j - before - 1; j <= candidate.j + after + 1; j++)
              if (!this.spatial.naturalCell({ i, j }, this.clearableTypes)) breathingRoom++
        }
        let score =
          distance(candidate, preferred) * 3 +
          distance(candidate, center) * 0.12 +
          displaced * 0.15 +
          breathingRoom * 0.8
        if (type === 'StoragePit' && deposits.length) {
          // Explicit starting profiles require their depots even if the TownCenter already serves the area.
          const value = storagePitSiteScore(candidate, center, deposits, [], {
            required: true,
            clearance: Math.max(before, after),
          })
          if (value === null) continue
          score = -value + displaced * 2 + breathingRoom
        }
        if (type === 'WatchTower') score += Math.max(0, 13 - distance(candidate, center)) * 5
        lots.push({ point: candidate, score })
      }
    }
    lots.sort((a, b) => a.score - b.score)
    const point = lots[0]?.point ?? null
    if (!point) return null
    this.relocateResources(center, point, before, after, civilization)
    if (type === 'StoragePit') {
      for (const resource of deposits) if (distance(point, resource) <= 10) this.protectedResources.add(resource)
    }
    return point
  }

  private blocksEntrance(point: SaveGridPoint, size: number): boolean {
    const before = Math.floor((size - 1) / 2)
    const after = size - before - 1
    for (let i = point.i - before; i <= point.i + after; i++)
      for (let j = point.j - before; j <= point.j + after; j++) if (this.entrances.has(`${i}:${j}`)) return true
    return false
  }

  private reserveEntrance(building: SaveEntityState): void {
    if (!BUILDING_INTERIOR_TYPES.has(building.type)) return
    for (let step = 0; step <= 1; step++) {
      const i = building.i + (building.placementMirrored ? 2 + step : 1)
      const j = building.j + (building.placementMirrored ? 1 : 2 + step)
      this.entrances.add(`${i}:${j}`)
    }
  }

  private nearGranary(center: SaveEntityState, point: SaveGridPoint, size: number): boolean {
    const granaries = [center, ...(this.placed.get(center) ?? [])].filter(b => b.type === 'Granary')
    if (!granaries.length) return true
    const radius = (size - 1) / 2
    return [-radius, radius].every(di =>
      [-radius, radius].every(dj =>
        granaries.some(granary => {
          const edge = ((granary.size ?? 3) - 1) / 2
          return (
            Math.hypot(
              Math.max(0, Math.abs(point.i + di - granary.i) - edge),
              Math.max(0, Math.abs(point.j + dj - granary.j) - edge)
            ) <= 7
          )
        })
      )
    )
  }

  private relocateResources(
    center: SaveGridPoint,
    point: SaveGridPoint,
    before: number,
    after: number,
    civilization: string
  ): void {
    const radius = Math.max(before, after)
    for (const resource of this.movableResources) {
      if (
        this.protectedResources.has(resource) ||
        resource.i < point.i - before ||
        resource.i > point.i + after ||
        resource.j < point.j - before ||
        resource.j > point.j + after
      )
        continue
      const moved = this.relocation.move(
        resource,
        center,
        candidate => Math.abs(candidate.i - point.i) <= radius && Math.abs(candidate.j - point.j) <= radius
      )
      if (!moved) throw new Error(`No room to relocate ${resource.type} around ${civilization}`)
    }
  }
}
