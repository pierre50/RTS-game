const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const ROOT = path.join(__dirname, '..')
const TERRAIN_TYPES = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest', 'Dirt', '', 'Snow']
const WATER_INDEX = TERRAIN_TYPES.indexOf('Water')

function loadPlainTsModule(relativePath) {
  const filename = path.join(ROOT, relativePath)
  const { code } = babel.transformFileSync(filename, {
    presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

const { RELIEF_WATER_BUFFER_RADIUS } = loadPlainTsModule('app/constants/terrain.ts')

test('public maps expose only the world preview format used by the UI', () => {
  const mapsRoot = path.join(ROOT, 'public/maps')
  const worldDirectory = fs
    .readdirSync(path.join(mapsRoot, 'worlds'))
    .find(name => fs.existsSync(path.join(mapsRoot, 'worlds', name, 'manifest.json')))
  const worldManifestPath = path.join(mapsRoot, 'worlds', worldDirectory, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(worldManifestPath, 'utf8'))

  assert.equal(fs.existsSync(path.join(mapsRoot, '144')), false, 'legacy root 144 map folder should be removed')
  assert.equal(fs.existsSync(path.join(mapsRoot, 'manifest.json')), false, 'legacy root map manifest should be removed')
  assert.equal(
    fs.existsSync(path.join(mapsRoot, 'macro-world-preview.png')),
    false,
    'legacy root preview should be removed'
  )
  assert.equal(
    fs.existsSync(path.join(mapsRoot, 'worlds/world-4242/macro-world-preview-iso.png')),
    false,
    'worlds should not include the removed ISO preview'
  )
  assert.equal(manifest.macroPreviewPath, 'macro-world-preview.png')
  assert.equal(Object.hasOwn(manifest, 'macroIsoPreviewPath'), false)
  assert.equal(Object.hasOwn(manifest, 'isoPreview'), false)
})

test('blueprint resources accept direct sheet/frame texture assets', () => {
  class Resource {
    constructor(options) {
      Object.assign(this, options)
    }
  }
  const { MapBlueprintGeneration } = loadTsModule('app/classes/map/generation/MapBlueprintGeneration.ts', {
    mocks: {
      'pixi.js': {
        Assets: {
          cache: {
            get: () => ({
              cells: {},
              resources: {
                MedicinalHerb: {
                  assets: { sheet: 'resources/wildgrass', frame: 0 },
                },
              },
            }),
          },
        },
      },
      '../../Resource': { Resource },
      '../NeighborScenery': { setNeighborScenerySource() {} },
      '../../cell': { Cell: class {}, GenerationCell: class {} },
      '../../../lib': { createDeterministicCellVariantPicker: () => () => undefined },
    },
  })
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      i,
      j,
      border: false,
      category: 'Land',
      has: null,
      solid: false,
      type: 'Grass',
    }))
  )
  const map = {
    context: {
      app: {},
      gamebox: {},
      map: null,
      performance: { record: () => {} },
      scheduler: {},
    },
    grid,
    resources: new Set(),
    size: 2,
    addChild: child => child,
  }
  map.context.map = map
  const generation = new MapBlueprintGeneration(
    map,
    async () => {},
    () => {}
  )

  generation.loadBlueprintResources({
    resources: [{ type: 'MedicinalHerb', i: 1, j: 1, quantity: 2 }],
  })

  assert.equal(map.resources.size, 1)
  assert.equal([...map.resources][0].type, 'MedicinalHerb')
})

function getWaterBorderFrame({ n, s, w, e, nw, ne, sw, se }) {
  if (w && n) return '001'
  if (e && s) return '002'
  if (w && s) return '003'
  if (e && n) return '000'
  if (n) return '008'
  if (s) return '009'
  if (w) return '011'
  if (e) return '010'
  if (nw) return '005'
  if (sw) return '007'
  if (ne) return '004'
  if (se) return '006'
  return null
}

