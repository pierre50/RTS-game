const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const ROOT = path.join(__dirname, '..')
const TERRAIN_TYPES = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest', 'Dirt', '', 'Snow']
const DIRT_INDEX = TERRAIN_TYPES.indexOf('Dirt')
const WATER_INDEX = TERRAIN_TYPES.indexOf('Water')

function installInteriorMapFetch(root) {
  const originalFetch = global.fetch
  global.fetch = async url => {
    const filePath = path.join(root, String(url).replace(/^maps\/interiors\//, ''))
    return new Response(fs.readFileSync(filePath, 'utf8'), { status: 200 })
  }
  return () => {
    global.fetch = originalFetch
  }
}

test('interior generator writes size-based circular dirt blueprints for supported buildings', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'interior-blueprint-'))

  try {
    execFileSync(
      process.execPath,
      [
        path.join(ROOT, 'tools/generate-interior-maps.cjs'),
        '--type',
        'all',
        '--count',
        '1',
        '--seed',
        '12345',
        '--out',
        out,
      ],
      { cwd: ROOT, stdio: 'pipe' }
    )

    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'))
    assert.equal(manifest.format, 'interior-map-manifest')
    assert.equal(manifest.blueprints.length, 2)
    assert.equal(manifest.buildingTypes.length, 9)
    assert.equal(Object.hasOwn(manifest, 'generatedAt'), false)
    assert.deepEqual(
      manifest.blueprints.map(blueprint => [blueprint.id, blueprint.buildingSize, blueprint.size, blueprint.path]),
      [
        ['building-size-3-001', 3, 13, 'size-3/building-size-3-001.map'],
        ['building-size-2-001', 2, 11, 'size-2/building-size-2-001.map'],
      ]
    )
    assert.deepEqual(
      manifest.buildingTypes.map(entry => [entry.buildingType, entry.buildingSize, entry.blueprintId, entry.id]),
      [
        ['TownCenter', 3, 'building-size-3-001', 'town-center-size-3-001'],
        ['House', 2, 'building-size-2-001', 'house-size-2-001'],
        ['Barracks', 3, 'building-size-3-001', 'barracks-size-3-001'],
        ['ArcheryRange', 3, 'building-size-3-001', 'archery-range-size-3-001'],
        ['Temple', 2, 'building-size-2-001', 'temple-size-2-001'],
        ['Granary', 3, 'building-size-3-001', 'granary-size-3-001'],
        ['StoragePit', 3, 'building-size-3-001', 'storage-pit-size-3-001'],
        ['Stable', 3, 'building-size-3-001', 'stable-size-3-001'],
        ['WatchTower', 2, 'building-size-2-001', 'watch-tower-size-2-001'],
      ]
    )

    for (const entry of manifest.blueprints) {
      const blueprintPath = path.join(out, entry.path)
      const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'))
      const expectedCells = (blueprint.size + 1) ** 2
      const terrain = Buffer.from(blueprint.terrain, 'base64')
      const relief = Buffer.from(blueprint.relief, 'base64')
      const floorMask = Buffer.from(blueprint.floorMask, 'base64')
      const borderMask = Buffer.from(blueprint.borderMask, 'base64')

      assert.equal(blueprint.kind, 'interior')
      assert.equal(blueprint.buildingSize, entry.buildingSize)
      assert.equal(blueprint.size, entry.size)
      assert.equal(blueprint.floorShape.type, 'circle')
      assert.equal(blueprint.cellCount, expectedCells)
      assert.equal(terrain.length, expectedCells)
      assert.equal(relief.length, expectedCells)
      assert.equal(floorMask.length, expectedCells)
      assert.equal(borderMask.length, expectedCells)
      assert.ok([...relief].every(value => value === 0))
      assert.ok([...floorMask].some(value => value === 1))
      assert.ok([...floorMask].some(value => value === 0))
      assert.ok([...borderMask].some(value => value === 1))
      assert.ok([...terrain].some(value => value === DIRT_INDEX))
      assert.ok([...terrain].some(value => value === WATER_INDEX))
      for (let index = 0; index < expectedCells; index++) {
        if (borderMask[index]) assert.equal(floorMask[index], 1)
        if (floorMask[index]) assert.equal(terrain[index], DIRT_INDEX)
        else assert.equal(terrain[index], WATER_INDEX)
      }
      if (entry.buildingSize === 2) {
        assert.deepEqual(blueprint.spawns, [{ i: 6, j: 8 }])
        assert.deepEqual(blueprint.exits, [{ id: 'main', i: 6, j: 8, direction: 'south' }])
      } else {
        assert.deepEqual(blueprint.spawns, [{ i: 7, j: 10 }])
        assert.deepEqual(blueprint.exits, [{ id: 'main', i: 7, j: 10, direction: 'south' }])
      }
    }

    for (const entry of manifest.buildingTypes) {
      assert.match(entry.legacyId, /-circle-001$/)
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true })
  }
})

