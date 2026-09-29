import { CELL_WIDTH, CELL_HEIGHT, FAMILY_TYPES, PASSABLE_RESOURCE_TYPES } from '../../constants'
import type { ResourceEntity, RuntimeEntity } from '../../types/entities'
import type { BlueprintResourceDelta, SaveEntityState } from '../../types/save'

type Definition = {
  totalQuantity?: number
  totalHitPoints?: number
  quantity?: number
  hitPoints?: number
  isAnimated?: boolean
}
type RecordSource = { store: CompactResourceSet; index: number }
export const resourceSnapshotZones = new WeakMap<SaveEntityState[], Map<string, SaveEntityState[]>>()
const records = new WeakMap<object, RecordSource>()
const handles = new WeakMap<object, RecordSource>()
const ZONE_SIZE = 64
const MAX_RESIDENT_ZONE_INDICES = 64
const supportedFields = new Set([
  'i',
  'j',
  'type',
  'textureName',
  'label',
  'isNaturalResource',
  'quantity',
  'totalQuantity',
  'hitPoints',
  'size',
  'isDead',
  'isDestroyed',
  'spaceId',
  'berrybushFullTextureName',
])

/** Set-compatible boundary. Iteration materializes entities for legacy callers;
 * readValues is the data-only API used by global scans and serialization. */
export class CompactResourceSet extends Set<ResourceEntity> {
  private readonly positions: Uint32Array
  private readonly kinds: Uint16Array
  private readonly textures: Uint32Array
  private readonly quantities: Float64Array
  private readonly totals: Float64Array
  private readonly hitPoints: Float64Array
  private readonly flags: Uint8Array
  private readonly labels = new Map<number, string>()
  private readonly labelIndices = new Map<string, number>()
  private readonly berryTextures = new Map<number, string>()
  private readonly typeNames: string[] = []
  private readonly textureNames: string[] = []
  private readonly typeCodes = new Map<string, number>()
  private readonly textureCodes = new Map<string, number>()
  private readonly zones = new Map<number, number[]>()
  private readonly residentZones = new Map<number, Uint32Array>()
  private readonly growthCandidates = new Set<number>()
  private readonly active = new Map<number, ResourceEntity>()
  private saveSlots: Array<SaveEntityState | undefined> = []
  private saveJson = new Map<number, string>()
  private saveDirty = new Set<number>()
  private saveSnapshot?: SaveEntityState[]
  private saveGroups = new Map<string, SaveEntityState[]>()
  private dynamicSaveJson = ''
  private baseline?: { count: number; signature: string; legacySignature?: string; flags: Uint8Array }
  private deltaRemoved = new Set<number>()
  private deltaAdded = new Set<number>()
  private used = 0
  private count = 0
  private readonly zoneStride: number

  constructor(
    capacity: number,
    readonly stride: number,
    private readonly prefix: string,
    private readonly definition: (type: string) => Definition,
    private readonly create: (state: SaveEntityState) => ResourceEntity,
    private readonly context: unknown
  ) {
    super()
    this.positions = new Uint32Array(capacity)
    this.kinds = new Uint16Array(capacity)
    this.textures = new Uint32Array(capacity)
    this.quantities = new Float64Array(capacity)
    this.totals = new Float64Array(capacity)
    this.hitPoints = new Float64Array(capacity)
    this.flags = new Uint8Array(capacity)
    this.zoneStride = Math.ceil(stride / ZONE_SIZE)
  }

  get materializedCount(): number {
    return this.active.size + super.size
  }
  override get size(): number {
    return this.count + super.size
  }

  canPack(state: SaveEntityState): boolean {
    return Boolean(
      state.textureName &&
        !state.isDead &&
        !state.isDestroyed &&
        (state.size == null || state.size === 1) &&
        (!state.spaceId || state.spaceId === 'outside') &&
        !this.definition(state.type)?.isAnimated &&
        Object.keys(state).every(key => supportedFields.has(key))
    )
  }

  private intern(value: string, codes: Map<string, number>, names: string[]): number {
    let code = codes.get(value)
    if (code === undefined) {
      code = names.length
      names.push(value)
      codes.set(value, code)
    }
    return code
  }

