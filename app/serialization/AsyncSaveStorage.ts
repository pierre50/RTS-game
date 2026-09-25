import { partitionSave } from './ZonedSaveFormat'
import type { ZoneEntry } from './ZonedSaveFormat'
import type { SaveRecord } from '../types/save'
export type SaveProgress = { completed: number; total: number; phase: 'prepare' | 'write' | 'publish' | 'complete' }
export type AsyncSaveBridge = {
  begin(key: string): Promise<{ token: string; oldRaw: string | null }>
  batchNative(token: string, parts: [string, string][]): Promise<{ written: number; reused: number }>
  batch(token: string, parts: [string, string][]): Promise<void>
  commit(token: string, raw: string, index: string): Promise<void>
  abort(token: string): Promise<void>
}
let queue: Promise<unknown> = Promise.resolve()
const cache = new Map<string, { raw: string; zones: Map<string, ZoneEntry[]> }>()

export function writeElectronSave(
  bridge: AsyncSaveBridge,
  key: string,
  record: SaveRecord,
  index: string,
  onProgress?: (progress: SaveProgress) => void
): Promise<void> {
  const run = async () => {
    const startedAt = performance.now()
    onProgress?.({ completed: 0, total: 0, phase: 'prepare' })
    const { token, oldRaw } = await bridge.begin(key).catch(error => {
      if (String(error).includes("No handler registered for 'saves:begin'"))
        throw new Error('SAVE_RESTART_ELECTRON_REQUIRED')
      throw error
    })
    let nativeBatchMs = 0
    let worker: Worker | undefined
    let startupTimeout: ReturnType<typeof setTimeout> | undefined
    try {
      const partitionStartedAt = performance.now()
      const split = partitionSave(record)
      const partitionMs = performance.now() - partitionStartedAt
      const previous = cache.get(key)
      const retained: string[] = []
      const zones: [string, ZoneEntry[]][] = []
      for (const [zone, entries] of split.zones) {
        if (
          previous?.raw === oldRaw &&
          (previous.zones.get(zone) === entries ||
            (entries.length === 1 && previous.zones.get(zone)?.[0] === entries[0]))
        )
          retained.push(zone)
        else zones.push([zone, entries])
      }
      worker = new Worker(new URL('./SaveCompression.worker.ts', import.meta.url))
      const raw = await new Promise<string>((resolve, reject) => {
        startupTimeout = setTimeout(() => reject(new Error('SAVE_WORKER_START_TIMEOUT')), 30000)
        worker!.onmessageerror = () => reject(new Error('SAVE_WORKER_MESSAGE_FAILED'))
        worker!.onerror = event => reject(new Error(event.message || 'SAVE_WORKER_FAILED'))
        worker!.onmessage = event => {
          const message = event.data
          clearTimeout(startupTimeout)
          if (message.type === 'started') return
          if (message.type === 'error') {
            reject(new Error(message.message))
            return
          }
          if (message.type === 'ready') {
            console.info('[save-zones]', {
              key,
              writtenParts: message.written,
              reusedParts: message.reused,
              totalParts: message.total,
            })
            resolve(message.raw)
            return
          }
          if (message.type === 'batch') {
            const batchStartedAt = performance.now()
            void bridge.batchNative(token, message.parts).then(stats => {
              nativeBatchMs += performance.now() - batchStartedAt
              onProgress?.({ completed: message.completed, total: message.total, phase: 'write' })
              worker!.postMessage({ type: 'ack', ...stats })
            }, reject)
          } else onProgress?.({ completed: message.completed, total: message.total, phase: 'write' })
        }
        worker!.postMessage({ key, oldRaw, metadata: split.metadata, collections: split.collections, zones, retained })
      })
      const publishStartedAt = performance.now()
      onProgress?.({ completed: split.zones.size, total: split.zones.size, phase: 'publish' })
      await bridge.commit(token, raw, index)
      cache.set(key, { raw, zones: split.zones })
      console.info('[save-timing]', {
        key,
        partitionMs: Math.round(partitionMs),
        nativeBatchMs: Math.round(nativeBatchMs),
        publishMs: Math.round(performance.now() - publishStartedAt),
        totalMs: Math.round(performance.now() - startedAt),
        retainedZones: retained.length,
        processedZones: zones.length,
      })
      onProgress?.({ completed: split.zones.size, total: split.zones.size, phase: 'complete' })
    } catch (error) {
      await bridge.abort(token).catch(() => {})
      throw error
    } finally {
      clearTimeout(startupTimeout)
      worker?.terminate()
    }
  }
  const pending = queue.then(run)
  queue = pending.catch(() => {})
  return pending
}
