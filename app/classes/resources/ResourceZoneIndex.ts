const ZONE_SIZE = 64
const MAX_RESIDENT_ZONE_INDICES = 64

type NearestCandidate<T> = { index: number; distance: number; value: T }

/** Sparse 64x64 zones of packed slots (index + 1), with a bounded cache of dense cell lookups. */
export class ResourceZoneIndex {
  private readonly zones = new Map<number, number[]>()
  private readonly residentZones = new Map<number, Uint32Array>()
  private readonly zoneStride: number

  constructor(
    private readonly stride: number,
    private readonly positions: Uint32Array
  ) {
    this.zoneStride = Math.ceil(stride / ZONE_SIZE)
  }

  get residentCount(): number {
    return this.residentZones.size
  }

  key(i: number, j: number): number {
    return Math.floor(i / ZONE_SIZE) * this.zoneStride + Math.floor(j / ZONE_SIZE)
  }

  slotZone(index: number): number {
    const position = this.positions[index]
    return this.key(Math.floor(position / this.stride), position % this.stride)
  }

  label(key: number): string {
    return `${Math.floor(key / this.zoneStride)}:${key % this.zoneStride}`
  }

  slots(key: number): number[] {
    return this.zones.get(key) ?? []
  }

  insert(index: number, i: number, j: number): void {
    const key = this.key(i, j)
    let zone = this.zones.get(key)
    if (!zone) this.zones.set(key, (zone = []))
    zone.push(index + 1)
    const resident = this.residentZones.get(key)
    if (resident) resident[(i % ZONE_SIZE) * ZONE_SIZE + (j % ZONE_SIZE)] = index + 1
  }

  slotAt(i: number, j: number): number {
    if (i < 0 || j < 0 || i >= this.stride || j >= this.stride) return -1
    const key = this.key(i, j)
    const slots = this.zones.get(key)
    if (!slots) return -1
    return this.residentZone(key, slots)[(i % ZONE_SIZE) * ZONE_SIZE + (j % ZONE_SIZE)] - 1
  }

  clear(): void {
    this.zones.clear()
    this.residentZones.clear()
  }

  /** Forget slots added after the first `used` records. */
  truncate(used: number): void {
    this.residentZones.clear()
    for (const [key, slots] of this.zones)
      this.zones.set(
        key,
        slots.filter(slot => slot <= used)
      )
  }

  /** Closest live slots, ties broken by slot order; the result keeps slot order. */
  nearest<T>(
    i: number,
    j: number,
    limit: number,
    live: (index: number) => boolean,
    accept: (index: number) => T | undefined
  ): T[] {
    const zones = [...this.zones]
      .map(([key, slots]) => ({ slots, distance: this.zoneDistance(key, i, j) }))
      .sort((a, b) => a.distance - b.distance)
    const best: NearestCandidate<T>[] = []
    for (const zone of zones) {
      if (best.length >= limit && zone.distance > best[best.length - 1].distance) break
      this.scanZone(zone.slots, i, j, limit, best, live, accept)
    }
    return best.sort((a, b) => a.index - b.index).map(candidate => candidate.value)
  }

  private residentZone(key: number, slots: number[]): Uint32Array {
    let zone = this.residentZones.get(key)
    if (zone) this.residentZones.delete(key)
    else {
      zone = new Uint32Array(ZONE_SIZE * ZONE_SIZE)
      for (const slot of slots) {
        const position = this.positions[slot - 1]
        const localI = Math.floor(position / this.stride) % ZONE_SIZE
        const localJ = (position % this.stride) % ZONE_SIZE
        zone[localI * ZONE_SIZE + localJ] = slot
      }
    }
    this.residentZones.set(key, zone)
    if (this.residentZones.size > MAX_RESIDENT_ZONE_INDICES) {
      const oldest = this.residentZones.keys().next()
      if (!oldest.done) this.residentZones.delete(oldest.value)
    }
    return zone
  }

  private zoneDistance(key: number, i: number, j: number): number {
    const minI = Math.floor(key / this.zoneStride) * ZONE_SIZE
    const minJ = (key % this.zoneStride) * ZONE_SIZE
    return Math.max(minI - i, 0, i - minI - ZONE_SIZE + 1) + Math.max(minJ - j, 0, j - minJ - ZONE_SIZE + 1)
  }

  private scanZone<T>(
    slots: number[],
    i: number,
    j: number,
    limit: number,
    best: NearestCandidate<T>[],
    live: (index: number) => boolean,
    accept: (index: number) => T | undefined
  ): void {
    const seenPositions = new Set<number>()
    for (let offset = slots.length - 1; offset >= 0; offset--) {
      const index = slots[offset] - 1
      const position = this.positions[index]
      if (seenPositions.has(position)) continue
      seenPositions.add(position)
      if (!live(index)) continue
      const distance = Math.abs(Math.floor(position / this.stride) - i) + Math.abs((position % this.stride) - j)
      const last = best[best.length - 1]
      if (best.length >= limit && (distance > last.distance || (distance === last.distance && index > last.index)))
        continue
      const value = accept(index)
      if (value === undefined) continue
      best.push({ index, distance, value })
      best.sort((a, b) => a.distance - b.distance || a.index - b.index)
      if (best.length > limit) best.pop()
    }
  }
}