  addState(state: SaveEntityState): void {
    if (!this.canPack(state)) {
      this.add(this.create(state))
      return
    }
    if (this.used >= this.positions.length) throw new Error('Compact resource capacity exceeded')
    const index = this.used++
    const definition = this.definition(state.type)
    this.positions[index] = state.i * this.stride + state.j
    this.kinds[index] = this.intern(state.type, this.typeCodes, this.typeNames)
    this.textures[index] = this.intern(state.textureName!, this.textureCodes, this.textureNames)
    this.totals[index] = state.totalQuantity ?? definition.totalQuantity ?? 0
    this.quantities[index] = state.quantity ?? definition.quantity ?? this.totals[index]
    if (state.type === 'Berrybush' && this.quantities[index] < this.totals[index]) this.growthCandidates.add(index)
    this.hitPoints[index] = state.hitPoints ?? definition.hitPoints ?? definition.totalHitPoints ?? 0
    this.flags[index] = 1 | (state.isNaturalResource ? 2 : 0)
    if (state.label && state.label !== `${this.prefix}:${this.positions[index]}`) {
      this.labels.set(index, state.label)
      this.labelIndices.set(state.label, index)
    }
    if (state.berrybushFullTextureName) this.berryTextures.set(index, state.berrybushFullTextureName)
    const key = Math.floor(state.i / ZONE_SIZE) * this.zoneStride + Math.floor(state.j / ZONE_SIZE)
    let zone = this.zones.get(key)
    if (!zone) this.zones.set(key, (zone = []))
    zone.push(index + 1)
    const resident = this.residentZones.get(key)
    if (resident) resident[(state.i % ZONE_SIZE) * ZONE_SIZE + (state.j % ZONE_SIZE)] = index + 1
    this.saveDirty.add(index)
    if (this.baseline) this.deltaAdded.add(index)
    this.count++
  }

  *initialGrowthValues(): Iterable<ResourceEntity> {
    for (const index of this.growthCandidates) if (this.flags[index] & 1) yield this.materialize(index)
    yield* this.materializedValues()
  }

  get residentZoneCount(): number {
    return this.residentZones.size
  }

  private indexAt(i: number, j: number): number {
    if (i < 0 || j < 0 || i >= this.stride || j >= this.stride) return -1
    const key = Math.floor(i / ZONE_SIZE) * this.zoneStride + Math.floor(j / ZONE_SIZE)
    const slots = this.zones.get(key)
    if (!slots) return -1
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
    if (this.residentZones.size > MAX_RESIDENT_ZONE_INDICES)
      this.residentZones.delete(this.residentZones.keys().next().value!)
    return zone[(i % ZONE_SIZE) * ZONE_SIZE + (j % ZONE_SIZE)] - 1
  }

  hasAtCell(index: number): boolean {
    const slot = this.indexAt(Math.floor(index / this.stride), index % this.stride)
    return slot >= 0 && Boolean(this.flags[slot] & 1)
  }

  atCell(index: number): ResourceEntity | null {
    const slot = this.indexAt(Math.floor(index / this.stride), index % this.stride)
    return slot >= 0 && this.flags[slot] & 1 ? this.materialize(slot) : null
  }

  byLabel(label: string): ResourceEntity | null {
    let index = this.labelIndices.get(label)
    if (index === undefined && label.startsWith(`${this.prefix}:`)) {
      const position = Number(label.slice(this.prefix.length + 1))
      if (Number.isSafeInteger(position) && position >= 0 && position < this.stride * this.stride) {
        const candidate = this.indexAt(Math.floor(position / this.stride), position % this.stride)
        if (candidate >= 0 && !this.labels.has(candidate)) index = candidate
      }
    }
    if (index !== undefined && this.flags[index] & 1) return this.materialize(index)
    for (const resource of super.values()) if (resource.label === label) return resource
    return null
  }

  isSolidAt(index: number): boolean {
    const slot = this.indexAt(Math.floor(index / this.stride), index % this.stride)
    return slot >= 0 && Boolean(this.flags[slot] & 1) && !PASSABLE_RESOURCE_TYPES.has(this.typeNames[this.kinds[slot]])
  }

  private state(index: number): SaveEntityState {
    const position = this.positions[index]
    return {
      label: this.labels.get(index) ?? `${this.prefix}:${position}`,
      i: Math.floor(position / this.stride),
      j: position % this.stride,
      type: this.typeNames[this.kinds[index]],
      textureName: this.textureNames[this.textures[index]],
      quantity: this.quantities[index],
      totalQuantity: this.totals[index],
      hitPoints: this.hitPoints[index],
      isNaturalResource: Boolean(this.flags[index] & 2),
      isDead: false,
      isDestroyed: false,
      size: 1,
      ...(this.berryTextures.has(index) ? { berrybushFullTextureName: this.berryTextures.get(index) } : {}),
    }
  }

