const { loadGenerationTs } = require('./load-generation-ts.cjs')
const { CELL_WIDTH, CELL_HEIGHT } = loadGenerationTs('app/constants/gridGeometry.ts')
const { encodePreparedTerrain, decodePreparedTerrain } = loadGenerationTs(require.resolve('../../app/serialization/PreparedTerrainCodec.ts'))
const fs = require('node:fs')
const path = require('node:path')
// A generous margin includes tall trees, shadows and the neighboring slope ring.
const SCENERY_MARGIN = 1024
function writeScenery(payload, file) {
  const width = payload.size + 1
  const terrain = Buffer.from(payload.terrain, 'base64')
  const relief = new Int8Array(Buffer.from(payload.relief, 'base64'))
  const layout = payload.localGridLayout
  const half = ((layout.columns - 1) * CELL_WIDTH) / 2
  const top = ((layout.columns - 1) * CELL_HEIGHT) / 2
  const bottom = top + ((layout.rows - 1) * CELL_HEIGHT) / 2
  const nearEdge = (i, j) => {
    const x = ((i - j) * CELL_WIDTH) / 2,
      y = ((i + j) * CELL_HEIGHT) / 2
    return Math.min(x + half, half - x, y - top, bottom - y) <= SCENERY_MARGIN
  }
  const sceneryCells = []
  for (let i = 0; i < width; i++)
    for (let j = 0; j < width; j++) {
      if (terrain[i * width + j] !== 255 && nearEdge(i, j))
        sceneryCells.push([i, j, terrain[i * width + j], relief[i * width + j]])
    }
  const encodedCells = Buffer.alloc(sceneryCells.length * 6)
  sceneryCells.forEach(([i, j, type, z], offset) => {
    encodedCells.writeUInt32LE(i * width + j, offset * 6)
    encodedCells.writeUInt8(type, offset * 6 + 4)
    encodedCells.writeInt8(z, offset * 6 + 5)
  })
  const scenery = {
    format: 'map-scenery',
    version: 2,
    id: payload.id,
    seed: payload.seed,
    sourceSize: payload.sourceSize,
    size: payload.size,
    localGridLayout: layout,
    sceneryCells: encodedCells.toString('base64'),
    resources: payload.resources.filter(r => nearEdge(r.i, r.j)),
    terrainAppearanceData: Buffer.from(
      encodePreparedTerrain(
        decodePreparedTerrain(Buffer.from(payload.terrainAppearanceData, 'base64'), payload.size).filter(r =>
          nearEdge(r.i, r.j)
        ),
        payload.size
      )
    ).toString('base64'),
  }
  fs.writeFileSync(file, JSON.stringify(scenery) + '\n')
  return path.basename(file)
}
module.exports = { writeScenery }
