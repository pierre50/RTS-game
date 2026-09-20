import { isFootprintBuildable, type GridPoint } from './buildingFootprint'

type Resource = GridPoint & {
  type: string
  quantity?: number
  isDead?: boolean
  isDestroyed?: boolean
  spaceId?: string
}
type Depot = GridPoint & {
  type: string
  size?: number
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
}
type StoragePitTerrain = {
  category?: string
  border?: boolean
  terrainHidden?: boolean
  inclined?: boolean
  waterBorder?: boolean
  z?: number
}
const MATERIALS = new Set(['Tree', 'Stone', 'Gold', 'Copper', 'Iron'])
const VILLAGE_RADIUS = 35
const SERVICE_RADIUS = 8
const MIN_GAIN = 3
const distance = (a: GridPoint, b: GridPoint) => Math.hypot(a.i - b.i, a.j - b.j)

export function storagePitResources(resources: readonly Resource[], home: GridPoint): Resource[] {
  return resources
    .filter(
      resource =>
        MATERIALS.has(resource.type) &&
        !resource.isDead &&
        !resource.isDestroyed &&
        (resource.quantity ?? 0) > 0 &&
        (!resource.spaceId || resource.spaceId === 'outside') &&
        distance(resource, home) <= VILLAGE_RADIUS
    )
    .sort((a, b) => a.i - b.i || a.j - b.j || a.type.localeCompare(b.type))
}

/** Cheap shared demand estimate used to reserve materials before selecting a buildable lot. */
export function needsStoragePit(resources: readonly Resource[], buildings: readonly Depot[]): boolean {
  const home =
    buildings.find(b => b.type === 'TownCenter' && b.isBuilt && !b.isDead && !b.isDestroyed) ??
    buildings.find(b => b.type === 'Chest' && b.isBuilt && !b.isDead && !b.isDestroyed)
  if (!home || buildings.some(b => b.type === 'StoragePit' && !b.isBuilt && !b.isDead && !b.isDestroyed)) return false
  const depots = buildings.filter(
    b => !b.isDead && !b.isDestroyed && (b.type === 'StoragePit' || (b.type === 'TownCenter' && b.isBuilt))
  )
  const uncovered = storagePitResources(resources, home).filter(resource =>
    depots.every(depot => distance(depot, resource) > SERVICE_RADIUS)
  )
  return uncovered.reduce((total, resource) => total + Math.min(100, resource.quantity ?? 0), 0) >= 25
}

/** Rank actual lots, not individual trees. Pending depots cover their future service area too. */
export function storagePitSiteScore(
  point: GridPoint,
  home: GridPoint,
  resources: readonly Resource[],
  buildings: readonly Depot[],
  { required = false, clearance = 0 }: { required?: boolean; clearance?: number } = {}
): number | null {
  const depots = buildings.filter(
    b => !b.isDead && !b.isDestroyed && (b.type === 'StoragePit' || (b.type === 'TownCenter' && b.isBuilt))
  )
  let benefit = 0
  for (const resource of resources) {
    // Initial layouts may clear a lot; never count resources that it displaces.
    if (Math.abs(resource.i - point.i) <= clearance && Math.abs(resource.j - point.j) <= clearance) continue
    const trip = distance(point, resource)
    if (trip > SERVICE_RADIUS) continue
    const previous = Math.min(...depots.map(depot => distance(depot, resource)))
    const gain = required ? SERVICE_RADIUS + 1 - trip : previous - trip
    if (!required && (previous <= SERVICE_RADIUS || gain < MIN_GAIN)) continue
    benefit += Math.min(1, (resource.quantity ?? 0) / 100) * Math.min(8, gain)
  }
  if (benefit < 2) return null
  return benefit - distance(home, point) * 0.03
}

/** Live and saved worlds supply terrain/occupancy; all selection rules stay here. */
export function findStoragePitSite(options: {
  home: GridPoint
  size: number
  resources: readonly Resource[]
  buildings: readonly Depot[]
  terrainAt(point: GridPoint): StoragePitTerrain | null | undefined
  isFree(point: GridPoint, forBuilding: boolean): boolean
}): GridPoint | null {
  const { home, size, buildings, terrainAt, isFree } = options
  const resources = storagePitResources(options.resources, home)
  if (!resources.length || buildings.some(b => b.type === 'StoragePit' && !b.isBuilt && !b.isDead && !b.isDestroyed))
    return null
  const key = (p: GridPoint) => `${p.i}:${p.j}`
  const reachable = new Set<string>()
  const queue = [home]
  reachable.add(key(home))
  for (let index = 0; index < queue.length; index++) {
    const p = queue[index]
    for (const [di, dj] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const next = { i: p.i + di, j: p.j + dj }
      if (distance(next, home) > VILLAGE_RADIUS || reachable.has(key(next))) continue
      const cell = terrainAt(next)
      if (!cell || cell.category === 'Water' || cell.border || cell.terrainHidden) continue
      const previousCell = terrainAt(p)
      if ((cell.z ?? 0) !== (previousCell?.z ?? 0) && !cell.inclined && !previousCell?.inclined) continue
      const insideHome = buildings.some(
        b =>
          (b.type === 'TownCenter' || b.type === 'Chest') &&
          distance(b, home) === 0 &&
          Math.abs(next.i - home.i) <= Math.ceil((b.size ?? 3) / 2) &&
          Math.abs(next.j - home.j) <= Math.ceil((b.size ?? 3) / 2)
      )
      if (!insideHome && !isFree(next, false)) continue
      reachable.add(key(next))
      queue.push(next)
    }
  }
  const accessibleResources = resources.filter(r =>
    [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ].some(([di, dj]) => reachable.has(key({ i: r.i + di, j: r.j + dj })))
  )
  let best: GridPoint | null = null
  let bestScore = -Infinity
  const radius = Math.ceil(size / 2) + 1
  // Stable coordinate order makes ties identical across reloads and runtime modes.
  for (let i = home.i - VILLAGE_RADIUS; i <= home.i + VILLAGE_RADIUS; i++) {
    for (let j = home.j - VILLAGE_RADIUS; j <= home.j + VILLAGE_RADIUS; j++) {
      const point = { i, j }
      if (!reachable.has(key(point))) continue
      const score = storagePitSiteScore(point, home, accessibleResources, buildings)
      if (score === null || score <= bestScore) continue
      if (
        !isFootprintBuildable(
          point,
          radius,
          p => {
            const cell = terrainAt(p)
            return (
              !!cell &&
              cell.category !== 'Water' &&
              !cell.border &&
              !cell.terrainHidden &&
              !cell.inclined &&
              !cell.waterBorder &&
              isFree(p, true)
            )
          },
          p => terrainAt(p)?.z
        )
      )
        continue
      best = point
      bestScore = score
    }
  }
  return best
}