  materialize(index: number): ResourceEntity {
    const existing = this.active.get(index)
    if (existing) return existing
    if (!(this.flags[index] & 1)) throw new Error('Resource no longer exists')
    const resource = this.create(this.state(index))
    this.active.set(index, resource)
    handles.set(resource, { store: this, index })
    return resource
  }

  currentRecord(index: number): ResourceEntity | null {
    return this.flags[index] & 1 ? this.read(index) : null
  }

  private read(index: number): ResourceEntity {
    const active = this.active.get(index)
    if (active) return active
    const state = this.state(index)
    // A read record is never an interaction target until resolveResource is called.
    const record = Object.assign(Object.create(this.definition(state.type)), state, {
      family: FAMILY_TYPES.resource,
      context: this.context,
      x: ((state.i - state.j) * CELL_WIDTH) / 2,
      y: ((state.i + state.j) * CELL_HEIGHT) / 2,
    }) as ResourceEntity
    records.set(record, { store: this, index })
    return record
  }

  /** Seal once, before village placement or gameplay can alter the blueprint. No entity snapshots are retained. */
  sealBlueprintBaseline(legacyTotals?: number[]): void {
    const signature = (totals: Float64Array) => {
      let hash = 2166136261
      const consume = (bytes: Uint8Array) => {
        for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0
      }
      for (const array of [
        this.positions,
        this.kinds,
        this.textures,
        this.quantities,
        totals,
        this.hitPoints,
        this.flags,
      ])
        consume(new Uint8Array(array.buffer, array.byteOffset, this.used * array.BYTES_PER_ELEMENT))
      consume(
        new TextEncoder().encode(
          JSON.stringify([this.prefix, this.typeNames, this.textureNames, [...this.labels], [...this.berryTextures]])
        )
      )
      return hash.toString(16)
    }
    this.baseline = {
      count: this.used,
      signature: signature(this.totals),
      // Accept saves made before legacy map capacities were inferred from their
      // initial stock, while still validating all other blueprint contents.
      ...(legacyTotals?.length === this.used ? { legacySignature: signature(Float64Array.from(legacyTotals)) } : {}),
      flags: this.flags.slice(0, this.used),
    }
    this.deltaRemoved.clear()
    this.deltaAdded.clear()
  }

  private baselineState(index: number): ResourceEntity {
    const state = this.state(index)
    state.isNaturalResource = Boolean(this.baseline!.flags[index] & 2)
    return Object.assign(Object.create(this.definition(state.type)), state) as ResourceEntity
  }

  private sameResource(a: SaveEntityState, b: SaveEntityState): boolean {
    const normalize = (state: SaveEntityState) => {
      const value = { size: 1, isDead: false, isDestroyed: false, isNaturalResource: false, ...state }
      if (!this.definition(state.type)?.isAnimated && value.currentFrame === 0) delete value.currentFrame
      return JSON.stringify(
        Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
      )
    }
    return normalize(a) === normalize(b)
  }

  saveDelta(
    serialize: (resource: ResourceEntity) => SaveEntityState
  ): { resourceDelta: BlueprintResourceDelta; resources: SaveEntityState[] } | null {
    if (!this.baseline) return null
    const updated: BlueprintResourceDelta['updated'] = []
    for (const [index, resource] of this.active) {
      if (index >= this.baseline.count || !(this.flags[index] & 1)) continue
      const state = serialize(resource)
      if (!this.sameResource(state, serialize(this.baselineState(index)))) updated.push({ index, state })
    }
    const resources: SaveEntityState[] = []
    for (const index of this.deltaAdded) if (this.flags[index] & 1) resources.push(serialize(this.read(index)))
    for (const resource of super.values()) resources.push(serialize(resource))
    updated.sort((a, b) => a.index - b.index)
    return {
      resources,
      resourceDelta: {
        version: 1,
        count: this.baseline.count,
        signature: this.baseline.signature,
        removed: [...this.deltaRemoved].sort((a, b) => a - b),
        updated,
      },
    }
  }

