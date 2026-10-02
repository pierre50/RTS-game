import type { ResourceEntity } from '../../types/entities'
import type { SaveEntityState } from '../../types/save'
import type { ResourceZoneIndex } from './ResourceZoneIndex'

export const resourceSnapshotZones = new WeakMap<SaveEntityState[], Map<string, SaveEntityState[]>>()

type Serialize = (resource: ResourceEntity) => SaveEntityState
export type SaveCacheSource = {
  used: number
  active: ReadonlyMap<number, ResourceEntity>
  zones: ResourceZoneIndex
  current: (index: number) => ResourceEntity | null
  dynamic: () => Iterable<ResourceEntity>
}

const isSaved = (value: SaveEntityState | undefined): value is SaveEntityState => Boolean(value)

/** Cold records are immutable; only live handles and explicit add/delete operations can dirty their zones. */
export class CompactResourceSaveCache {
  private slots: Array<SaveEntityState | undefined> = []
  private readonly json = new Map<number, string>()
  private readonly dirty = new Set<number>()
  private snapshot: SaveEntityState[] | undefined
  private groups = new Map<string, SaveEntityState[]>()
  private dynamicJson = ''

  markDirty(index: number): void {
    this.dirty.add(index)
  }

  reset(): void {
    this.slots = []
    this.json.clear()
    this.dirty.clear()
    this.snapshot = undefined
    this.groups.clear()
    this.dynamicJson = ''
  }

  values(source: SaveCacheSource, serialize: Serialize): SaveEntityState[] {
    const dirtyZones = this.refreshDirtySlots(source, serialize)
    const dynamic = [...source.dynamic()].map(serialize)
    const dynamicJson = JSON.stringify(dynamic)
    if (this.snapshot && !dirtyZones.size && dynamicJson === this.dynamicJson) return this.snapshot
    const groups = new Map(this.groups)
    for (const key of dirtyZones)
      groups.set(
        source.zones.label(key),
        source.zones
          .slots(key)
          .map(slot => this.slots[slot - 1])
          .filter(isSaved)
      )
    // Dynamic/animated resources are deliberately serialized each time to retain their timers and state.
    if (dynamicJson !== this.dynamicJson || !this.snapshot) groups.set('dynamic', dynamic)
    this.dynamicJson = dynamicJson
    this.groups = groups
    this.snapshot = [...this.slots.filter(isSaved), ...dynamic]
    resourceSnapshotZones.set(this.snapshot, groups)
    return this.snapshot
  }

  private refreshDirtySlots(source: SaveCacheSource, serialize: Serialize): Set<number> {
    const dirtyZones = new Set<number>()
    if (!this.snapshot) for (let i = 0; i < source.used; i++) this.dirty.add(i)
    for (const index of source.active.keys()) this.dirty.add(index)
    for (const index of this.dirty) {
      const record = source.current(index)
      const value = record ? serialize(record) : undefined
      const json = value ? JSON.stringify(value) : ''
      if (this.json.get(index) === json) continue
      if (source.active.has(index)) this.json.set(index, json)
      this.slots[index] = value
      dirtyZones.add(source.zones.slotZone(index))
    }
    this.dirty.clear()
    return dirtyZones
  }
}
