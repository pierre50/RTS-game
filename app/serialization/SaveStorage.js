import LZString from 'lz-string'
import { serializeGame } from './SaveSerializer'
import { parseSaveJSON } from './SaveValidator'

const INDEX_KEY = 'rts_saves_index'
const MAX_SAVES = 10

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
