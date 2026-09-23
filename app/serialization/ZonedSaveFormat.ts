import type { SaveRecord } from '../types/save'

export const SAVE_ZONE_SIZE = 64
export type SavePath = (string | number)[]
type ObjectData = Record<string, unknown>
export type ZoneEntry = { collection: string; id: string; value: unknown; orderPage?: number }
export type SaveCollection = { path: SavePath; length: number }
export type PartitionedSave = { metadata: SaveRecord; collections: SaveCollection[]; zones: Map<string, ZoneEntry[]> }

function object(value: unknown): ObjectData | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ObjectData) : undefined
}

export function atSavePath(root: unknown, path: SavePath): unknown {
  let value = root
  for (const key of path) {
    if (
      (typeof key !== 'string' && typeof key !== 'number') ||
      ['__proto__', 'constructor', 'prototype'].includes(String(key)) ||
      !value ||
      typeof value !== 'object' ||
      !Object.hasOwn(value, key)
    )
      throw new Error('SAVE_CORRUPT')
    value = (value as ObjectData)[key]
  }
  return value
}

/** Copy only metadata containers. Entity values are serialized directly into their zone. */
function replaceCollection(root: SaveRecord, path: SavePath): void {
  let value = root as unknown as ObjectData
  for (const key of path.slice(0, -1)) {
    const current = value[key]
    const copy = Array.isArray(current) ? [...current] : { ...object(current) }
    value[key] = copy
    value = copy as unknown as ObjectData
  }
  value[path[path.length - 1]] = []
}

/** No terrain-cell scan: only persisted entities, observations and compact exploration chunks. */
export function partitionSave(record: SaveRecord): PartitionedSave {
  const metadata = { ...record }
  const collections: SaveCollection[] = []
  const zones = new Map<string, ZoneEntry[]>()
  const split = (
    path: SavePath,
    scope: SavePath,
    channel: string,
    mode: 'entity' | 'explored' | 'visible' | 'rows' = 'entity',
    stride = 1
  ) => {
    const list = atSavePath(record, path)
    if (!Array.isArray(list)) return
    const collection = JSON.stringify(path)
    const ids: string[] = []
    const occurrences = new Map<string, number>()
    list.forEach((value, index) => {
      const entry = object(value) ?? {}
      const position = object(entry.cavePosition) ?? entry
      let i = Number(position.i)
      let j = Number(position.j)
      if (mode === 'explored') {
        i *= SAVE_ZONE_SIZE
        j *= SAVE_ZONE_SIZE
      }
      if (mode === 'visible') {
        i = Math.floor(Number(entry.index) / stride)
        j = Number(entry.index) % stride
      }
      if (mode === 'rows') {
        i = index
        j = 0
      }
      const identity =
        mode === 'rows'
          ? String(index)
          : mode === 'visible'
            ? String(entry.index)
            : typeof entry.label === 'string' && entry.label
              ? `label:${entry.label}`
              : JSON.stringify([entry.type ?? null, i, j, entry.instance ?? entry.target ?? null])
      const occurrence = occurrences.get(identity) ?? 0
      occurrences.set(identity, occurrence + 1)
      const id = JSON.stringify([identity, occurrence])
      ids.push(id)
      const zone = JSON.stringify([
        scope,
        channel,
        entry.spaceId ?? position.caveId ?? 'outside',
        Number.isFinite(i) ? Math.floor(i / SAVE_ZONE_SIZE) : 'global',
        Number.isFinite(j) ? Math.floor(j / SAVE_ZONE_SIZE) : 'global',
      ])
      let entries = zones.get(zone)
      if (!entries) {
        entries = []
        zones.set(zone, entries)
      }
      entries.push({ collection, id, value })
    })
    // Ordering is paged separately so deleting an early array element does not rewrite every entity zone.
    for (let page = 0; page * 1024 < ids.length; page++) {
      zones.set(JSON.stringify(['order', path, page]), [
        { collection, id: '', orderPage: page, value: ids.slice(page * 1024, (page + 1) * 1024) },
      ])
    }
    collections.push({ path, length: ids.length })
    replaceCollection(metadata, path)
  }
  const optional = (path: SavePath, scope: SavePath, channel: string) => {
    const parent = atSavePath(record, path.slice(0, -1)) as ObjectData
    if (Array.isArray(parent[path[path.length - 1]])) split(path, scope, channel)
  }
  const world = (state: ObjectData, path: SavePath) => {
    if (Array.isArray(state.map)) split([...path, 'map'], path, 'legacyTerrain', 'rows')
    for (const field of ['resources', 'animals', 'naturalResourceRespawnSlots'])
      optional([...path, field], path, 'entities')
    if (Array.isArray(state.players))
      state.players.forEach((raw, index) => {
        const player = object(raw)
        if (!player) return
        const owner = [...path, 'players', index]
        for (const field of ['units', 'buildings', 'corpses']) optional([...owner, field], path, 'entities')
        optional([...owner, 'targetKnowledge'], path, `knowledge:${index}`)
        const ai = object(player.aiState)
        if (ai)
          for (const field of ['enemyUnits', 'enemyBuildings', 'threatenedTargets'])
            optional([...owner, 'aiState', field], path, `knowledge:${index}`)
        if (Array.isArray(player.views)) split([...owner, 'views'], path, `legacyExploration:${index}`, 'rows')
        const views = object(player.views)
        if (views?.version === 1 && views.chunkSize === SAVE_ZONE_SIZE) {
          if (Array.isArray(views.explored))
            split([...owner, 'views', 'explored'], path, `exploration:${index}`, 'explored')
          if (Array.isArray(views.visible))
            split([...owner, 'views', 'visible'], path, `visibility:${index}`, 'visible', Number(views.stride))
        }
      })
  }
  if ('format' in record && record.format === 'campaign-v1') {
    for (const [id, savedWorld] of Object.entries(record.worlds))
      world(savedWorld.state as unknown as ObjectData, ['worlds', id, 'state'])
    for (const [id, region] of Object.entries(record.economy?.regions ?? {})) {
      const path = ['economy', 'regions', id]
      if (region.initialState) world(region.initialState as unknown as ObjectData, [...path, 'initialState'])
      for (const field of ['terrain', 'elevation'])
        if (Array.isArray((region as unknown as ObjectData)[field])) split([...path, field], path, field, 'rows')
    }
  } else world(record as unknown as ObjectData, [])
  // Collection ordering does not dirty entity zones when one entity is removed from an array.
  for (const entries of zones.values())
    entries.sort((a, b) =>
      a.collection < b.collection ? -1 : a.collection > b.collection ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    )
  return { metadata, collections, zones }
}

