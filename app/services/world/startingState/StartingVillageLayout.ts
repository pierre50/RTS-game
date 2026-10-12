import { BUILDING_INTERIOR_TYPES } from '../../../lib/buildings/interiorProfiles'
import { storagePitResources } from '../../../lib/grid/storagePitPlacement'
import type { RoadLayer } from '../../../lib/terrain/roadLayer'
import type { SaveEntityState, SaveGridPoint, SerializedSave } from '../../../types/save'
import { OfflineWorldSpatial, type OfflineTerrainCell } from '../offline/OfflineWorldSpatial'
import type { OfflineWorkRules } from '../offline/OfflineWorldWork'
import { selectStartingFieldSites } from './StartingFieldSites'
import { StartingResourceRelocation } from './StartingResourceRelocation'
import { startingSiteCandidates } from './StartingSiteCandidates'
import { StartingVillageRoads } from './StartingVillageRoads'
import { findVillageSquare, planVillageDistricts, type VillageDistrictPlan } from './VillageDistrictPlan'

const ROAD_CLEARANCE = 2

/** Initial layouts use runtime-sized footprints and a free circulation ring, rather
 * than the historical path reservations needed when extending a live village. */
export class StartingVillageLayout {
  private readonly defenseSites = new Map<SaveEntityState, SaveEntityState[]>()
  private roads?: StartingVillageRoads
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

  /** Fix the shared square before the road planner sees the settlement. */
  prepareCore(center: SaveEntityState): SaveGridPoint {
    const square = this.plan(center).square
    // The road endpoints need the same resource clearance as the future road.
    // Clear one connected corridor so neither endpoint is sealed by nearby nodes.
    const before = Math.floor(((center.size ?? 3) - 1) / 2) + ROAD_CLEARANCE + 1
    const minI = Math.min(center.i - before, square.i - ROAD_CLEARANCE)
    const maxI = Math.max(center.i + before, square.i + ROAD_CLEARANCE)
    const minJ = Math.min(center.j - before, square.j - ROAD_CLEARANCE)
    const maxJ = Math.max(center.j + before, square.j + ROAD_CLEARANCE)
    const excluded = (point: SaveGridPoint) => point.i >= minI && point.i <= maxI && point.j >= minJ && point.j <= maxJ
    for (const resource of this.movableResources)
      if (excluded(resource) && !this.relocation.move(resource, center, excluded))
        throw new Error(`No room to clear road access around ${center.label}`)
    return square
  }

  reserveRoads(roads: RoadLayer): void {
    this.roads = new StartingVillageRoads(roads)
    for (const [id] of roads.cells) {
      const i = Math.floor(id / roads.stride)
      const j = id % roads.stride
      // Keep both sides and bends clear, measured from the occupied footprint.
      for (let di = -ROAD_CLEARANCE; di <= ROAD_CLEARANCE; di++)
        for (let dj = -ROAD_CLEARANCE; dj <= ROAD_CLEARANCE; dj++) this.spatial.reservePassage({ i: i + di, j: j + dj })
    }
  }

  /** Reserve defensive lots before housing can consume the few valid roadside sites. */
  reserveDefenseSites(center: SaveEntityState, count: number, size: number, range: number, civilization: string): void {
    const reservations: SaveEntityState[] = []
    for (let n = 0; n < count; n++) {
      const point = this.findSite(center, center, size, civilization, 'WatchTower', range)
      if (!point) throw new Error(`No defensive site for ${civilization}`)
      const reservation: SaveEntityState = {
        ...point,
        type: 'WatchTower',
        size,
        label: `defense-lot:${center.label}:${n}`,
      }
      // Include the circulation ring until the real tower is built.
      const before = Math.floor((size - 1) / 2) + 1
      const after = size - Math.floor((size - 1) / 2)
      for (let i = point.i - before; i <= point.i + after; i++)
        for (let j = point.j - before; j <= point.j + after; j++) this.spatial.reserve(reservation, { i, j })
      this.placed.get(center)!.push(reservation)
      reservations.push(reservation)
    }
    this.placed.set(
      center,
      this.placed.get(center)!.filter(building => !reservations.includes(building))
    )
    this.defenseSites.set(center, reservations)
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
      // Granary-centered villages need the nearby ground for fields. Keep their courtyard beyond crop range.
      if (center.type === 'Granary') {
        plan.square = { i: center.i + (plan.square.i - center.i) * 2, j: center.j + (plan.square.j - center.j) * 2 }
      }
      // Keep the shared yard clear of both structures and resource nodes.
      const square = findVillageSquare(
        center,
        plan.square,
        (from, to) => this.spatial.reachable(from, to),
        point => !this.entrances.has(`${point.i}:${point.j}`) && this.spatial.naturalCell(point, this.clearableTypes)
      )
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
        return this.roads?.militarySite(center, plan.defence) ?? plan.defence
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
    type = '',
    towerRange = 6
  ): SaveGridPoint | null {
    if (type === 'WatchTower') {
      const reserved = this.defenseSites.get(center)?.shift()
      if (reserved) {
        this.spatial.releaseBuilding(reserved)
        return { i: reserved.i, j: reserved.j }
      }
    }
    const point = this.siteCandidates(center, anchor, size, type, towerRange)[0] ?? null
    if (!point) return null
    const clearance = type === 'Farm' ? 0 : 1
    const before = Math.floor((size - 1) / 2) + clearance
    const after = size - Math.floor((size - 1) / 2) - 1 + clearance
    this.relocateResources(center, point, before, after, civilization)
    if (type === 'StoragePit') {
      for (const resource of storagePitResources(this.movableResources, center))
        if (Math.hypot(point.i - resource.i, point.j - resource.j) <= 10) this.protectedResources.add(resource)
    }
    return point
  }

  planFields(center: SaveEntityState, anchor: SaveEntityState, size: number, count: number): SaveGridPoint[] | null {
    return selectStartingFieldSites(this.siteCandidates(center, anchor, size, 'Farm', 6), size, count)
  }

  clearField(center: SaveEntityState, point: SaveGridPoint, size: number, civilization: string): void {
    const before = Math.floor((size - 1) / 2)
    this.relocateResources(center, point, before, size - before - 1, civilization)
  }

  private siteCandidates(
    center: SaveEntityState,
    anchor: SaveEntityState,
    size: number,
    type: string,
    towerRange: number
  ): SaveGridPoint[] {
    const plan = this.plan(center)
    return startingSiteCandidates(
      {
        plan,
        preferred: type ? this.preferredSite(center, type) : anchor,
        spatial: this.spatial,
        roads: this.roads,
        clearableTypes: this.clearableTypes,
        protectedResources: [...this.protectedResources],
        movableResources: this.movableResources,
        placed: this.placed.get(center) ?? [],
        blocksEntrance: (point, width) => this.blocksEntrance(point, width),
        nearGranary: (origin, point, width) => this.nearGranary(origin, point, width),
      },
      center,
      size,
      type,
      towerRange
    )
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
