import LZString from 'lz-string'
import { serializeGame } from './SaveSerializer'
import { parseSaveJSON } from './SaveValidator'

const INDEX_KEY = 'rts_saves_index'
const MAX_SAVES = 10
const EXPORT_FORMAT = 'rts-save'
export const EXPORT_EXT = '.rts'

function getIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]')
  } catch {
    return []
  }
}

function setIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

function formatSaveName() {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${day}/${month} ${hours}:${minutes}`
}

export function save(context) {
  const index = getIndex()
  if (index.length >= MAX_SAVES) {
    throw new Error('MAX_SAVES_REACHED')
  }
  const data = serializeGame(context)
  const compressed = LZString.compressToBase64(JSON.stringify(data))
  const key = `rts_save_${Date.now()}`
  try {
    localStorage.setItem(key, compressed)
  } catch {
    throw new Error('STORAGE_FULL')
  }
  const name = formatSaveName()
  index.push({ key, name, date: Date.now() })
  setIndex(index)
  return { key, name }
}

export function listSaves() {
  return getIndex().slice().reverse()
}

export function loadSave(key) {
  const compressed = localStorage.getItem(key)
  if (!compressed) throw new Error('SAVE_NOT_FOUND')
  const raw = LZString.decompressFromBase64(compressed)
  if (!raw) throw new Error('SAVE_CORRUPT')
  return parseSaveJSON(raw)
}

export function deleteSave(key) {
  localStorage.removeItem(key)
  setIndex(getIndex().filter(s => s.key !== key))
}

export function exportSave(key) {
  const index = getIndex()
  const entry = index.find(s => s.key === key)
  if (!entry) throw new Error('SAVE_NOT_FOUND')
  const compressed = localStorage.getItem(key)
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

export function importSaveFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        let parsed
        try {
          parsed = JSON.parse(e.target.result)
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
        const key = `rts_save_${Date.now()}`
        try {
          localStorage.setItem(key, parsed.data)
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