export function assembleSave(metadata: SaveRecord, collections: SaveCollection[], zones: ZoneEntry[][]): SaveRecord {
  const targets = new Map<
    string,
    { target: unknown[]; length: number; order: Map<number, string[]>; values: Map<string, unknown> }
  >()
  for (const collection of collections) {
    if (
      !collection ||
      !Array.isArray(collection.path) ||
      !Number.isSafeInteger(collection.length) ||
      collection.length < 0
    )
      throw new Error('SAVE_CORRUPT')
    const key = JSON.stringify(collection.path)
    const target = atSavePath(metadata, collection.path)
    if (targets.has(key) || !Array.isArray(target) || target.length) throw new Error('SAVE_CORRUPT')
    targets.set(key, { target, length: collection.length, order: new Map(), values: new Map() })
  }
  for (const entries of zones)
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry.collection !== 'string' ||
        typeof entry.id !== 'string' ||
        !Object.hasOwn(entry, 'value')
      )
        throw new Error('SAVE_CORRUPT')
      const target = targets.get(entry.collection)
      if (!target) throw new Error('SAVE_CORRUPT')
      if (entry.orderPage !== undefined) {
        if (
          !Number.isInteger(entry.orderPage) ||
          entry.orderPage < 0 ||
          entry.orderPage >= Math.ceil(target.length / 1024) ||
          target.order.has(entry.orderPage) ||
          !Array.isArray(entry.value) ||
          entry.value.length !== Math.min(1024, target.length - entry.orderPage * 1024) ||
          entry.value.some(id => typeof id !== 'string')
        )
          throw new Error('SAVE_CORRUPT')
        target.order.set(entry.orderPage, entry.value)
      } else {
        if (target.values.has(entry.id)) throw new Error('SAVE_CORRUPT')
        target.values.set(entry.id, entry.value)
      }
    }
  for (const { target, length, order, values } of targets.values()) {
    if (values.size !== length || order.size !== Math.ceil(length / 1024)) throw new Error('SAVE_CORRUPT')
    for (let page = 0; page < order.size; page++)
      for (const id of order.get(page) ?? []) {
        if (!values.has(id)) throw new Error('SAVE_CORRUPT')
        target.push(values.get(id))
        values.delete(id)
      }
    if (target.length !== length || values.size) throw new Error('SAVE_CORRUPT')
  }
  return metadata
}