  assertBlueprintDelta(delta: BlueprintResourceDelta): void {
    if (
      !this.baseline ||
      delta.version !== 1 ||
      delta.count !== this.baseline.count ||
      (delta.signature !== this.baseline.signature && delta.signature !== this.baseline.legacySignature)
    )
      throw new Error('SAVE_RESOURCE_BLUEPRINT_MISMATCH')
    const seen = new Set<number>()
    for (const index of [...delta.removed, ...delta.updated.map(entry => entry.index)]) {
      if (!Number.isInteger(index) || index < 0 || index >= delta.count || seen.has(index))
        throw new Error('SAVE_RESOURCE_DELTA_CORRUPT')
      seen.add(index)
    }
  }

  /** Used only when an offline simulation explicitly needs a full detached resource list. */
  expandDelta(
    delta: BlueprintResourceDelta,
    resources: SaveEntityState[],
    serialize: (resource: ResourceEntity) => SaveEntityState
  ): SaveEntityState[] {
    this.assertBlueprintDelta(delta)
    const removed = new Set(delta.removed)
    const updated = new Map(delta.updated.map(entry => [entry.index, entry.state]))
    const result: SaveEntityState[] = []
    for (let index = 0; index < delta.count; index++)
      if (!removed.has(index)) result.push(updated.get(index) ?? serialize(this.baselineState(index)))
    return [...result, ...resources]
  }

  /** One-time migration of a legacy/full simulation snapshot, never the normal save-button path. */
  deltaFromFullSave(
    resources: SaveEntityState[],
    serialize: (resource: ResourceEntity) => SaveEntityState
  ): ReturnType<CompactResourceSet['saveDelta']> {
    if (!this.baseline) return null
    const seen = new Set<number>()
    const updated: BlueprintResourceDelta['updated'] = []
    const added: SaveEntityState[] = []
    for (const state of resources) {
      const index = this.indexAt(state.i, state.j)
      if (index < 0 || index >= this.baseline.count || seen.has(index)) {
        added.push(state)
        continue
      }
      const original = serialize(this.baselineState(index))
      if (state.label !== original.label || state.type !== original.type) {
        added.push(state)
        continue
      }
      seen.add(index)
      if (!this.sameResource(state, original)) updated.push({ index, state })
    }
    const removed: number[] = []
    for (let index = 0; index < this.baseline.count; index++) if (!seen.has(index)) removed.push(index)
    return {
      resources: added,
      resourceDelta: { version: 1, count: this.baseline.count, signature: this.baseline.signature, removed, updated },
    }
  }

  /** Reuse the newly generated packed baseline after its generated visuals have been cleared. */
  restoreDelta(delta: BlueprintResourceDelta, resources: SaveEntityState[], markSolid: (index: number) => void): void {
    this.assertBlueprintDelta(delta)
    super.clear()
    this.active.clear()
    this.used = this.baseline!.count
    this.flags.fill(0)
    this.flags.set(this.baseline!.flags)
    this.deltaRemoved = new Set(delta.removed)
    this.deltaAdded.clear()
    for (const index of delta.removed) this.flags[index] &= ~1
    this.count = this.used - delta.removed.length
    this.saveSlots = []
    this.saveJson.clear()
    this.saveDirty.clear()
    this.saveSnapshot = undefined
    this.saveGroups.clear()
    this.dynamicSaveJson = ''
    this.residentZones.clear()
    for (const [key, slots] of this.zones)
      this.zones.set(
        key,
        slots.filter(slot => slot <= this.used)
      )
    for (let index = 0; index < this.used; index++)
      if (this.flags[index] & 1 && !PASSABLE_RESOURCE_TYPES.has(this.typeNames[this.kinds[index]]))
        markSolid(this.positions[index])
    for (const { index, state } of delta.updated) {
      const resource = this.create(state)
      this.active.set(index, resource)
      handles.set(resource, { store: this, index })
    }
    for (const state of resources) super.add(this.create(state))
  }

