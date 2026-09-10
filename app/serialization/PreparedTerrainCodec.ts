import type { PreparedTerrainCell } from '../classes/map/generation/PreparedMapContent'

const DIRECTIONS = ['north', 'south', 'east', 'west']
const GROUNDS = ['Desert', 'DarkForest', 'Dirt', 'Jungle', 'Snow'] as const
const WATER_SHEET = 'desert-sand-water-border'
const STRIDE = 9

function requireInteger(value: number, maximum: number): number {
  if (!Number.isInteger(value) || value < 0 || value > maximum) throw new Error('Invalid prepared terrain')
  return value
}

function encodeFrame(frame: string): number {
  if (!/^\d+$/.test(frame)) throw new Error('Invalid prepared terrain frame')
  return requireInteger(Number(frame), 254) + 1
}

function encodeEntry(view: DataView, offset: number, entry: PreparedTerrainCell, size: number): void {
  if (entry.water && entry.water[0] !== WATER_SHEET) throw new Error('Unsupported prepared water sheet')
  const index = requireInteger(entry.i, size) * (size + 1) + requireInteger(entry.j, size)
  view.setUint32(offset, index, true)
  view.setUint8(offset + 4, entry.water ? encodeFrame(entry.water[1]) : 0)
  view.setUint8(offset + 5, entry.relief ? encodeFrame(entry.relief[0]) : 0)
  view.setUint8(offset + 6, entry.relief ? requireInteger(entry.relief[1] * 2, 255) : 0)
  const patches = entry.patches ?? []
  if (patches.some(direction => !DIRECTIONS.includes(direction))) throw new Error('Invalid prepared terrain patch')
  view.setUint8(
    offset + 7,
    DIRECTIONS.reduce((mask, direction, bit) => mask | (patches.includes(direction) ? 1 << bit : 0), 0)
  )
  const ground = entry.ground ? GROUNDS.indexOf(entry.ground) + 1 : 0
  if (entry.ground && !ground) throw new Error('Invalid prepared terrain ground')
  view.setUint8(offset + 8, ground)
}

export function encodePreparedTerrain(entries: PreparedTerrainCell[], size: number): Uint8Array {
  requireInteger(size, 65535)
  const bytes = new Uint8Array(entries.length * STRIDE)
  const view = new DataView(bytes.buffer)
  entries.forEach((entry, index) => encodeEntry(view, index * STRIDE, entry, size))
  return bytes
}

function decodeEntry(view: DataView, offset: number, size: number): PreparedTerrainCell {
  const index = view.getUint32(offset, true)
  const water = view.getUint8(offset + 4)
  const relief = view.getUint8(offset + 5)
  const height = view.getUint8(offset + 6)
  const patches = view.getUint8(offset + 7)
  const groundIndex = view.getUint8(offset + 8)
  if (index >= (size + 1) ** 2 || patches > 15 || groundIndex > GROUNDS.length)
    throw new Error('Invalid prepared terrain')
  const entry: PreparedTerrainCell = { i: Math.floor(index / (size + 1)), j: index % (size + 1) }
  if (water) entry.water = [WATER_SHEET, String(water - 1).padStart(3, '0')]
  if (relief) entry.relief = [String(relief - 1).padStart(3, '0'), height / 2]
  if (patches) entry.patches = DIRECTIONS.filter((_, bit) => patches & (1 << bit))
  const ground = GROUNDS[groundIndex - 1]
  if (ground) entry.ground = ground
  return entry
}

export function decodePreparedTerrain(bytes: Uint8Array, size: number): PreparedTerrainCell[] {
  requireInteger(size, 65535)
  if (bytes.length % STRIDE !== 0) throw new Error('Truncated prepared terrain')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries: PreparedTerrainCell[] = []
  for (let offset = 0; offset < bytes.length; offset += STRIDE) entries.push(decodeEntry(view, offset, size))
  return entries
}
