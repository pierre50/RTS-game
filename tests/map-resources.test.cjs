const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadMapResources() {
  const filename = path.join(__dirname, '../app/classes/map/resources/MapResources.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../Resource': {
      Resource: class {
        constructor(options) {
          Object.assign(this, options)
        }
      },
    },
    '../../constants': {
      RESOURCE_TYPES: {
        berrybush: 'Berrybush',
        wheat: 'Wheat',
        medicinalHerb: 'MedicinalHerb',
        toxicHerb: 'ToxicHerb',
        fiberPlant: 'FiberPlant',
        stone: 'Stone',
        copper: 'Copper',
        iron: 'Iron',
        gold: 'Gold',
        tree: 'Tree',
      },
      SPACED_RESOURCE_TYPES: [
        'Berrybush',
        'Wheat',
        'MedicinalHerb',
        'ToxicHerb',
        'FiberPlant',
        'Stone',
        'Copper',
        'Iron',
        'Gold',
        'Tree',
      ],
      BIOME_TREE_CHANCE: {},
      BIOME_TREE_PLAYER_SAFE_DIST: 10,
      WATER_BORDER_PLACEMENT_CLEARANCE: 2,
      getEnvironmentTerrainParams: environment => ({
        forestDensity:
          {
            Temperate: 0.2,
            BlackForest: 0.3,
            Jungle: 0.3,
            Desert: 0.1,
            Steppe: 1,
          }[environment] ?? 0.2,
      }),
    },
    '../../lib': {
      hasWaterBorderWithin: () => false,
    },
    '../../../config/gameplay': {
      NATURAL_RESOURCE_REGROWTH_BY_TYPE: {
        Berrybush: { respawnDelayDays: 3, respawnQuantityRatio: 0.5 },
        Wheat: { respawnDelayDays: 2, respawnQuantityRatio: 0.5 },
        MedicinalHerb: { respawnDelayDays: 2, respawnQuantityRatio: 0.5 },
        ToxicHerb: { respawnDelayDays: 2, respawnQuantityRatio: 0.5 },
        FiberPlant: { respawnDelayDays: 2, respawnQuantityRatio: 0.5 },
        Stone: { respawnDelayDays: 7, respawnQuantityRatio: 0.2 },
        Gold: { respawnDelayDays: 14, respawnQuantityRatio: 0.15 },
        Copper: { respawnDelayDays: 10, respawnQuantityRatio: 0.15 },
        Iron: { respawnDelayDays: 14, respawnQuantityRatio: 0.15 },
      },
    },
  }
  const loadLocalTs = modulePath => {
    const localFilename = path.join(__dirname, '../app/classes/map', modulePath)
    const localSource = fs.readFileSync(localFilename, 'utf8')
    const { code: localCode } = babel.transformSync(localSource, {
      filename: localFilename,
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        '@babel/preset-typescript',
      ],
    })
    const localModule = { exports: {} }
    new Function('module', 'exports', 'require', localCode)(localModule, localModule.exports, localRequire)
    return localModule.exports
  }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    if (request === './resources/MapForestResources') return loadLocalTs('MapForestResources.ts')
    if (request === './resources/MapResourceSpacing') return loadLocalTs('MapResourceSpacing.ts')
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { MapResources, getNeutralResourceGroupCount, getScatteredHerbCount, getScatteredStoneCount } = loadMapResources()

test('neutral resource groups lean by environment without changing starting resources', () => {
  assert.equal(getNeutralResourceGroupCount('moderate', 'Temperate', 'berrybush', 120), 2)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Temperate', 'wheat', 120), 2)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Temperate', 'stone', 120), 3)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Temperate', 'gold', 120), 1)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Temperate', 'tree', 120), 1)

  assert.equal(getNeutralResourceGroupCount('moderate', 'Desert', 'berrybush', 120), 1)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Desert', 'wheat', 120), 0)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Desert', 'stone', 120), 2)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Desert', 'copper', 120), 2)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Desert', 'gold', 120), 1)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Desert', 'tree', 120), 0)

  assert.equal(getNeutralResourceGroupCount('moderate', 'Jungle', 'berrybush', 120), 2)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Jungle', 'wheat', 120), 1)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Jungle', 'stone', 120), 2)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Jungle', 'tree', 120), 1)

  assert.equal(getNeutralResourceGroupCount('moderate', 'BlackForest', 'berrybush', 120), 2)
  assert.equal(getNeutralResourceGroupCount('moderate', 'BlackForest', 'wheat', 120), 1)
  assert.equal(getNeutralResourceGroupCount('moderate', 'BlackForest', 'gold', 120), 1)
  assert.equal(getNeutralResourceGroupCount('moderate', 'BlackForest', 'tree', 120), 1)

  assert.equal(getNeutralResourceGroupCount('moderate', 'Steppe', 'berrybush', 120), 2)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Steppe', 'wheat', 120), 2)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Steppe', 'stone', 120), 3)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Steppe', 'tree', 120), 16)
})

