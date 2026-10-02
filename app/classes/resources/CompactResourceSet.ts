import { restoredResourceState } from '../../serialization/ResourceSaveData'
import { CELL_WIDTH, CELL_HEIGHT, FAMILY_TYPES, PASSABLE_RESOURCE_TYPES } from '../../constants'
import type { ResourceEntity, RuntimeEntity } from '../../types/entities'
import type { BlueprintResourceDelta, SaveEntityState } from '../../types/save'
import {
  blueprintSignature,
  fullSaveDelta,
  sameResourceState,
  validateBlueprintDelta,
  type BlueprintBaseline,
} from './CompactResourceDelta'
import {
  canPackResource,
  generatedLabelPosition,
  packedResourceValues,
  type ResourceDefinition,
} from './CompactResourcePacking'
import { CompactResourceSaveCache } from './CompactResourceSaveCache'
import { ResourceZoneIndex } from './ResourceZoneIndex'
export { resourceSnapshotZones } from './CompactResourceSaveCache'

type RecordSource = { store: CompactResourceSet; index: number }
type MapResourceVisitor = (i: number, j: number, type: string, spaceId: string) => void
const records = new WeakMap<object, RecordSource>()
const handles = new WeakMap<object, RecordSource>()

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
  private readonly zones: ResourceZoneIndex
  private readonly growthCandidates = new Set<number>()
  private readonly active = new Map<number, ResourceEntity>()
  private readonly saveCache = new CompactResourceSaveCache()
  private baseline?: BlueprintBaseline
  private deltaRemoved = new Set<number>()
  private deltaAdded = new Set<number>()
  private used = 0
  private count = 0

  constructor(
    capacity: number,
    readonly stride: number,
    private readonly prefix: string,
    private readonly definition: (type: string) => ResourceDefinition,
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
    this.zones = new ResourceZoneIndex(stride, this.positions)
  }

  get materializedCount(): number {
    return this.active.size + super.size
  }
  override get size(): number {
    return this.count + super.size
  }

  canPack(state: SaveEntityState): boolean {
    return canPackResource(state, this.definition)
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
    const textureName = state.textureName
    if (!textureName || !this.canPack(state)) {
      this.add(this.create(state))
      return
    }
    if (this.used >= this.positions.length) throw new Error('Compact resource capacity exceeded')
    const index = this.used++
    const values = packedResourceValues(state, this.definition(state.type))
    this.positions[index] = state.i * this.stride + state.j
    this.kinds[index] = this.intern(state.type, this.typeCodes, this.typeNames)
    this.textures[index] = this.intern(textureName, this.textureCodes, this.textureNames)
    this.totals[index] = values.total
    this.quantities[index] = values.quantity
    if (state.type === 'Berrybush' && this.quantities[index] < this.totals[index]) this.growthCandidates.add(index)
    this.hitPoints[index] = values.hitPoints
    this.flags[index] = values.flags
    if (state.label && state.label !== `${this.prefix}:${this.positions[index]}`) {
      this.labels.set(index, state.label)
      this.labelIndices.set(state.label, index)
    }
    if (state.berrybushFullTextureName) this.berryTextures.set(index, state.berrybushFullTextureName)
    this.zones.insert(index, state.i, state.j)
    this.saveCache.markDirty(index)
    if (this.baseline) this.deltaAdded.add(index)
    this.count++
  }

  *initialGrowthValues(): Iterable<ResourceEntity> {
    for (const index of this.growthCandidates) if (this.flags[index] & 1) yield this.materialize(index)
    yield* this.materializedValues()
  }

  get residentZoneCount(): number {
    return this.zones.residentCount
  }

  private indexAt(i: number, j: number): number {
    return this.zones.slotAt(i, j)
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
    const index = this.labelIndices.get(label) ?? this.generatedLabelIndex(label)
    if (index !== undefined && this.flags[index] & 1) return this.materialize(index)
    for (const resource of super.values()) if (resource.label === label) return resource
    return null
  }

  private generatedLabelIndex(label: string): number | undefined {
    const position = generatedLabelPosition(label, this.prefix, this.stride * this.stride)
    if (position === undefined) return undefined
    const candidate = this.indexAt(Math.floor(position / this.stride), position % this.stride)
    return candidate >= 0 && !this.labels.has(candidate) ? candidate : undefined
  }

  isSolidAt(index: number): boolean {
    const slot = this.indexAt(Math.floor(index / this.stride), index % this.stride)
    return slot >= 0 && this.isSolidSlot(slot)
  }

  private isSolidSlot(slot: number): boolean {
    return Boolean(this.flags[slot] & 1) && !PASSABLE_RESOURCE_TYPES.has(this.typeNames[this.kinds[slot]])
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
    const signature = (totals: Float64Array) =>
      blueprintSignature(
        [this.positions, this.kinds, this.textures, this.quantities, totals, this.hitPoints, this.flags],
        this.used,
        [this.prefix, this.typeNames, this.textureNames, [...this.labels], [...this.berryTextures]]
      )
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

  private baselineState(index: number, baseline: BlueprintBaseline): ResourceEntity {
    const state = this.state(index)
    state.isNaturalResource = Boolean(baseline.flags[index] & 2)
    return Object.assign(Object.create(this.definition(state.type)), state) as ResourceEntity
  }

  saveDelta(
    serialize: (resource: ResourceEntity) => SaveEntityState
  ): { resourceDelta: BlueprintResourceDelta; resources: SaveEntityState[] } | null {
    const baseline = this.baseline
    if (!baseline) return null
    const updated: BlueprintResourceDelta['updated'] = []
    for (const [index, resource] of this.active) {
      if (index >= baseline.count || !(this.flags[index] & 1)) continue
      const state = serialize(resource)
      if (!sameResourceState(state, serialize(this.baselineState(index, baseline)), this.definition))
        updated.push({ index, state })
    }
    const resources: SaveEntityState[] = []
    for (const index of this.deltaAdded) if (this.flags[index] & 1) resources.push(serialize(this.read(index)))
    for (const resource of super.values()) resources.push(serialize(resource))
    updated.sort((a, b) => a.index - b.index)
    return {
      resources,
      resourceDelta: {
        version: 1,
        count: baseline.count,
        signature: baseline.signature,
        removed: [...this.deltaRemoved].sort((a, b) => a - b),
        updated,
      },
    }
  }

  assertBlueprintDelta(delta: BlueprintResourceDelta): void {
    validateBlueprintDelta(this.baseline, delta)
  }

  /** Used only when an offline simulation explicitly needs a full detached resource list. */
  expandDelta(
    delta: BlueprintResourceDelta,
    resources: SaveEntityState[],
    serialize: (resource: ResourceEntity) => SaveEntityState
  ): SaveEntityState[] {
    const baseline = validateBlueprintDelta(this.baseline, delta)
    const removed = new Set(delta.removed)
    const updated = new Map(delta.updated.map(entry => [entry.index, entry.state]))
    const result: SaveEntityState[] = []
    for (let index = 0; index < delta.count; index++)
      if (!removed.has(index)) result.push(updated.get(index) ?? serialize(this.baselineState(index, baseline)))
    return [...result, ...resources]
  }

  /** One-time migration of a legacy/full simulation snapshot, never the normal save-button path. */
  deltaFromFullSave(
    resources: SaveEntityState[],
    serialize: (resource: ResourceEntity) => SaveEntityState
  ): ReturnType<CompactResourceSet['saveDelta']> {
    const baseline = this.baseline
    if (!baseline) return null
    return fullSaveDelta(
      baseline,
      resources,
      (i, j) => this.indexAt(i, j),
      index => serialize(this.baselineState(index, baseline)),
      this.definition
    )
  }

  /** Reuse the newly generated packed baseline after its generated visuals have been cleared. */
  restoreDelta(delta: BlueprintResourceDelta, resources: SaveEntityState[], markSolid: (index: number) => void): void {
    const baseline = validateBlueprintDelta(this.baseline, delta)
    super.clear()
    this.active.clear()
    this.used = baseline.count
    this.flags.fill(0)
    this.flags.set(baseline.flags)
    this.deltaRemoved = new Set(delta.removed)
    this.deltaAdded.clear()
    for (const index of delta.removed) this.flags[index] &= ~1
    this.count = this.used - delta.removed.length
    this.saveCache.reset()
    this.zones.truncate(this.used)
    for (let index = 0; index < this.used; index++) if (this.isSolidSlot(index)) markSolid(this.positions[index])
    for (const { index, state } of delta.updated) {
      const resource = this.create(restoredResourceState(state))
      this.active.set(index, resource)
      handles.set(resource, { store: this, index })
    }
    for (const state of resources) super.add(this.create(restoredResourceState(state)))
  }

  saveValues(serialize: (resource: ResourceEntity) => SaveEntityState): SaveEntityState[] {
    return this.saveCache.values(
      {
        used: this.used,
        active: this.active,
        zones: this.zones,
        current: index => this.currentRecord(index),
        dynamic: () => super.values(),
      },
      serialize
    )
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
    // Preserve source ordering for the existing stable candidate ranking.
    const result = this.zones.nearest(
      i,
      j,
      limit,
      index => Boolean(this.flags[index] & 1) && this.kinds[index] === code,
      index => {
        const resource = this.read(index)
        return accepts(resource) ? resource : undefined
      }
    )
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

  /** Map overview data only, without allocating records or constructing resource entities. */
  visitMapResources(visit: MapResourceVisitor): void {
    for (let index = 0; index < this.used; index++) {
      if (!(this.flags[index] & 1)) continue
      const active = this.active.get(index)
      if (active) visitLiveResource(active, visit)
      else {
        const position = this.positions[index]
        visit(Math.floor(position / this.stride), position % this.stride, this.typeNames[this.kinds[index]], 'outside')
      }
    }
    for (const resource of super.values()) visitLiveResource(resource, visit)
  }

  override add(resource: ResourceEntity): this {
    const source = handles.get(resource)
    if (source?.store === this && this.active.get(source.index) === resource) {
      if (!(this.flags[source.index] & 1)) {
        this.saveCache.markDirty(source.index)
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
    this.saveCache.markDirty(source.index)
    if (this.baseline && source.index < this.baseline.count) this.deltaRemoved.add(source.index)
    this.flags[source.index] &= ~1
    this.count--
    return true
  }
  override clear(): void {
    super.clear()
    if (this.baseline) for (let index = 0; index < this.baseline.count; index++) this.deltaRemoved.add(index)
    for (let index = 0; index < this.used; index++) this.saveCache.markDirty(index)
    this.flags.fill(0)
    this.count = 0
    this.zones.clear()
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

function visitLiveResource(resource: ResourceEntity, visit: MapResourceVisitor): void {
  if (!resource.isDead && !resource.isDestroyed)
    visit(resource.i, resource.j, resource.type, resource.spaceId || 'outside')
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
