import type { SaveEntityState, SaveGridPoint, SerializedSave } from '../../types/save'

export type OfflineTerrainCell = {
  category?: string
  border?: boolean
  waterBorder?: boolean
  inclined?: boolean
  terrainHidden?: boolean
  z?: number
}

export function entityKey(entity: SaveEntityState): string {
  return entity.label ?? `${entity.type}:${entity.i}:${entity.j}`
}

export function distance(a: SaveGridPoint, b: SaveGridPoint): number {
  return Math.hypot(a.i - b.i, a.j - b.j)
}

export function isLiving(entity: SaveEntityState): boolean {
  return !entity.isDead && !entity.isDestroyed
}

/** Terrain connectivity is cached; occupancy remains mutable as nodes disappear and units move. */
export class OfflineWorldSpatial {
  private occupied = new Map<string, Set<SaveEntityState>>()
  private regions = new Map<string, number>()
  private nextRegion = 0
  private entities = new Map<string, SaveEntityState>()
  private passages = new Set<string>()
  private mobile = new Set<SaveEntityState>()

  constructor(
    private terrain: (OfflineTerrainCell | null | undefined)[][],
    state: SerializedSave,
    buildingSize: (entity: SaveEntityState, playerIndex: number) => number
  ) {
    for (const entity of [...state.resources, ...state.animals]) {
      if (!entity.isDestroyed) this.reserve(entity)
    }
    state.players.forEach((player, index) => {
      for (const unit of player.units ?? [])
        if (isLiving(unit)) {
          this.mobile.add(unit)
          this.reserve(unit)
        }
      for (const building of player.buildings ?? []) {
        if (!isLiving(building)) continue
        const radius = Math.ceil((building.size ?? buildingSize(building, index)) / 2)
        for (let i = building.i - radius; i <= building.i + radius; i++) {
          for (let j = building.j - radius; j <= building.j + radius; j++) this.reserve(building, { i, j })
        }
      }
    })
    for (const player of state.players) {
      const center = player.buildings?.find(b => b.type === 'TownCenter' && isLiving(b))
      if (center) this.protectVillageAccess(center, player.buildings ?? [])
    }
  }

  /** Preserve real walkable routes, not just terrain connectivity through occupied cells. */
  protectVillageAccess(center: SaveGridPoint, buildings: SaveEntityState[]): void {
    const walkable = (point: SaveGridPoint) =>
      this.land(point) && [...(this.occupied.get(this.key(point)) ?? [])].every(entity => this.mobile.has(entity))
    let start: SaveGridPoint | undefined
    for (let radius = 1; radius <= 6 && !start; radius++)
      for (let di = -radius; di <= radius && !start; di++)
        for (let dj = -radius; dj <= radius; dj++) {
          const point = { i: center.i + di, j: center.j + dj }
          if (walkable(point)) {
            start = point
            break
          }
        }
    if (!start) return
    const previous = new Map<string, SaveGridPoint | null>([[this.key(start), null]])
    const queue = [start]
    const extremes = [start, start, start, start]
    for (const point of queue) {
      if (point.i < extremes[0].i) extremes[0] = point
      if (point.i > extremes[1].i) extremes[1] = point
      if (point.j < extremes[2].j) extremes[2] = point
      if (point.j > extremes[3].j) extremes[3] = point
      for (const [di, dj] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const next = { i: point.i + di, j: point.j + dj }
        if (!previous.has(this.key(next)) && walkable(next)) {
          previous.set(this.key(next), point)
          queue.push(next)
        }
      }
    }
    const protect = (target: SaveGridPoint) => {
      let point: SaveGridPoint | null | undefined = target
      while (point) {
        const key = this.key(point)
        this.passages.add(key)
        point = previous.get(key)
      }
    }
    extremes.forEach(protect)
    for (const building of buildings.filter(isLiving)) {
      const target = queue.reduce(
        (best, point) => (distance(point, building) < distance(best, building) ? point : best),
        start
      )
      protect(target)
    }
  }

  private key(point: SaveGridPoint): string {
    return `${point.i}:${point.j}`
  }

  private land(point: SaveGridPoint): boolean {
    const cell = this.terrain[point.i]?.[point.j]
    return Boolean(cell && cell.category !== 'Water' && !cell.border && !cell.terrainHidden)
  }

  reserve(entity: SaveEntityState, point: SaveGridPoint = entity): void {
    this.entities.set(entityKey(entity), entity)
    const key = this.key(point)
    const occupants = this.occupied.get(key) ?? new Set<SaveEntityState>()
    occupants.add(entity)
    this.occupied.set(key, occupants)
  }

  release(entity: SaveEntityState): void {
    this.entities.delete(entityKey(entity))
    const key = this.key(entity)
    const occupants = this.occupied.get(key)
    occupants?.delete(entity)
    if (!occupants?.size) this.occupied.delete(key)
  }

  entity(label: string | undefined): SaveEntityState | undefined {
    return label ? this.entities.get(label) : undefined
  }

  available(point: SaveGridPoint, except?: SaveEntityState): boolean {
    if (!this.land(point)) return false
    const occupants = this.occupied.get(this.key(point))
    return !occupants?.size || (except !== undefined && occupants.size === 1 && occupants.has(except))
  }

  private region(point: SaveGridPoint): number | undefined {
    const key = this.key(point)
    if (this.regions.has(key)) return this.regions.get(key)
    if (!this.land(point)) return undefined
    const region = ++this.nextRegion
    const queue = [point]
    this.regions.set(key, region)
    for (const cell of queue) {
      for (const [di, dj] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const next = { i: cell.i + di, j: cell.j + dj }
        const nextKey = this.key(next)
        if (!this.land(next) || this.regions.has(nextKey)) continue
        this.regions.set(nextKey, region)
        queue.push(next)
      }
    }
    return region
  }

  reachable(from: SaveGridPoint, to: SaveGridPoint): boolean {
    const region = this.region(from)
    return region != null && region === this.region(to)
  }

  findNear(anchor: SaveGridPoint, radius = 6, unit?: SaveEntityState): SaveGridPoint | null {
    for (let ring = 0; ring <= radius; ring++) {
      for (let di = -ring; di <= ring; di++) {
        for (let dj = -ring; dj <= ring; dj++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue
          const point = { i: anchor.i + di, j: anchor.j + dj }
          if (!this.available(point, unit) || (unit && !this.reachable(unit, point))) continue
          return point
        }
      }
    }
    return null
  }

  move(entity: SaveEntityState, point: SaveGridPoint): void {
    this.release(entity)
    entity.i = point.i
    entity.j = point.j
    entity.z = this.terrain[point.i]?.[point.j]?.z ?? 0
    delete entity.x
    delete entity.y
    delete entity.zIndex
    delete entity.spaceId
    this.reserve(entity)
  }

  naturalCell(point: SaveGridPoint): boolean {
    if (!this.available(point) || this.passages.has(this.key(point))) return false
    const cell = this.terrain[point.i]?.[point.j]
    return !cell?.waterBorder && !cell?.inclined
  }
}