  /** Cold records are immutable; only live handles and explicit add/delete operations can dirty their zones. */
  saveValues(serialize: (resource: ResourceEntity) => SaveEntityState): SaveEntityState[] {
    const dirtyZones = new Set<number>()
    if (!this.saveSnapshot) for (let i = 0; i < this.used; i++) this.saveDirty.add(i)
    for (const index of this.active.keys()) this.saveDirty.add(index)
    for (const index of this.saveDirty) {
      const value = this.flags[index] & 1 ? serialize(this.read(index)) : undefined
      const json = value ? JSON.stringify(value) : ''
      if (this.saveJson.get(index) === json) continue
      if (this.active.has(index)) this.saveJson.set(index, json)
      this.saveSlots[index] = value
      const position = this.positions[index]
      dirtyZones.add(
        Math.floor(Math.floor(position / this.stride) / ZONE_SIZE) * this.zoneStride +
          Math.floor((position % this.stride) / ZONE_SIZE)
      )
    }
    this.saveDirty.clear()
    const dynamic = [...super.values()].map(serialize)
    const dynamicJson = JSON.stringify(dynamic)
    if (this.saveSnapshot && !dirtyZones.size && dynamicJson === this.dynamicSaveJson) return this.saveSnapshot
    const groups = new Map(this.saveGroups)
    for (const key of dirtyZones) {
      groups.set(
        `${Math.floor(key / this.zoneStride)}:${key % this.zoneStride}`,
        (this.zones.get(key) ?? [])
          .map(slot => this.saveSlots[slot - 1])
          .filter((value): value is SaveEntityState => Boolean(value))
      )
    }
    // Dynamic/animated resources are deliberately serialized each time to retain their timers and state.
    if (dynamicJson !== this.dynamicSaveJson || !this.saveSnapshot) groups.set('dynamic', dynamic)
    this.dynamicSaveJson = dynamicJson
    this.saveGroups = groups
    this.saveSnapshot = [...this.saveSlots.filter((value): value is SaveEntityState => Boolean(value)), ...dynamic]
    resourceSnapshotZones.set(this.saveSnapshot, groups)
    return this.saveSnapshot
  }

  *readValues(type?: string): IterableIterator<ResourceEntity> {
    const code = type == null ? undefined : this.typeCodes.get(type)
    for (let index = 0; index < this.used; index++) {
      if (!(this.flags[index] & 1) || (type != null && this.kinds[index] !== code)) continue
      yield this.read(index)
    }
    for (const resource of super.values()) if (!type || resource.type === type) yield resource
  }

  nearest(
    type: string,
    i: number,
    j: number,
    limit: number,
    accepts: (resource: ResourceEntity) => boolean
  ): ResourceEntity[] {
    if (limit <= 0) return []
    if (!Number.isFinite(limit)) return [...this.readValues(type)].filter(accepts)
    const code = this.typeCodes.get(type)
    if (code === undefined) return [...super.values()].filter(resource => resource.type === type && accepts(resource))
    const zones = [...this.zones.keys()]
      .map(key => {
        const minI = Math.floor(key / this.zoneStride) * ZONE_SIZE
        const minJ = (key % this.zoneStride) * ZONE_SIZE
        const distance =
          Math.max(minI - i, 0, i - minI - ZONE_SIZE + 1) + Math.max(minJ - j, 0, j - minJ - ZONE_SIZE + 1)
        return { key, distance }
      })
      .sort((a, b) => a.distance - b.distance)
    const best: { index: number; distance: number; resource: ResourceEntity }[] = []
    for (const zone of zones) {
      if (best.length >= limit && zone.distance > best[best.length - 1].distance) break
      const slots = this.zones.get(zone.key)!
      const seenPositions = new Set<number>()
      for (let offset = slots.length - 1; offset >= 0; offset--) {
        const index = slots[offset] - 1
        const position = this.positions[index]
        if (seenPositions.has(position)) continue
        seenPositions.add(position)
        if (!(this.flags[index] & 1) || this.kinds[index] !== code) continue
        const distance = Math.abs(Math.floor(position / this.stride) - i) + Math.abs((position % this.stride) - j)
        const last = best[best.length - 1]
        if (best.length >= limit && (distance > last.distance || (distance === last.distance && index > last.index)))
          continue
        const resource = this.read(index)
        if (!accepts(resource)) continue
        best.push({ index, distance, resource })
        best.sort((a, b) => a.distance - b.distance || a.index - b.index)
        if (best.length > limit) best.pop()
      }
    }
    // Preserve source ordering for the existing stable candidate ranking.
    const result = best.sort((a, b) => a.index - b.index).map(value => value.resource)
    for (const resource of super.values()) if (resource.type === type && accepts(resource)) result.push(resource)
    return result
  }

