import LZString from 'lz-string'
import { assembleSave, partitionSave, SAVE_ZONE_SIZE } from './ZonedSaveFormat'
import type { SaveCollection, ZoneEntry } from './ZonedSaveFormat'
import type { SaveRecord } from '../types/save'

type Backend = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
type Manifest = {
  format: 'zoned-save-v1'
  version: 1
  zoneSize: number
  metadata: SaveRecord
  collections: SaveCollection[]
  parts: [string, string][]
}
type CachedPart = { key: string; json: string }
const FORMAT = 'zoned-save-v1'
let sequence = 0

function decode(value: string | null): unknown {
  if (!value) throw new Error('SAVE_CORRUPT')
  const json = LZString.decompressFromBase64(value)
  if (!json) throw new Error('SAVE_CORRUPT')
  try {
    return JSON.parse(json)
  } catch {
    throw new Error('SAVE_CORRUPT')
  }
}

function manifest(value: unknown): Manifest | null {
  if (!value || typeof value !== 'object' || !('format' in value) || value.format !== FORMAT) return null
  const data = value as Manifest
  if (
    data.version !== 1 ||
    data.zoneSize !== SAVE_ZONE_SIZE ||
    !data.metadata ||
    typeof data.metadata !== 'object' ||
    !Array.isArray(data.collections) ||
    !Array.isArray(data.parts)
  )
    throw new Error('SAVE_CORRUPT')
  const zones = new Set<string>()
  const keys = new Set<string>()
  for (const part of data.parts) {
    if (
      !Array.isArray(part) ||
      part.length !== 2 ||
      typeof part[0] !== 'string' ||
      typeof part[1] !== 'string' ||
      !/^save_\d+$/.test(part[1]) ||
      zones.has(part[0]) ||
      keys.has(part[1])
    )
      throw new Error('SAVE_CORRUPT')
    zones.add(part[0])
    keys.add(part[1])
  }
  return data
}

/** New immutable parts first, root manifest last. Until publication the previous save stays readable. */
export class ZonedSaveStore {
  private cache: { root: string; raw: string; parts: Map<string, CachedPart> } | null = null
  constructor(private readonly backend: Backend) {}

  private readParts(root: string, data: Manifest): { entries: ZoneEntry[][]; parts: Map<string, CachedPart> } {
    const entries: ZoneEntry[][] = []
    const parts = new Map<string, CachedPart>()
    for (const [zone, key] of data.parts) {
      const value = decode(this.backend.getItem(key)) as {
        format: string
        owner: string
        zone: string
        entries: ZoneEntry[]
      }
      if (
        !value ||
        value.format !== 'zone-part-v1' ||
        value.owner !== root ||
        value.zone !== zone ||
        !Array.isArray(value.entries)
      )
        throw new Error('SAVE_CORRUPT')
      entries.push(value.entries)
      parts.set(zone, { key, json: JSON.stringify(value.entries) })
    }
    return { entries, parts }
  }

  load(key: string): SaveRecord {
    const raw = this.backend.getItem(key)
    if (!raw) throw new Error('SAVE_NOT_FOUND')
    const value = decode(raw)
    const data = manifest(value)
    if (!data) return value as SaveRecord // Legacy single-file saves remain readable.
    const { entries, parts } = this.readParts(key, data)
    const result = assembleSave(data.metadata, data.collections, entries)
    this.cache = { root: key, raw, parts }
    return result
  }

  save(
    key: string,
    record: SaveRecord,
    publishIndex: () => void
  ): { changedZones: number; reusedZones: number; removedZones: number; writtenParts: number; reusedParts: number } {
    const oldRaw = this.backend.getItem(key)
    const old = oldRaw ? manifest(decode(oldRaw)) : null
    const previous = old
      ? this.cache?.root === key && this.cache.raw === oldRaw
        ? this.cache.parts
        : this.readParts(key, old).parts
      : new Map<string, CachedPart>()
    const split = partitionSave(record)
    const next = new Map<string, CachedPart>()
    const created: string[] = []
    let reusedZones = 0
    try {
      for (const [zone, entries] of split.zones) {
        const json = JSON.stringify(entries)
        const prior = previous.get(zone)
        if (prior?.json === json) {
          next.set(zone, prior)
          reusedZones++
          continue
        }
        // Numeric keys also work with existing Electron bridges; never overwrite a live part.
        let partKey: string
        do {
          partKey = `save_${Date.now()}${(++sequence).toString().padStart(8, '0')}`
        } while (partKey === key || this.backend.getItem(partKey) != null)
        created.push(partKey)
        this.backend.setItem(
          partKey,
          LZString.compressToBase64(
            JSON.stringify({
              format: 'zone-part-v1',
              owner: key,
              zone,
              entries,
            })
          )
        )
        next.set(zone, { key: partKey, json })
      }
      const data: Manifest = {
        format: FORMAT,
        version: 1,
        zoneSize: SAVE_ZONE_SIZE,
        metadata: split.metadata,
        collections: split.collections,
        parts: [...next].map(([zone, part]) => [zone, part.key]),
      }
      const raw = LZString.compressToBase64(JSON.stringify(data))
      this.backend.setItem(key, raw)
      publishIndex()
      this.cache = { root: key, raw, parts: next }
    } catch (error) {
      // A backend may report failure after writing: restore the old root before deleting staged data.
      try {
        if (oldRaw == null) this.backend.removeItem(key)
        else if (this.backend.getItem(key) !== oldRaw) this.backend.setItem(key, oldRaw)
      } catch {
        /* Keep staged parts if rollback cannot be confirmed. */
      }
      if (this.backend.getItem(key) === oldRaw) for (const part of created) this.removeQuietly(part)
      this.cache = null
      throw error
    }
    const live = new Set([...next.values()].map(part => part.key))
    for (const part of previous.values()) if (!live.has(part.key)) this.removeQuietly(part.key)
    return {
      writtenParts: created.length,
      reusedParts: reusedZones,
      changedZones: [...next].filter(
        ([zone, part]) => !zone.startsWith('["order",') && previous.get(zone)?.key !== part.key
      ).length,
      reusedZones: [...next].filter(
        ([zone, part]) => !zone.startsWith('["order",') && previous.get(zone)?.key === part.key
      ).length,
      removedZones: [...previous.keys()].filter(zone => !zone.startsWith('["order",') && !next.has(zone)).length,
    }
  }

  private removeQuietly(key: string): void {
    try {
      this.backend.removeItem(key)
    } catch {
      /* Obsolete chunks can be cleaned up later; the published save is valid. */
    }
  }
}
