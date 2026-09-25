import { resourceSnapshotZones } from '../classes/resources/CompactResourceSet'
import type { SaveRecord } from '../types/save'

/** Snapshot mutable metadata, sharing only resource arrays produced as immutable save snapshots. */
export function cloneSaveSnapshot<T extends SaveRecord>(record: T): T {
  const copy = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      if (resourceSnapshotZones.has(value)) return value
      return value.map(copy)
    }
    if (value && typeof value === 'object') {
      if (Object.getPrototypeOf(value) !== Object.prototype) return structuredClone(value)
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]))
    }
    return value
  }
  return copy(record) as T
}
