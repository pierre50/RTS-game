import { getEntityMapPoint } from '../../lib/mapSpaces'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../types/map'

type TickerLike = { deltaMS?: number; elapsedMS?: number; deltaTime?: number }
type RegionEdge = 'east' | 'north' | 'south' | 'west'
type RegionPoint = { x: number; y: number }
type RegionTravelHost = {
  preloadWorldRegion(regionId: string): Promise<void>
  travelToWorldRegion(regionId: string, edge: RegionEdge): Promise<void>
}

const PRELOAD_MARGIN_CELLS = 18
const CROSS_MARGIN_CELLS = 1
const CHECK_INTERVAL_MS = 160

function regionIdFor(map: RuntimeMap, region: RegionPoint): string | null {
  const entry = map.worldManifest?.maps?.find(candidate => {
    return candidate.size === map.size && candidate.region.x === region.x && candidate.region.y === region.y
  })
  return entry?.id ?? null
}

function neighborRegionForEdge(region: RegionPoint, edge: RegionEdge): RegionPoint {
  if (edge === 'west') return { x: region.x, y: region.y - 1 }
  if (edge === 'east') return { x: region.x, y: region.y + 1 }
  if (edge === 'north') return { x: region.x - 1, y: region.y }
  return { x: region.x + 1, y: region.y }
}

function edgeDistance(hero: UnitEntity, map: RuntimeMap, edge: RegionEdge): number {
  if (edge === 'west') return hero.i
  if (edge === 'east') return map.size - hero.i
  if (edge === 'north') return hero.j
  return map.size - hero.j
}

function nearestEdge(hero: UnitEntity, map: RuntimeMap, margin: number): RegionEdge | null {
  const edges: RegionEdge[] = ['west', 'east', 'north', 'south']
  const candidates = edges
    .map(edge => ({ edge, distance: edgeDistance(hero, map, edge) }))
    .filter(candidate => candidate.distance <= margin)
    .sort((a, b) => a.distance - b.distance)
  return candidates[0]?.edge ?? null
}

export function arrivalCellForRegionEdge(map: RuntimeMap, edge: RegionEdge, previousCell: { i: number; j: number }): RuntimeCell | null {
  const inset = 4
  const center = Math.floor(map.size / 2)
  const target =
    edge === 'west'
      ? { i: map.size - inset, j: previousCell.j }
      : edge === 'east'
        ? { i: inset, j: previousCell.j }
        : edge === 'north'
          ? { i: previousCell.i, j: map.size - inset }
          : { i: previousCell.i, j: inset }
  const start = {
    i: Math.max(inset, Math.min(map.size - inset, Math.round(target.i))),
    j: Math.max(inset, Math.min(map.size - inset, Math.round(target.j))),
  }
  const fallback = isOpenWorldTravelCell(map.grid[center]?.[center]) ? map.grid[center][center] : null
  return findOpenWorldTravelCell(map, start, Math.max(8, Math.ceil(map.size / 3)), inset) ?? fallback
}

function isOpenWorldTravelCell(cell: RuntimeCell | null | undefined): boolean {
  return Boolean(cell && !cell.solid && !cell.has && !cell.border && !cell.waterBorder && cell.category !== 'Water')
}

export function findOpenWorldTravelCell(
  map: RuntimeMap,
  start: { i: number; j: number },
  maxRadius: number,
  inset = 1
): RuntimeCell | null {
  if (isOpenWorldTravelCell(map.grid[start.i]?.[start.j])) return map.grid[start.i][start.j]
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let di = -radius; di <= radius; di += 1) {
      for (let dj = -radius; dj <= radius; dj += 1) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== radius) continue
        const i = Math.max(inset, Math.min(map.size - inset, start.i + di))
        const j = Math.max(inset, Math.min(map.size - inset, start.j + dj))
        if (isOpenWorldTravelCell(map.grid[i]?.[j])) return map.grid[i][j]
      }
    }
  }
  return null
}

export class WorldRegionTravelSystem {
  context: GameContextLike
  host: RegionTravelHost
  _onTick: (ticker: TickerLike) => void
  _elapsedMs: number
  _preloadingRegionId: string | null
  _travelling: boolean

  constructor(context: GameContextLike, host: RegionTravelHost) {
    this.context = context
    this.host = host
    this._elapsedMs = 0
    this._preloadingRegionId = null
    this._travelling = false
    this._onTick = ticker => this.update(ticker.deltaMS ?? ticker.elapsedMS ?? 16)
    context.app.ticker.add(this._onTick)
  }

  destroy(): void {
    this.context.app.ticker.remove(this._onTick)
  }

  update(deltaMs: number): void {
    if (this._travelling) return
    this._elapsedMs += deltaMs
    if (this._elapsedMs < CHECK_INTERVAL_MS) return
    this._elapsedMs = 0

    const map = this.context.map
    const hero = this.context.controls?.heroUnit
    if (!map || !hero || map.mapType === 'interior' || !map.worldId || !map.worldRegion) return
    const edgeToPreload = nearestEdge(hero, map, PRELOAD_MARGIN_CELLS)
    if (edgeToPreload) this.preloadNeighbor(edgeToPreload)
    const edgeToCross = nearestEdge(hero, map, CROSS_MARGIN_CELLS)
    if (edgeToCross) this.crossToNeighbor(edgeToCross)
  }

  preloadNeighbor(edge: RegionEdge): void {
    const map = this.context.map
    if (!map?.worldRegion) return
    const regionId = regionIdFor(map, neighborRegionForEdge(map.worldRegion, edge))
    if (!regionId || regionId === this._preloadingRegionId) return
    this._preloadingRegionId = regionId
    this.host.preloadWorldRegion(regionId).catch(error => {
      if (this._preloadingRegionId === regionId) this._preloadingRegionId = null
      console.warn('[world] Unable to preload neighboring region', regionId, error)
    })
  }

  crossToNeighbor(edge: RegionEdge): void {
    const map = this.context.map
    const hero = this.context.controls?.heroUnit
    if (!map?.worldRegion || !hero) return
    const regionId = regionIdFor(map, neighborRegionForEdge(map.worldRegion, edge))
    if (!regionId) return
    this._travelling = true
    const point = getEntityMapPoint(hero)
    this.context.controls?.setCamera?.(point.x, point.y)
    this.host.travelToWorldRegion(regionId, edge).catch(error => {
      this._travelling = false
      console.error('[world] Unable to travel to neighboring region', regionId, error)
      this.context.menu?.showMessage?.('Impossible de rejoindre cette région.', 'error')
    })
  }
}

export type { RegionEdge, RegionTravelHost }
