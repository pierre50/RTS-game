const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { decodeMapBlueprintPayload } = loadTsModule('app/serialization/MapBlueprintDecoding.ts')
const { createSquareLocalBlueprint } = loadTsModule('app/classes/map/generation/LocalMapBlueprint.ts')
const root = path.join(__dirname, '../public/maps/worlds/world-4242')

test('final world files decode exactly and load without terrain generation or coordinate conversion', async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')))
  const entry = manifest.maps.find(entry => entry.region.x === 2 && entry.region.y === 0)
  const payload = JSON.parse(fs.readFileSync(path.join(root, 'maps', entry.path)))
  assert.equal(payload.version, 2)
  const blueprint = await decodeMapBlueprintPayload(payload, entry, {})
  assert.equal(createSquareLocalBlueprint(blueprint), blueprint)
  const encodedRelief = new Int8Array(Buffer.from(payload.relief, 'base64'))
  const encodedTerrain = Buffer.from(payload.terrain, 'base64')
  const n = blueprint.size + 1
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (encodedTerrain[i * n + j] === 255) assert.equal(blueprint.terrain[i][j], undefined)
      else assert.equal(blueprint.relief[i][j], encodedRelief[i * n + j])
    }
  class Cell {
    constructor(options) {
      Object.assign(this, options)
    }
  }
  const { MapBlueprintGeneration } = loadTsModule('app/classes/map/generation/MapBlueprintGeneration.ts', {
    mocks: {
      'pixi.js': { Assets: { cache: { get: () => ({ cells: {}, resources: {} }) } } },
      '../../Resource': { Resource: class {} },
      '../../cell': { Cell, GenerationCell: Cell },
      '../NeighborScenery': { setNeighborScenerySource() {} },
      '../../../lib': { createDeterministicCellVariantPicker: () => () => undefined },
    },
  })
  const unexpected = () => assert.fail('loading must not modify terrain')
  for (const editable of [false, true]) {
    const map = {
      context: { app: {}, gamebox: {}, map: {}, scheduler: {} },
      grid: [],
      addChild: cell => cell,
      resetRandom() {},
      invalidateReliefCoastDistances() {},
      formatCellsWaterBorder() {},
      fillWaterGaps: unexpected,
      normalizeWaterTopology: unexpected,
      generateMapRelief: unexpected,
      clampReliefAroundWater: unexpected,
      enforceReliefStepContinuity: unexpected,
    }
    const generation = new MapBlueprintGeneration(
      map,
      async () => {},
      () => {}
    )
    generation.loadBlueprintResources = () => {}
    if (editable) generation.generateEditableFromBlueprint(blueprint)
    else await generation.generateFromBlueprint(blueprint)
    for (const row of map.grid)
      for (const cell of row) {
        if (!cell) continue
        assert.equal(cell.z, blueprint.relief[cell.i][cell.j])
        assert.equal(cell.type, blueprint.terrain[cell.i][cell.j])
      }
  }
})

test('final world files reject inconsistent grid dimensions', async () => {
  const entry = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).maps[0]
  const payload = JSON.parse(fs.readFileSync(path.join(root, 'maps', entry.path)))
  for (const patch of [{ size: 144 }, { sourceSize: 1 }, { localGridLayout: {} }, { terrain: '' }, { relief: '' }]) {
    await assert.rejects(decodeMapBlueprintPayload({ ...payload, ...patch }, entry, {}))
  }
})
