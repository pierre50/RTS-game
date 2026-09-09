import type { PreparedTerrainCell } from '../classes/map/generation/PreparedMapContent'

const DIRECTIONS = ['north', 'south', 'east', 'west']
const GROUNDS = ['Desert', 'DarkForest', 'Dirt', 'Jungle', 'Snow'] as const
const WATER_SHEET = 'desert-sand-water-border'
const STRIDE = 9

export function encodePreparedTerrain(entries: PreparedTerrainCell[], size: number): Uint8Array {
  const bytes = new Uint8Array(entries.length * STRIDE)
  const view = new DataView(bytes.buffer)
  entries.forEach((entry, index) => {
    const offset = index * STRIDE
    if (entry.water && entry.water[0] !== WATER_SHEET) throw new Error('Unsupported prepared water sheet')
    view.setUint32(offset, entry.i * (size + 1) + entry.j, true)
    bytes[offset + 4] = entry.water ? Number(entry.water[1]) + 1 : 0
    bytes[offset + 5] = entry.relief ? Number(entry.relief[0]) + 1 : 0
    bytes[offset + 6] = entry.relief ? entry.relief[1] * 2 : 0
    bytes[offset + 7] = DIRECTIONS.reduce(
      (mask, direction, bit) => mask | (entry.patches?.includes(direction) ? 1 << bit : 0),
      0
    )
    bytes[offset + 8] = entry.ground ? GROUNDS.indexOf(entry.ground) + 1 : 0
  })
  return bytes
}

export function decodePreparedTerrain(bytes: Uint8Array, size: number): PreparedTerrainCell[] {
  if (bytes.length % STRIDE !== 0) throw new Error('Truncated prepared terrain')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries: PreparedTerrainCell[] = []
  for (let offset = 0; offset < bytes.length; offset += STRIDE) {
    const index = view.getUint32(offset, true)
    if (index >= (size + 1) ** 2 || bytes[offset + 7] > 15 || bytes[offset + 8] > GROUNDS.length)
      throw new Error('Invalid prepared terrain')
    const entry: PreparedTerrainCell = { i: Math.floor(index / (size + 1)), j: index % (size + 1) }
    if (bytes[offset + 4]) entry.water = [WATER_SHEET, String(bytes[offset + 4] - 1).padStart(3, '0')]
    if (bytes[offset + 5]) entry.relief = [String(bytes[offset + 5] - 1).padStart(3, '0'), bytes[offset + 6] / 2]
    if (bytes[offset + 7]) entry.patches = DIRECTIONS.filter((_, bit) => bytes[offset + 7] & (1 << bit))
    if (bytes[offset + 8]) entry.ground = GROUNDS[bytes[offset + 8] - 1]
    entries.push(entry)
  }
  return entries
}
