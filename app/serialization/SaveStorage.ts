import LZString from 'lz-string'
import { serializeGame } from './SaveSerializer'
import type { GameContextLike } from '../types/context'
import type { SaveIndexEntry, SaveRecord } from '../types/save'

declare global {
  interface Window {
    electronSaves?: {
      getIndex(): string | null
      setIndex(json: string): void
      getItem(key: string): string | null
      setItem(key: string, value: string): boolean
      removeItem(key: string): void
    }
  }
}

const INDEX_KEY = 'saves_index'
const MAX_SAVES = 10
const EXPORT_FORMAT = 'save-v1'
export const EXPORT_EXT = '.save'

const backend = window.electronSaves
  ? {
      getIndex: () => window.electronSaves!.getIndex(),
      setIndex: (json: string) => window.electronSaves!.setIndex(json),
      getItem: (key: string) => window.electronSaves!.getItem(key),
      setItem: (key: string, value: string) => {
        if (!window.electronSaves!.setItem(key, value)) throw new Error('STORAGE_FULL')
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

type ExportPayload = {
  data?: string
  date?: number
  format?: string
  name?: string
  v?: number
}

function getIndex(): SaveIndexEntry[] {
  try {
    return JSON.parse(backend.getIndex() || '[]')
  } catch {
    return []
  }
}

function setIndex(index: SaveIndexEntry[]): void {
  backend.setIndex(JSON.stringify(index))
}

function formatSaveName() {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${day}/${month} ${hours}:${minutes}`
}

export function save(context: GameContextLike): { key: string; name: string } {
  const index = getIndex()
  if (index.length >= MAX_SAVES) {
    throw new Error('MAX_SAVES_REACHED')
  }
  const data = serializeGame(context)
  const compressed = LZString.compressToBase64(JSON.stringify(data))
  const key = `save_${Date.now()}`
  try {
    backend.setItem(key, compressed)
  } catch {
    throw new Error('STORAGE_FULL')
  }
  const name = formatSaveName()
  index.push({ key, name, date: Date.now() })
  setIndex(index)
  return { key, name }
}

export function listSaves(): SaveIndexEntry[] {
  return getIndex().slice().reverse()
}

export function loadSave(key: string): SaveRecord {
  const compressed = backend.getItem(key)
  if (!compressed) throw new Error('SAVE_NOT_FOUND')
  const raw = LZString.decompressFromBase64(compressed)
  if (!raw) throw new Error('SAVE_CORRUPT')
  try {
    return JSON.parse(raw) as SaveRecord
  } catch {
    throw new Error('SAVE_CORRUPT')
  }
}

export function deleteSave(key: string): void {
  backend.removeItem(key)
  setIndex(getIndex().filter(s => s.key !== key))
}

export function exportSave(key: string): void {
  const index = getIndex()
  const entry = index.find(s => s.key === key)
  if (!entry) throw new Error('SAVE_NOT_FOUND')
  const compressed = backend.getItem(key)
  if (!compressed) throw new Error('SAVE_NOT_FOUND')

  const payload = JSON.stringify({ format: EXPORT_FORMAT, v: 1, name: entry.name, date: entry.date, data: compressed })
  const blob = new Blob([payload], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${entry.name.replace(/[/:]/g, '-')}${EXPORT_EXT}`
  a.click()
  URL.revokeObjectURL(url)
}

export function importSaveFile(file: File): Promise<{ key: string; name: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        let parsed: ExportPayload
        const result = e.target?.result
        if (typeof result !== 'string') throw new Error('INVALID_FORMAT')
        try {
          parsed = JSON.parse(result)
        } catch {
          throw new Error('INVALID_FORMAT')
        }
        if (parsed.format !== EXPORT_FORMAT || typeof parsed.data !== 'string') throw new Error('INVALID_FORMAT')

        const raw = LZString.decompressFromBase64(parsed.data)
        if (!raw) throw new Error('SAVE_CORRUPT')
        try {
          JSON.parse(raw)
        } catch {
          throw new Error('SAVE_CORRUPT')
        }

        const index = getIndex()
        if (index.length >= MAX_SAVES) throw new Error('MAX_SAVES_REACHED')
        const key = `save_${Date.now()}`
        try {
          backend.setItem(key, parsed.data)
        } catch {
          throw new Error('STORAGE_FULL')
        }

        const name = typeof parsed.name === 'string' && parsed.name ? parsed.name : formatSaveName()
        const date = typeof parsed.date === 'number' ? parsed.date : Date.now()
        index.push({ key, name, date })
        setIndex(index)
        resolve({ key, name })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('READ_ERROR'))
    reader.readAsText(file)
  })
}
