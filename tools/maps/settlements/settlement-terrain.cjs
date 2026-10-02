const { loadGenerationTs } = require('../load-generation-ts.cjs')
const { TERRAIN_TYPES } = loadGenerationTs('app/constants/blueprintTerrain.ts')
const { decodePreparedTerrain } = loadGenerationTs('app/serialization/blueprint/PreparedTerrainCodec.ts')

function settlementTerrain(source) {
  if (source.version !== 2) throw new Error('Finalize the map to blueprint version 2 before preparing settlements')
  const stride = source.size + 1
  if (!Number.isInteger(stride) || stride < 2) throw new Error('Invalid map size')
  const packed = typeof source.terrain === 'string'
  const types = packed ? Buffer.from(source.terrain, 'base64') : null
  const heights = packed ? Buffer.from(source.relief, 'base64') : null
  if (packed && (types.length !== stride * stride || heights.length !== stride * stride))
    throw new Error('Invalid packed terrain dimensions')
  const grid = Array.from({ length: stride }, (_, i) => {
    const row = Array(stride)
    for (let j = 0; j < stride; j++) {
      const value = packed ? types[i * stride + j] : source.terrain[i]?.[j]
      if (value == null || value === 255) continue
      const type = typeof value === 'number' ? TERRAIN_TYPES[value] : value
      if (type == null) throw new Error(`Unknown terrain at ${i}:${j}`)
      row[j] = {
        i,
        j,
        type,
        category: type === 'Water' || type === '' ? 'Water' : 'Land',
        z: packed ? heights.readInt8(i * stride + j) : (source.relief?.[i]?.[j] ?? 0),
      }
    }
    return row
  })
  const appearance = source.terrainAppearanceData
    ? decodePreparedTerrain(Buffer.from(source.terrainAppearanceData, 'base64'), source.size)
    : (source.terrainAppearance ?? [])
  for (const entry of appearance) {
    const cell = grid[entry.i]?.[entry.j]
    if (cell)
      Object.assign(cell, {
        border: Boolean(entry.water),
        waterBorder: Boolean(entry.water),
        inclined: Boolean(entry.relief),
      })
  }
  return grid
}
module.exports = { settlementTerrain }