test('interior blueprint loader selects by building size while keeping type-specific ids', async () => {
  const restoreFetch = installInteriorMapFetch(path.join(ROOT, 'public/maps/interiors'))

  try {
    const { loadPregeneratedInteriorBlueprint } = loadTsModule('app/serialization/MapBlueprintLoader.ts', {
      mocks: {
        '../constants': { DEFAULT_ENVIRONMENT_ID: 'temperate' },
      },
    })

    const stable = await loadPregeneratedInteriorBlueprint({
      buildingSize: 3,
      buildingType: 'Stable',
      random: () => 0,
    })
    assert.equal(stable.id, 'stable-size-3-001')
    assert.equal(stable.interiorType, 'Stable')
    assert.equal(stable.buildingSize, 3)
    assert.equal(stable.size, 13)

    const legacyStable = await loadPregeneratedInteriorBlueprint({ id: 'stable-circle-001' })
    assert.equal(legacyStable.id, 'stable-size-3-001')
    assert.equal(legacyStable.interiorType, 'Stable')
    assert.equal(legacyStable.buildingSize, 3)
  } finally {
    restoreFetch()
  }
})

test('interior blueprint masks make cells beyond the dirt floor solid', () => {
  const { MapBlueprintGeneration } = loadTsModule('app/classes/map/generation/MapBlueprintGeneration.ts', {
    mocks: {
      'pixi.js': { Assets: { cache: { get: () => ({ resources: {}, cells: {} }) } } },
      '../../Resource': { Resource: class {} },
      '../../cell': { Cell: class {}, GenerationCell: class {} },
      '../../../lib': { createDeterministicCellVariantPicker: () => () => undefined },
    },
  })
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      i,
      j,
      border: false,
      category: 'Dirt',
      has: null,
      solid: false,
      sprite: { renderable: true },
      terrainHidden: false,
      waterBorder: false,
    }))
  )
  const map = { grid, size: 2 }
  const generation = new MapBlueprintGeneration(
    map,
    async () => {},
    () => {}
  )

  generation.applyInteriorMasks({
    kind: 'interior',
    floorMask: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ],
    borderMask: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ],
  })

  assert.equal(grid[1][1].solid, false)
  assert.equal(grid[1][1].border, true)
  assert.equal(grid[1][1].terrainHidden, false)
  assert.equal(grid[0][1].solid, true)
  assert.equal(grid[0][1].terrainHidden, true)
  assert.equal(grid[0][1].sprite.renderable, false)
})

test('interior blueprint exits remain passable when placed on the dirt border', () => {
  const { MapBlueprintGeneration } = loadTsModule('app/classes/map/generation/MapBlueprintGeneration.ts', {
    mocks: {
      'pixi.js': { Assets: { cache: { get: () => ({ resources: {}, cells: {} }) } } },
      '../../Resource': { Resource: class {} },
      '../../cell': { Cell: class {}, GenerationCell: class {} },
      '../../../lib': { createDeterministicCellVariantPicker: () => () => undefined },
    },
  })
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      i,
      j,
      border: false,
      category: 'Dirt',
      has: null,
      solid: false,
      sprite: { renderable: true },
      terrainHidden: false,
      waterBorder: false,
    }))
  )
  const map = { grid, size: 2 }
  const generation = new MapBlueprintGeneration(
    map,
    async () => {},
    () => {}
  )

  generation.applyInteriorMasks({
    exits: [{ i: 1, j: 1 }],
    kind: 'interior',
    floorMask: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ],
    borderMask: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ],
  })

  assert.equal(grid[1][1].solid, false)
  assert.equal(grid[1][1].border, false)
  assert.equal(grid[1][1].terrainHidden, false)
})