test('world region blueprints persist macro water terrain', async () => {
  globalThis.requestAnimationFrame ??= callback => setImmediate(() => callback(0))
  const { blueprint: generateBlueprint } = require('../tools/maps/blueprint.cjs')
  const rows = Array.from({ length: 145 }, (_, i) => (i < 20 ? 'W'.repeat(145) : 'T'.repeat(145)))
  const blueprint = await generateBlueprint(144, 98765, 'Temperate', {
    macroTerrainRows: rows,
    spawns: [{ i: 72, j: 72 }],
  })
  assert.ok(blueprint)
  assert.equal(blueprint.mapType, 'world-region')
  const terrain = Buffer.from(blueprint.terrain, 'base64')
  const relief = Buffer.from(blueprint.relief, 'base64')
  const width = blueprint.size + 1
  let shoreLevelViolations = 0
  let reliefStepViolations = 0
  let waterBufferViolations = 0
  let spawnPlateauViolations = 0

  const isMissing = (i, j) => terrain[i * width + j] === 255
  const isWater = (i, j) => {
    return terrain[i * width + j] === WATER_INDEX
  }
  const getRelief = (i, j) => relief.readInt8(i * width + j)

  const waterDistances = new Int16Array(width * width).fill(32767)
  const waterQueue = []
  for (let i = 0; i <= blueprint.size; i++) {
    for (let j = 0; j <= blueprint.size; j++) {
      if (!isWater(i, j)) continue
      const index = i * width + j
      waterDistances[index] = 0
      waterQueue.push(index)
    }
  }
  for (let cursor = 0; cursor < waterQueue.length; cursor++) {
    const index = waterQueue[cursor]
    const i = Math.floor(index / width)
    const j = index % width
    for (const [di, dj] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const ni = i + di
      const nj = j + dj
      if (ni < 0 || ni > blueprint.size || nj < 0 || nj > blueprint.size) continue
      const next = ni * width + nj
      if (waterDistances[next] <= waterDistances[index] + 1) continue
      waterDistances[next] = waterDistances[index] + 1
      waterQueue.push(next)
    }
  }

  for (let i = 0; i <= blueprint.size; i++) {
    for (let j = 0; j <= blueprint.size; j++) {
      if (waterDistances[i * width + j] <= RELIEF_WATER_BUFFER_RADIUS && getRelief(i, j) !== 0) {
        waterBufferViolations++
      }
      if (isMissing(i, j) || isWater(i, j)) continue
      const flags = {
        n: i > 0 && isWater(i - 1, j),
        s: i < blueprint.size && isWater(i + 1, j),
        w: j > 0 && isWater(i, j - 1),
        e: j < blueprint.size && isWater(i, j + 1),
        nw: i > 0 && j > 0 && isWater(i - 1, j - 1),
        ne: i > 0 && j < blueprint.size && isWater(i - 1, j + 1),
        sw: i < blueprint.size && j > 0 && isWater(i + 1, j - 1),
        se: i < blueprint.size && j < blueprint.size && isWater(i + 1, j + 1),
      }
      if (!getWaterBorderFrame(flags)) continue

      let shoreLevel = getRelief(i, j)
      for (const [di, dj] of [
        [-1, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
        [1, 0],
        [1, -1],
        [0, -1],
        [-1, -1],
      ]) {
        const ni = i + di
        const nj = j + dj
        if (ni >= 0 && ni <= blueprint.size && nj >= 0 && nj <= blueprint.size && isWater(ni, nj)) {
          shoreLevel = getRelief(ni, nj)
          break
        }
      }
      if (getRelief(i, j) !== shoreLevel) shoreLevelViolations++
    }
  }

  for (const spawn of blueprint.spawns || []) {
    for (let i = Math.max(0, spawn.i - 6); i <= Math.min(blueprint.size, spawn.i + 6); i++) {
      for (let j = Math.max(0, spawn.j - 6); j <= Math.min(blueprint.size, spawn.j + 6); j++) {
        if (getRelief(i, j) !== 0) spawnPlateauViolations++
      }
    }
  }

  for (let i = 0; i <= blueprint.size; i++) {
    for (let j = 0; j <= blueprint.size; j++) {
      if (isMissing(i, j) || isWater(i, j)) continue
      for (const [di, dj] of [
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ]) {
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || ni > blueprint.size || nj < 0 || nj > blueprint.size || isMissing(ni, nj) || isWater(ni, nj))
          continue
        if (Math.abs(getRelief(i, j) - getRelief(ni, nj)) > 1) reliefStepViolations++
      }
    }
  }

  assert.ok(terrain.includes(WATER_INDEX), 'blueprint terrain should include Water cells')
  assert.equal(shoreLevelViolations, 0, 'blueprint relief should keep shore cells at water level')
  assert.equal(
    waterBufferViolations,
    0,
    `blueprint relief should keep a ${RELIEF_WATER_BUFFER_RADIUS}-cell water buffer at z=0`
  )
  assert.equal(spawnPlateauViolations, 0, 'blueprint relief should keep Town Center spawn zones at z=0')
  assert.equal(reliefStepViolations, 0, 'blueprint relief should not contain unsupported height jumps')
  assert.equal(
    (blueprint.resources || []).some(resource => ['Salmon', 'Fish', 'RiverFish', 'Whale'].includes(resource.type)),
    false,
    'blueprint resources should not include removed fish resource types'
  )
})

test('macro terrain is authoritative and malformed regions cannot fall back to local generation', () => {
  const { createMacroTerrain } = require('../tools/maps/macro.cjs')
  assert.deepEqual(createMacroTerrain(3, ['WTF', 'JDS', 'WWW']), [
    [2, 0, 4],
    [3, 1, 0],
    [2, 2, 2],
  ])
  assert.throws(() => createMacroTerrain(3), /requires 3 macro terrain rows/)
  assert.throws(() => createMacroTerrain(3, ['WWW']), /requires 3 macro terrain rows/)
  assert.throws(() => createMacroTerrain(3, ['WWW', 'TT', 'FFF']), /Invalid macro terrain row/)
  assert.throws(() => createMacroTerrain(3, ['WWW', 'TXT', 'FFF']), /Unknown macro terrain code/)
})