test('neutral resource group counts still scale with map area', () => {
  assert.equal(getNeutralResourceGroupCount('moderate', 'Desert', 'stone', 240), 8)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Jungle', 'berrybush', 240), 8)
})

test('scattered stone density varies by environment and map area', () => {
  assert.equal(getScatteredStoneCount('moderate', 'Temperate', 120), 8)
  assert.equal(getScatteredStoneCount('moderate', 'Desert', 120), 8)
  assert.equal(getScatteredStoneCount('moderate', 'Jungle', 120), 5)
  assert.equal(getScatteredStoneCount('moderate', 'Steppe', 120), 7)
  assert.equal(getScatteredStoneCount('moderate', 'Desert', 240), 32)
})

test('scattered herb density varies by environment and map area', () => {
  const toxicHerb = { type: 'ToxicHerb', countMultiplier: { Temperate: 0.65, Jungle: 1.4, Desert: 0.4, Steppe: 0.5 } }

  assert.equal(getScatteredHerbCount('moderate', 'Temperate', 120, toxicHerb), 13)
  assert.equal(getScatteredHerbCount('moderate', 'Jungle', 120, toxicHerb), 28)
  assert.equal(getScatteredHerbCount('moderate', 'Desert', 120, toxicHerb), 8)
  assert.equal(getScatteredHerbCount('moderate', 'Steppe', 120, toxicHerb), 10)
  assert.equal(getScatteredHerbCount('moderate', 'Jungle', 240, toxicHerb), 112)
})

test('berrybush groups share one color variant across the whole cluster', () => {
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      i,
      j,
      solid: false,
      category: 'Land',
      type: 'Grass',
      has: null,
      border: false,
      inclined: false,
    }))
  )
  const map = {
    context: {},
    grid,
    size: 3,
    resources: new Set(),
    random: () => 0,
    randomRange: (min, _max) => min,
    randomItem: items => items[1],
    addChild: child => child,
    placeResourceGroupAt(center, instance, quantity, clusterRadius, options) {
      return mapResources.placeResourceGroupAt(center, instance, quantity, clusterRadius, options)
    },
  }
  const mapResources = new MapResources(map)

  assert.equal(mapResources.placeResourceGroupAt({ i: 1, j: 1 }, 'Berrybush', 3), true)

  const textureNames = [...map.resources].map(resource => resource.textureName)
  assert.deepEqual(textureNames, ['002_resources/berrybush', '002_resources/berrybush', '002_resources/berrybush'])
})

test('tree groups can force a texture family independent of terrain', () => {
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      i,
      j,
      solid: false,
      category: 'Land',
      type: 'Grass',
      has: null,
      border: false,
      inclined: false,
    }))
  )
  const map = {
    context: {},
    grid,
    size: 3,
    resources: new Set(),
    random: () => 0,
    randomRange: (min, _max) => min,
    randomItem: items => items[2],
    addChild: child => child,
  }
  const mapResources = new MapResources(map)
  const textureName = mapResources.pickTreeTextureName('DarkForest')

  assert.equal(textureName, '002_resources/tree/dark-forest')
  assert.equal(mapResources.placeResourceGroupAt({ i: 1, j: 1 }, 'Tree', 1, 1, { textureName }), true)
  assert.deepEqual(
    [...map.resources].map(resource => ({ terrain: grid[resource.i][resource.j].type, textureName: resource.textureName })),
    [{ terrain: 'Grass', textureName: '002_resources/tree/dark-forest' }]
  )
})

