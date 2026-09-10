const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { localToGrid } = loadTsModule('app/lib/localMapLayout.ts')
const { validateSaveData } = loadTsModule('app/serialization/SaveValidator.ts', {
  mocks: {
    'pixi.js': {
      Assets: {
        cache: {
          get: () => ({ units: { Hero: {} }, resources: { Tree: {} }, buildings: { TownCenter: {}, Chest: {} } }),
        },
      },
    },
    '../lib/horses/horseTaming': { isHorseTamingStatus: () => true },
  },
})

function sparseSave() {
  const layout = { columns: 4, rows: 13 }
  const map = Array.from({ length: 10 }, () => [])
  const views = Array.from({ length: 10 }, () => [])
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.columns - (r % 2); c++) {
      const { i, j } = localToGrid(c, r, layout)
      map[i][j] = { type: 'Grass', z: 0 }
      views[i][j] = { viewed: true, viewBy: [] }
    }
  }
  return JSON.parse(
    JSON.stringify({
      world: { seed: 1, size: 9, localGridLayout: layout },
      map,
      camera: { x: 0, y: 0 },
      resources: [],
      animals: [],
      players: [{ type: 'Human', isPlayed: true, views, units: [{ type: 'Hero', ...localToGrid(1, 4, layout) }] }],
    })
  )
}

test('legacy interior decorations migrate before sparse exterior coordinate validation', () => {
  const save = sparseSave()
  const player = save.players[0]
  player.label = 'human'
  player.buildings = [
    { type: 'TownCenter', label: 'center', ...localToGrid(1, 4, save.world.localGridLayout), isBuilt: true },
    {
      type: 'Chest',
      label: 'interior:human:center:default:storage-chest',
      i: 11,
      j: 11,
      isBuilt: true,
      inventory: { resources: { wheat: 12 } },
    },
  ]
  assert.equal(validateSaveData(save), save)
  assert.equal(player.buildings.length, 1)
  assert.equal(player.buildings[0].interiorBuildings[0].i, 11)
  assert.equal(player.buildings[0].interiorBuildings[0].inventory.resources.wheat, 12)
  assert.equal(validateSaveData(JSON.parse(JSON.stringify(save))).players[0].buildings.length, 1)
})

test('nested interior records reject bad coordinates, unsupported types and duplicate identities', () => {
  const save = sparseSave()
  save.players[0].label = 'human'
  save.players[0].buildings = [
    {
      type: 'TownCenter',
      label: 'center',
      ...localToGrid(1, 4, save.world.localGridLayout),
      interiorBuildings: [{ type: 'Chest', label: 'chest', i: 11, j: 11 }],
    },
  ]
  for (const mutate of [
    child => {
      child.i = -1
    },
    child => {
      child.type = 'Unknown'
    },
    child => {
      child.label = 'center'
    },
    child => {
      child.interiorBuildings = []
    },
  ]) {
    const invalid = structuredClone(save)
    mutate(invalid.players[0].buildings[0].interiorBuildings[0])
    assert.throws(() => validateSaveData(invalid), /Invalid save/)
  }
})

test('pending world pursuers validate their identity, arrival and remaining delay', () => {
  const save = sparseSave()
  const entry = {
    entity: { type: 'Hero', label: 'pursuer', i: 99, j: 99 },
    owner: { type: 'AI', label: 'enemy' },
    targetLabel: 'hero',
    arrival: localToGrid(1, 4, save.world.localGridLayout),
    remainingMs: 1200,
  }
  save.runtime = { worldPursuers: [entry] }
  assert.equal(validateSaveData(save), save)
  entry.remainingMs = -1
  assert.throws(() => validateSaveData(save), /pursuer delay/)
  entry.remainingMs = 1200
  save.runtime.worldPursuers.push(structuredClone(entry))
  assert.throws(() => validateSaveData(save), /pursuer identity/)
})

test('sparse saves validate after JSON converts missing cells and vision to null', () => {
  const save = sparseSave()
  assert.equal(save.map[0][0], null)
  assert.equal(validateSaveData(save), save)
  delete save.map
  assert.equal(validateSaveData(save), save)
})

test('sparse saves reject malformed layouts, missing rows, cells inside holes, and missing playable cells', () => {
  const mutations = [
    save => {
      save.world.localGridLayout.rows = 12
    },
    save => {
      save.world.localGridLayout.columns = 0
    },
    save => {
      save.world.localGridLayout = null
    },
    save => {
      save.config = { localGridLayout: { columns: 5, rows: 17 } }
    },
    save => {
      save.map[0] = null
    },
    save => {
      save.map[0][0] = { type: 'Grass' }
    },
    save => {
      const p = localToGrid(3, 1, save.world.localGridLayout)
      save.map[p.i][p.j] = { type: 'Grass' }
    },
    save => {
      save.map[0][3] = null
    },
    save => {
      save.players[0].views[0][3] = null
    },
    save => {
      save.players[0].units[0].i = 0
      save.players[0].units[0].j = 0
    },
    save => {
      save.resources.push({ type: 'Tree', i: 0, j: 0 })
    },
  ]
  for (const mutate of mutations) {
    const save = sparseSave()
    mutate(save)
    assert.throws(() => validateSaveData(save), /Invalid save file/)
  }
})

test('old dense saves and interiors keep validating without layout metadata', () => {
  for (const mapType of ['world-region', 'interior']) {
    const save = sparseSave()
    delete save.world.localGridLayout
    save.world.mapType = mapType
    save.map = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => ({ type: 'Grass' })))
    save.players[0].views = save.map.map(row => row.map(() => ({})))
    assert.equal(validateSaveData(save), save)
    save.map[0][0] = null
    assert.throws(() => validateSaveData(save), /cell 0,0/)
  }
})
