const { buildHeadlessMap, createResourceScope } = require('./headless-map.cjs')
const { runtimeNeutralResources, runtimeBiomeTrees } = require('./headless-loader.cjs')
const { createMacroTreeOptions } = require('./macro.cjs')
const { prepareContent } = require('./prepared-content.cjs')
const { TERRAIN, MACRO_ENVIRONMENT_BY_CODE } = require('./config.cjs')
const { isClearing, CLEARING_RADIUS } = require('../caves/sites.cjs')

// Overlap keeps the runtime placement border outside each retained core.
const CORE = 144
const HALO = 24
const EDGE = CORE + 2 * HALO

async function generateLargeContent(
  terrain,
  size,
  settlements,
  seed,
  onProgress = () => {},
  biomeCodes = null,
  caves = [],
  camps = []
) {
  const stride = size + 1
  const resources = [],
    animals = [],
    appearance = []
  const valueAt = (i, j) => (i < 0 || j < 0 || i > size || j > size ? 255 : terrain[i * stride + j])
  const isLand = type => type !== 255 && type !== 2
  const fallbackCodes = ['T', 'D', 'W', 'J', 'F', 'T', 'W', 'T']
  const codeAt = (i, j) =>
    isLand(valueAt(i, j))
      ? biomeCodes
        ? String.fromCharCode(biomeCodes[i * stride + j])
        : fallbackCodes[valueAt(i, j)]
      : 'W'
  let done = 0
  for (let startI = 0; startI <= size; startI += CORE) {
    for (let startJ = 0; startJ <= size; startJ += CORE) {
      let hasLand = false
      for (let i = startI; i < Math.min(stride, startI + CORE) && !hasLand; i++) {
        for (let j = startJ; j < Math.min(stride, startJ + CORE); j++) {
          if (isLand(valueAt(i, j))) {
            hasLand = true
            break
          }
        }
      }
      if (!hasLand) continue
      const originI = startI - HALO,
        originJ = startJ - HALO
      const grid = Array.from({ length: EDGE }, (_, i) =>
        Array.from({ length: EDGE }, (_, j) =>
          valueAt(originI + i, originJ + j) === 255 ? 2 : valueAt(originI + i, originJ + j)
        )
      )
      const rows = grid.map((row, i) => row.map((_value, j) => codeAt(originI + i, originJ + j)).join(''))
      const spawns = settlements.map(({ local }) => ({ i: local.i - originI, j: local.j - originJ }))
      const localCaves = caves
        .filter(
          cave =>
            cave.i >= originI - CLEARING_RADIUS &&
            cave.i < originI + EDGE + CLEARING_RADIUS &&
            cave.j >= originJ - CLEARING_RADIUS &&
            cave.j < originJ + EDGE + CLEARING_RADIUS
        )
        .map(cave => ({ ...cave, i: cave.i - originI, j: cave.j - originJ }))
      const localCamps = camps
        .filter(
          camp =>
            camp.i >= originI - 8 && camp.i < originI + EDGE + 8 && camp.j >= originJ - 8 && camp.j < originJ + EDGE + 8
        )
        .map(camp => ({ ...camp, i: camp.i - originI, j: camp.j - originJ }))
      const reserved = entry =>
        localCamps.some(camp => Math.abs(entry.i - camp.i) <= 8 && Math.abs(entry.j - camp.j) <= 8) ||
        localCaves.some(cave => isClearing(entry, cave))
      // Match world-region generation: dominant biome controls resource density,
      // while the actual cell code controls tree family, forest noise and animals.
      const counts = new Map()
      for (let i = HALO; i < HALO + CORE; i++)
        for (let j = HALO; j < HALO + CORE; j++) {
          const code = rows[i][j]
          if (code !== 'W') counts.set(code, (counts.get(code) ?? 0) + 1)
        }
      const dominantCode = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
      const environment = MACRO_ENVIRONMENT_BY_CODE[dominantCode] ?? 'Temperate'
      const map = buildHeadlessMap(grid, EDGE - 1, seed + startI * stride + startJ, spawns, spawns.length, environment)
      map.formatCellsWaterBorder()
      const scope = createResourceScope(map)
      const options = createMacroTreeOptions(rows, 'Grass', seed, { i: originI, j: originJ })
      await runtimeNeutralResources.call(scope, spawns, options)
      await runtimeBiomeTrees.call(scope, spawns, options)
      const localResources = [...map.resources]
        .filter(resource => !reserved(resource))
        .map(({ type, i, j, quantity, textureName, startsMature }) => ({
          type,
          i,
          j,
          ...(quantity !== undefined ? { quantity } : {}),
          ...(textureName ? { textureName } : {}),
          ...(startsMature ? { startsMature } : {}),
        }))
      const content = prepareContent({
        size: EDGE - 1,
        seed: map.seed,
        environment,
        macroTerrainRows: rows,
        terrain: grid.map(row => row.map(value => TERRAIN[value])),
        relief: grid.map(row => row.map(() => 0)),
        spawns,
        resources: localResources,
        caves: localCaves,
        banditCampPositions: localCamps,
      })
      const keep = entry =>
        !reserved(entry) &&
        entry.i >= HALO &&
        entry.i < HALO + CORE &&
        entry.j >= HALO &&
        entry.j < HALO + CORE &&
        isLand(valueAt(entry.i + originI, entry.j + originJ))
      const move = entry => ({ ...entry, i: entry.i + originI, j: entry.j + originJ })
      resources.push(...localResources.filter(keep).map(move))
      animals.push(...content.animals.filter(keep).map(move))
      appearance.push(
        ...content.terrainAppearance
          .filter(
            entry =>
              entry.i >= HALO &&
              entry.i < HALO + CORE &&
              entry.j >= HALO &&
              entry.j < HALO + CORE &&
              isLand(valueAt(entry.i + originI, entry.j + originJ))
          )
          .map(move)
      )
      done++
    }
    onProgress({ rows: Math.min(stride, startI + CORE), totalRows: stride, patches: done, resources: resources.length })
  }
  return { resources, animals, appearance }
}
module.exports = { generateLargeContent }
