const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

class Container {
  constructor(options = {}) {
    Object.assign(this, options)
    this.children = []
    this.position = { set: (x, y) => Object.assign(this, { x, y }) }
    this.scale = { set() {} }
    this.anchor = { copyFrom() {} }
  }
  addChild(child) {
    this.children.push(child)
    return child
  }
  destroy() {}
}
class Sprite extends Container {
  constructor(texture) {
    super()
    this.texture = texture
  }
}
class GenerationCell {
  constructor(options) {
    Object.assign(this, options)
    this.category = 'Land'
    this._terrainAppearance = {}
  }
}
class TerrainBakeCell {
  constructor(cell) {
    this.cell = cell
  }
  getTerrainBakeChildren() {
    return [new Sprite({ cell: this.cell })]
  }
}
const constants = { CELL_WIDTH: 64, CELL_HEIGHT: 32, CELL_DEPTH: 16 }
const mocks = {
  'pixi.js': { Container, Sprite, Assets: { cache: { get: () => ({ resources: {} }) } } },
  '../../constants': constants,
  '../constants': constants,
  '../../lib': {
    getGroundReliefLevel: cell => cell.z,
    getInstanceZIndex: p => p.y / 16,
    getTexture: name => ({ name, width: 64, height: 160, defaultAnchor: { x: 0.5, y: 1 } }),
  },
  '../cell/GenerationCell': { GenerationCell },
  '../cell/TerrainBakeCell': { TerrainBakeCell },
  './terrain/MapTerrainAppearance': {
    formatTerrainPatchBorders() {},
    formatTerrainWaterBorder() {},
    formatTerrainWaterBorderOverlays() {},
  },
  './terrain/MapTerrainReliefAppearance': { formatTerrainRelief() {} },
}
const { buildNeighborScenery, setNeighborScenerySource, updateNeighborSceneryVisibility } = loadTsModule(
  'app/classes/map/NeighborScenery.ts',
  { mocks }
)
const { createSquareLocalBlueprint } = loadTsModule('app/classes/map/generation/LocalMapBlueprint.ts', { mocks })

function fixture(saved = null) {
  const base = () => ({ size: 20, terrain: Array.from({ length: 21 }, () => Array(21).fill('Grass')) })
  const source = createSquareLocalBlueprint({ ...base(), worldRegion: { x: 1, y: 1 } })
  source.visualNeighbors = [
    {
      region: { x: 1, y: 2 },
      blueprint: {
        ...base(),
        // j=2 is the west edge facing this region; j=10 is beyond the visible strip.
        resources: [
          { i: 2, j: 2, type: 'Tree', textureName: 'tree:7' },
          { i: 2, j: 10, type: 'Tree', textureName: 'tree:far' },
        ],
      },
    },
  ]
  const map = Object.assign(new Container(), {
    localGridLayout: source.localGridLayout,
    grid: source.terrain.map(row => row.map(type => ({ type, viewed: false }))),
    context: { getCampaignWorldState: () => saved },
    worldManifest: { maps: [{ id: 'east', region: { x: 1, y: 2 } }] },
    revealEverything: false,
  })
  setNeighborScenerySource(map, source)
  return { map, source }
}

test('border scenery keeps the playable grid intact and copies actual neighboring tree textures', () => {
  const { map } = fixture()
  const before = JSON.stringify(map.grid)
  buildNeighborScenery(map)
  assert.equal(JSON.stringify(map.grid), before)
  const terrain = map.children.find(c => c.label === 'neighborTerrain')
  assert.ok(terrain.children.length > 0 && terrain.children.length < 21 * 21)
  const tree = map.children.find(c => c.texture?.name === 'tree:7')
  assert.ok(tree)
  assert.equal(
    map.children.some(c => c.texture?.name === 'tree:far'),
    false
  )
  assert.equal(tree.x, 416)
  assert.equal(tree.eventMode, 'none')
  assert.equal(tree.visible, true)
  map.revealEverything = true
  updateNeighborSceneryVisibility(map)
  assert.equal(tree.visible, true)
  map.revealEverything = false
  updateNeighborSceneryVisibility(map)
  assert.equal(tree.visible, true)
})

test('a harvested neighboring tree stays absent when the region has saved resources', () => {
  const { map } = fixture({ world: { localGridLayout: { columns: 12, rows: 45 } }, resources: [] })
  buildNeighborScenery(map)
  assert.equal(map.children.filter(c => c.texture?.name === 'tree:7').length, 0)
})

test('camera-only scenery does not rewrite visibility for every decoration', () => {
  const { map } = fixture()
  buildNeighborScenery(map)
  const tree = map.children.find(c => c.texture?.name === 'tree:7')
  let writes = 0
  Object.defineProperty(tree, 'visible', {
    set() {
      writes++
    },
  })
  updateNeighborSceneryVisibility(map)
  updateNeighborSceneryVisibility(map)
  assert.equal(writes, 0)
  map.revealEverything = true
  updateNeighborSceneryVisibility(map)
  assert.equal(writes, 0)
  updateNeighborSceneryVisibility(map)
  assert.equal(writes, 0)
  map.revealEverything = false
  updateNeighborSceneryVisibility(map)
  assert.equal(writes, 0)
})

test('saved border terrain and resources do not contaminate the shared blueprint', () => {
  const { map, source } = fixture()
  const neighbor = source.visualNeighbors[0].blueprint
  const baseline = JSON.stringify(neighbor)
  const converted = createSquareLocalBlueprint(neighbor)
  const saved = {
    world: { localGridLayout: converted.localGridLayout },
    resources: [],
    map: converted.terrain.map(row => row.map(() => ({ type: 'Desert', z: 0 }))),
  }
  map.context.getCampaignWorldState = () => saved
  buildNeighborScenery(map)
  assert.equal(map.children.filter(c => c.texture?.name === 'tree:7').length, 0)
  assert.equal(JSON.stringify(neighbor), baseline)
  const second = fixture().map
  setNeighborScenerySource(second, source)
  buildNeighborScenery(second)
  assert.ok(second.children.some(c => c.texture?.name === 'tree:7'))
  const terrain = second.children.find(c => c.label === 'neighborTerrain')
  assert.ok(terrain.children.every(c => c.children[0].texture.cell.type === 'Grass'))
  const count = second.children.length
  buildNeighborScenery(second)
  assert.equal(second.children.length, count, 'consumed sources must not duplicate scenery')
})