test('forced tree groups vary frames inside the same texture family', () => {
  const grid = Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) => ({
      i,
      j,
      solid: false,
      category: 'Land',
      type: 'Grass',
      has: null,
      border: false,
      inclined: false,
    }))
  )
  let frame = 0
  const map = {
    context: {},
    grid,
    size: 5,
    resources: new Set(),
    random: () => 0,
    randomRange: (min, _max) => min,
    randomItem: items => items[frame++ % items.length],
    addChild: child => child,
  }
  const mapResources = new MapResources(map)

  assert.equal(
    mapResources.placeResourceGroupAt({ i: 2, j: 2 }, 'Tree', 3, 2, {
      textureNameFactory: () => mapResources.pickTreeTextureName('DarkForest'),
    }),
    true
  )

  const textureNames = [...map.resources].map(resource => resource.textureName)
  assert.deepEqual(textureNames, [
    '000_resources/tree/dark-forest',
    '001_resources/tree/dark-forest',
    '002_resources/tree/dark-forest',
  ])
})

test('scattered herbs are isolated and use biome-weighted plant types', async () => {
  global.requestAnimationFrame ??= callback => setImmediate(callback)
  const size = 120
  const grid = Array.from({ length: size + 1 }, (_, i) =>
    Array.from({ length: size + 1 }, (_, j) => ({
      i,
      j,
      solid: false,
      category: 'Land',
      type: 'Grass',
      has: null,
      border: false,
      inclined: false,
    }))
  )
  const coordinates = [
    [8, 8],
    [8, 18],
    [8, 28],
    [8, 38],
    [8, 48],
    [8, 58],
    [8, 68],
    [8, 78],
    [18, 8],
    [18, 18],
    [18, 28],
    [18, 38],
    [18, 48],
    [18, 58],
    [18, 68],
    [18, 78],
    [28, 8],
    [28, 18],
    [28, 28],
    [28, 38],
    [28, 48],
    [28, 58],
    [28, 68],
    [28, 78],
    [38, 8],
    [38, 18],
    [38, 28],
    [38, 38],
    [38, 48],
    [38, 58],
    [38, 68],
    [38, 78],
    [48, 8],
    [48, 18],
    [48, 28],
    [48, 38],
    [48, 48],
    [48, 58],
    [48, 68],
    [48, 78],
  ].flat()
  let coordinateIndex = 0
  const map = {
    context: {},
    grid,
    size,
    environment: 'Jungle',
    resourceDensity: 'low',
    resources: new Set(),
    random: () => 0,
    randomRange: () => coordinates[coordinateIndex++],
    randomItem: items => items[0],
    addChild(child) {
      grid[child.i][child.j].has = child
      grid[child.i][child.j].solid = true
      return child
    },
  }
  const mapResources = new MapResources(map)

  await mapResources.generateScatteredHerbsAsync([{ i: 60, j: 60 }])

  const herbs = [...map.resources]
  assert.equal(herbs.filter(herb => herb.type === 'MedicinalHerb').length, 10)
  assert.equal(herbs.filter(herb => herb.type === 'ToxicHerb').length, 14)
  assert.equal(herbs.filter(herb => herb.type === 'FiberPlant').length, 12)
  for (let i = 0; i < herbs.length; i++) {
    for (let j = i + 1; j < herbs.length; j++) {
      assert(Math.max(Math.abs(herbs[i].i - herbs[j].i), Math.abs(herbs[i].j - herbs[j].j)) > 4)
    }
  }
})

test('neutral wheat groups spawn mature', async () => {
  global.requestAnimationFrame ??= callback => setImmediate(callback)
  const calls = []
  const map = {
    context: {},
    grid: [],
    size: 120,
    environment: 'Temperate',
    resourceDensity: 'moderate',
    resources: new Set(),
    random: () => 0,
    randomRange: (min, _max) => min,
    randomItem: items => items[0],
    addChild: child => child,
    findNeutralResourceCenter: () => ({ i: 20 + calls.length, j: 20 + calls.length }),
    placeResourceGroupAt(center, type, quantity, clusterRadius, options) {
      calls.push({ center, type, quantity, clusterRadius, options })
      return true
    },
  }
  const mapResources = new MapResources(map)
  mapResources.generateScatteredStoneAsync = async () => {}

  await mapResources.generateNeutralResourceGroupsAsync([{ i: 60, j: 60 }])

  const wheatCalls = calls.filter(call => call.type === 'Wheat')
  assert.equal(wheatCalls.length, 2)
  assert(wheatCalls.every(call => call.quantity === 4))
  assert(wheatCalls.every(call => call.clusterRadius === 2))
  assert(wheatCalls.every(call => call.options?.startsMature === true))
})

