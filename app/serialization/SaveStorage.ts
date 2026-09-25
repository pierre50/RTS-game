import type { AsyncSaveBridge, SaveProgress } from './AsyncSaveStorage'
import { ZonedSaveStore } from './ZonedSaveStore'
import { serializeGameForPersistence } from './SaveSerializer'
import { createInitialCampaignSave, updateCurrentWorldState } from './CampaignSave'
import { debugLog } from '../lib/debug'
import type { GameContextLike } from '../types/context'
import type { CampaignSave, SaveIndexEntry, SaveRecord } from '../types/save'

declare global {
  interface Window {
    electronSaves?: Partial<AsyncSaveBridge> & {
      getIndex(): string | null
      setIndex(json: string): SaveWriteResult
      getItem(key: string): string | null
      setItem(key: string, value: string): boolean | SaveWriteResult
      removeItem(key: string): void
    }
  }
}

type SaveWriteResult = boolean | { ok?: boolean; error?: string; path?: string }

const INDEX_KEY = 'saves_index'
// Keep the autosave key compatible with older Electron main-process validators
// that only accepted /^save_\d+$/; dev hot reload does not restart main.js.
const AUTOSAVE_KEY = 'save_0'
const MAX_SAVES = 10
const SAVE_BACKEND_DEBUG = false

function assertSaveWrite(result: SaveWriteResult, fallbackMessage = 'STORAGE_FULL'): void {
  if (result === true) return
  if (result && typeof result === 'object' && result.ok) return

  const details =
    result && typeof result === 'object'
      ? [result.error, result.path ? `path=${result.path}` : null].filter(Boolean).join(' ')
      : ''
  throw new Error(details ? `${fallbackMessage}: ${details}` : fallbackMessage)
}

const saveBackendName = window.electronSaves ? 'electron-file' : 'browser-localStorage'
debugLog(SAVE_BACKEND_DEBUG, `[save] Using ${saveBackendName} backend`)

const backend = window.electronSaves
  ? {
      getIndex: () => window.electronSaves!.getIndex(),
      setIndex: (json: string) => assertSaveWrite(window.electronSaves!.setIndex(json), 'SAVE_INDEX_WRITE_FAILED'),
      getItem: (key: string) => window.electronSaves!.getItem(key),
      setItem: (key: string, value: string) => {
        assertSaveWrite(window.electronSaves!.setItem(key, value))
      },
      removeItem: (key: string) => window.electronSaves!.removeItem(key),
    }
  : {
      getIndex: () => localStorage.getItem(INDEX_KEY),
      setIndex: (json: string) => localStorage.setItem(INDEX_KEY, json),
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      removeItem: (key: string) => localStorage.removeItem(key),
    }

const zonedStore = new ZonedSaveStore(backend)

function getIndex(): SaveIndexEntry[] {
  try {
    const parsed: unknown = JSON.parse(backend.getIndex() || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is SaveIndexEntry =>
        entry != null &&
        typeof entry === 'object' &&
        typeof entry.key === 'string' &&
        entry.key.length > 0 &&
        typeof entry.name === 'string' &&
        typeof entry.date === 'number' &&
        Number.isFinite(entry.date)
    )
  } catch {
    return []
  }
}

function setIndex(index: SaveIndexEntry[]): void {
  backend.setIndex(JSON.stringify(index))
}

function isLoadableSaveData(key: string): boolean {
  try {
    zonedStore.inspect(key)
    return true
  } catch {
    return false
  }
}

function createSaveKey(index: SaveIndexEntry[]): string {
  const usedKeys = new Set(index.map(entry => entry.key))
  const timestamp = Date.now()

  for (let offset = 0; offset < 1000; offset++) {
    const key = `save_${timestamp + offset}`
    if (!usedKeys.has(key) && !backend.getItem(key)) return key
  }

  return `save_${timestamp}${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')}`
}

