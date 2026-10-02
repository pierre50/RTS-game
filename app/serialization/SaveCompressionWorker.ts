import LZString from 'lz-string'
import type { SaveCollection, ZoneEntry } from './ZonedSaveFormat'
import { SAVE_ZONE_SIZE } from './SaveZoneConstants'
import type { SaveRecord } from '../types/save'

type Input = {
  key: string
  oldRaw: string | null
  metadata: SaveRecord
  collections: SaveCollection[]
  zones: [string, ZoneEntry[]][]
  retained: string[]
}
const scope = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null
  postMessage(value: unknown): void
}
let acknowledge: ((stats: { written?: number; reused?: number }) => void) | undefined
async function prepare(input: Input): Promise<void> {
  const decoded = input.oldRaw && LZString.decompressFromBase64(input.oldRaw)
  const old = decoded ? JSON.parse(decoded) : null
  const previous = new Map<string, string>(old?.format === 'zoned-save-v1' ? old.parts : [])
  const oldHashes = new Map<string, string>(old?.hashes ?? [])
  const parts = new Map<string, string>()
  const hashes = new Map<string, string>()
  for (const zone of input.retained) {
    const key = previous.get(zone)
    if (!key) throw new Error('SAVE_CACHE_MISMATCH')
    parts.set(zone, key)
    if (oldHashes.has(zone)) hashes.set(zone, oldHashes.get(zone)!)
  }
  let completed = input.retained.length
  const total = completed + input.zones.length
  let written = 0
  let batch: [string, string][] = []
  const flush = async () => {
    if (!batch.length) return
    const count = batch.length
    const ready = new Promise<void>(resolve => {
      acknowledge = stats => {
        written += stats.written ?? count
        resolve()
      }
    })
    scope.postMessage({ type: 'batch', parts: batch, completed, total })
    batch = []
    await ready
  }
  for (const [zone, entries] of input.zones) {
    const json = JSON.stringify(entries)
    const bytes = new TextEncoder().encode(json)
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n =>
      n.toString(16).padStart(2, '0')
    ).join('')
    hashes.set(zone, hash)
    if (previous.has(zone) && oldHashes.get(zone) === hash) parts.set(zone, previous.get(zone)!)
    else {
      const payload = JSON.stringify({ format: 'zone-part-v2', zone, entries })
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
      const hex = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('')
      const partKey = `save_9${BigInt(`0x${hex}`).toString().padStart(78, '0')}`
      batch.push([partKey, payload])
      parts.set(zone, partKey)
    }
    completed++
    if (batch.length >= 32) await flush()
    if (completed % 32 === 0) scope.postMessage({ type: 'progress', completed, total })
  }
  await flush()
  const raw = LZString.compressToBase64(
    JSON.stringify({
      format: 'zoned-save-v1',
      version: 1,
      zoneSize: SAVE_ZONE_SIZE,
      metadata: input.metadata,
      collections: input.collections,
      parts: [...parts],
      hashes: [...hashes],
    })
  )
  scope.postMessage({ type: 'ready', raw, completed: total, total, written, reused: total - written })
}
scope.onmessage = event => {
  if (event.data.type === 'ack') {
    acknowledge?.(event.data)
    acknowledge = undefined
    return
  }
  void prepare(event.data).catch(error => scope.postMessage({ type: 'error', message: String(error) }))
}

scope.postMessage({ type: 'started' })