test('scattered stones are isolated and use smaller deposits', async () => {
  global.requestAnimationFrame ??= callback => setImmediate(callback)
  const size = 120
  const grid = Array.from({ length: size + 1 }, (_, i) =>
    Array.from({ length: size + 1 }, (_, j) => ({
      i,
      j,
      solid: false,
      category: 'Land',
      type: 'Grass',
      has: null,
      border: false,
      inclined: false,
    }))
  )
  const coordinates = [
    [8, 8],
    [8, 18],
    [8, 28],
    [8, 38],
    [8, 48],
    [8, 58],
    [8, 68],
    [8, 78],
    [18, 8],
    [18, 18],
    [18, 28],
    [18, 38],
    [18, 48],
    [18, 58],
    [18, 68],
    [18, 78],
    [28, 8],
    [28, 18],
    [28, 28],
    [28, 38],
    [28, 48],
    [28, 58],
    [28, 68],
    [28, 78],
    [38, 8],
    [38, 18],
    [38, 28],
    [38, 38],
    [38, 48],
    [38, 58],
    [38, 68],
    [38, 78],
  ].flat()
  let coordinateIndex = 0
  const map = {
    context: {},
    grid,
    size,
    environment: 'Temperate',
    resourceDensity: 'moderate',
    resources: new Set(),
    random: () => 0,
    randomRange: () => coordinates[coordinateIndex++],
    randomItem: items => items[0],
    addChild(child) {
      grid[child.i][child.j].has = child
      grid[child.i][child.j].solid = true
      return child
    },
  }
  const mapResources = new MapResources(map)

  await mapResources.generateScatteredStoneAsync([{ i: 60, j: 60 }])

  const stones = [...map.resources]
  assert.equal(stones.length, 8)
  assert(stones.every(stone => stone.type === 'Stone'))
  // map.random() always returns 0, so the rolled quantity lands on the range's minimum (15).
  assert(stones.every(stone => stone.quantity === 15))
  for (let i = 0; i < stones.length; i++) {
    for (let j = i + 1; j < stones.length; j++) {
      assert(Math.max(Math.abs(stones[i].i - stones[j].i), Math.abs(stones[i].j - stones[j].j)) > 7)
    }
  }
})

test('mineral respawn restores the original deposit with partial quantity', () => {
  const size = 20
  const grid = Array.from({ length: size + 1 }, (_, i) =>
    Array.from({ length: size + 1 }, (_, j) => ({
      i,
      j,
      solid: false,
      category: 'Land',
      type: 'Grass',
      has: null,
      border: false,
      inclined: false,
    }))
  )
  const map = {
    context: {},
    grid,
    size,
    resources: new Set(),
    random: () => 0,
    randomRange: (min, _max) => min,
    randomItem: items => items[0],
    addChild(child) {
      grid[child.i][child.j].has = child
      grid[child.i][child.j].solid = true
      return child
    },
  }
  const mapResources = new MapResources(map)

  assert.equal(mapResources.respawnNaturalResource({ i: 6, j: 7, totalQuantity: 4, type: 'Gold' }), true)

  const [gold] = [...map.resources]
  assert.equal(gold.type, 'Gold')
  assert.equal(gold.i, 6)
  assert.equal(gold.j, 7)
  assert.equal(gold.quantity, 1)
  assert.equal(gold.totalQuantity, 4)
})

test('wild herb respawn restores the original plant with partial quantity', () => {
  const size = 20
  const grid = Array.from({ length: size + 1 }, (_, i) =>
    Array.from({ length: size + 1 }, (_, j) => ({
      i,
      j,
      solid: false,
      category: 'Land',
      type: 'Grass',
      has: null,
      border: false,
      inclined: false,
    }))
  )
  const map = {
    context: {},
    grid,
    size,
    resources: new Set(),
    random: () => 0,
    randomRange: (min, _max) => min,
    randomItem: items => items[0],
    addChild(child) {
      grid[child.i][child.j].has = child
      grid[child.i][child.j].solid = true
      return child
    },
  }
  const mapResources = new MapResources(map)

  assert.equal(mapResources.respawnNaturalResource({ i: 5, j: 6, totalQuantity: 5, type: 'MedicinalHerb' }), true)

  const [herb] = [...map.resources]
  assert.equal(herb.type, 'MedicinalHerb')
  assert.equal(herb.i, 5)
  assert.equal(herb.j, 6)
  assert.equal(herb.quantity, 3)
  assert.equal(herb.totalQuantity, 5)
})