  *readArea(
    minI: number,
    minJ: number,
    maxI: number,
    maxJ: number,
    includeActive = false
  ): IterableIterator<ResourceEntity> {
    for (let i = Math.max(0, Math.floor(minI)); i <= Math.min(this.stride - 1, Math.ceil(maxI)); i++) {
      for (let j = Math.max(0, Math.floor(minJ)); j <= Math.min(this.stride - 1, Math.ceil(maxJ)); j++) {
        const index = this.indexAt(i, j)
        if (index >= 0 && this.flags[index] & 1 && (includeActive || !this.active.has(index))) yield this.read(index)
      }
    }
  }

  *materializedValues(): IterableIterator<ResourceEntity> {
    for (const [index, resource] of this.active) if (this.flags[index] & 1) yield resource
    yield* super.values()
  }

  override add(resource: ResourceEntity): this {
    const source = handles.get(resource)
    if (source?.store === this && this.active.get(source.index) === resource) {
      if (!(this.flags[source.index] & 1)) {
        this.saveDirty.add(source.index)
        this.deltaRemoved.delete(source.index)
        this.flags[source.index] |= 1
        this.count++
      }
    } else super.add(resource)
    return this
  }
  override has(resource: ResourceEntity): boolean {
    const source = handles.get(resource)
    return source?.store === this && this.active.get(source.index) === resource
      ? Boolean(this.flags[source.index] & 1)
      : super.has(resource)
  }
  override delete(resource: ResourceEntity): boolean {
    const source = handles.get(resource)
    if (source?.store !== this || this.active.get(source.index) !== resource) return super.delete(resource)
    if (!(this.flags[source.index] & 1)) return false
    this.saveDirty.add(source.index)
    if (this.baseline && source.index < this.baseline.count) this.deltaRemoved.add(source.index)
    this.flags[source.index] &= ~1
    this.count--
    return true
  }
  override clear(): void {
    super.clear()
    if (this.baseline) for (let index = 0; index < this.baseline.count; index++) this.deltaRemoved.add(index)
    for (let index = 0; index < this.used; index++) this.saveDirty.add(index)
    this.flags.fill(0)
    this.count = 0
    this.zones.clear()
    this.residentZones.clear()
    this.active.clear()
  }
  override *values(): SetIterator<ResourceEntity> {
    for (let index = 0; index < this.used; index++) if (this.flags[index] & 1) yield this.materialize(index)
    yield* super.values()
  }
  override keys(): SetIterator<ResourceEntity> {
    return this.values()
  }
  override [Symbol.iterator](): SetIterator<ResourceEntity> {
    return this.values()
  }
  override *entries(): SetIterator<[ResourceEntity, ResourceEntity]> {
    for (const value of this.values()) yield [value, value]
  }
  override forEach(
    callback: (value: ResourceEntity, key: ResourceEntity, set: Set<ResourceEntity>) => void,
    thisArg?: unknown
  ): void {
    for (const value of this.values()) callback.call(thisArg, value, value, this)
  }
}

export function resourceReadValues(resources?: Iterable<ResourceEntity>, type?: string): Iterable<ResourceEntity> {
  if (resources instanceof CompactResourceSet) return resources.readValues(type)
  return type ? [...(resources ?? [])].filter(resource => resource.type === type) : (resources ?? [])
}
export function materializedResources(resources: Iterable<ResourceEntity>): Iterable<ResourceEntity> {
  return resources instanceof CompactResourceSet ? resources.materializedValues() : resources
}
export function isCompactResourceRecord(value: object): boolean {
  return records.has(value)
}
export function resolveResource<T extends RuntimeEntity>(value: T): T {
  const source = records.get(value)
  return source ? (source.store.materialize(source.index) as T) : value
}

export function nearestResourceRecords(
  resources: Iterable<ResourceEntity> | undefined,
  type: string,
  point: { i: number; j: number },
  limit: number,
  accepts: (resource: ResourceEntity) => boolean
): Iterable<ResourceEntity> {
  return resources instanceof CompactResourceSet
    ? resources.nearest(type, point.i, point.j, limit, accepts)
    : resourceReadValues(resources, type)
}

/** Refresh a cold read without creating a gameplay entity. */
export function currentResourceRecord(resource: ResourceEntity): ResourceEntity | null {
  const source = records.get(resource)
  return source ? source.store.currentRecord(source.index) : resource
}