function formatSaveName() {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${day}/${month} ${hours}:${minutes}`
}

type SaveRecordOptions = {
  key?: string
  name?: string
}

export function saveRecord(data: SaveRecord, options: SaveRecordOptions = {}): { key: string; name: string } {
  const index = getIndex()
  const replacing = Boolean(options.key && index.some(entry => entry.key === options.key))
  const isAutosave = options.key === AUTOSAVE_KEY
  if (!replacing && !isAutosave && index.length >= MAX_SAVES) {
    throw new Error('MAX_SAVES_REACHED')
  }
  const key = options.key ?? createSaveKey(index)
  const name = options.name ?? formatSaveName()
  const date = Date.now()
  try {
    const stats = zonedStore.save(key, data, () =>
      setIndex([...index.filter(entry => entry.key !== key), { key, name, date }])
    )
    console.info(`[save-zones] ${JSON.stringify({ key, ...stats })}`)
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'STORAGE_FULL'
    throw new Error(message.startsWith('STORAGE_FULL') ? message : `STORAGE_FULL: ${message}`)
  }
  return { key, name }
}

export function buildSaveRecord(context: GameContextLike, campaign: CampaignSave | null = null): SaveRecord {
  const worldState = serializeGameForPersistence(context)
  return campaign ? updateCurrentWorldState(campaign, worldState) : createInitialCampaignSave(worldState)
}

export function autosaveRecord(data: SaveRecord, name = 'Autosave'): { key: string; name: string } | null {
  try {
    return saveRecord(data, { key: AUTOSAVE_KEY, name })
  } catch (error) {
    console.warn(`[save] Autosave failed: ${error instanceof Error ? error.message : String(error)}`, error)
    return null
  }
}

export function listSaves(): SaveIndexEntry[] {
  const index = getIndex()
  const loadableIndex = index.filter(entry => isLoadableSaveData(entry.key))
  if (loadableIndex.length !== index.length) {
    try {
      setIndex(loadableIndex)
    } catch (error) {
      console.warn('[save] Unable to clean save index', error)
    }
  }
  return loadableIndex.slice().reverse()
}

export function loadSave(key: string): SaveRecord {
  return zonedStore.load(key)
}

let asyncSaveQueue: Promise<unknown> = Promise.resolve()
export function saveRecordAsync(
  data: SaveRecord,
  options: SaveRecordOptions = {},
  onProgress?: (progress: SaveProgress) => void
): Promise<{ key: string; name: string }> {
  const run = async () => {
    const bridge = window.electronSaves
    if (!bridge?.begin || !bridge.batch || !bridge.batchNative || !bridge.commit || !bridge.abort) {
      if (bridge) throw new Error('SAVE_RESTART_ELECTRON_REQUIRED')
      return saveRecord(data, options)
    }
    const index = getIndex()
    const replacing = Boolean(options.key && index.some(entry => entry.key === options.key))
    if (!replacing && options.key !== AUTOSAVE_KEY && index.length >= MAX_SAVES) throw new Error('MAX_SAVES_REACHED')
    const key = options.key ?? createSaveKey(index)
    const name = options.name ?? formatSaveName()
    const { writeElectronSave } = await import('./AsyncSaveStorage')
    await writeElectronSave(
      bridge as AsyncSaveBridge,
      key,
      data,
      JSON.stringify([...index.filter(entry => entry.key !== key), { key, name, date: Date.now() }]),
      onProgress
    )
    return { key, name }
  }
  const pending = asyncSaveQueue.then(run)
  asyncSaveQueue = pending.catch(() => {})
  return pending
}

export async function autosaveRecordAsync(
  data: SaveRecord,
  name = 'Autosave',
  onProgress?: (progress: SaveProgress) => void,
  onError?: (error: unknown) => void
): Promise<{ key: string; name: string } | null> {
  try {
    return await saveRecordAsync(data, { key: AUTOSAVE_KEY, name }, onProgress)
  } catch (error) {
    onError?.(error)
    console.warn(`[save] Autosave failed: ${error instanceof Error ? error.message : String(error)}`, error)
    return null
  }
}

export function loadSaveAsync(
  key: string,
  onProgress: (completed: number, total: number) => Promise<void>
): Promise<SaveRecord> {
  return zonedStore.loadAsync(key, onProgress)
}
