const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const definitions = require('../public/assets/data/gameplay/buildings.json')
const { advanceOfflineWorker } = loadTsModule('app/services/world/OfflineWorldWork.ts')

function fixture() {
  const sites = Array.from({ length: 16 }, (_, n) => ({
    type: 'Farm',
    label: `tile-${n}`,
    i: 10 + (n % 4),
    j: 10 + Math.floor(n / 4),
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 2,
    constructionMaterials: { cost: { wheat: 1 }, consumed: {}, delivered: {} },
  }))
  const unit = { type: 'Villager', i: 9, j: 10, hitPoints: 18, inventory: { resources: { wheat: 5, berry: 12 } } }
  const player = { label: 'p', units: [unit], buildings: sites, populationMax: 10 }
  return { state: { players: [player], resources: [], animals: [] }, player, unit }
}
function sow(f) {
  const { state, player, unit } = f
  const site = player.buildings[0]
  if (!site) return
  Object.assign(unit, {
    autonomousJob: 'construction',
    collectiveTask: 'construction',
    buildQueue: [site.label],
    dest: [site.i, site.j, site.label],
  })
  advanceOfflineWorker(
    state,
    player,
    0,
    unit,
    10000,
    1,
    {
      entity: label => player.buildings.find(site => site.label === label),
      reachable: () => true,
      findNear: () => ({ i: unit.i, j: unit.j }),
      move: (unit, point) => Object.assign(unit, point),
      releaseBuilding() {},
      reserve() {},
    },
    {
      unitConfig: () => ({ speed: 1.5 }),
      buildingConfig: () => definitions.Farm,
      buildingCapacity: () => 0,
      cycleMs: () => 1000,
      wheatMatureFrame: 5,
    },
    { buildingsCompleted: 0 }
  )
}

test('five grains sow exactly five tiles; empty tiles survive reload and resume with new seeds', () => {
  let f = fixture()
  for (let n = 0; n < 16; n++) sow(f)
  assert.equal(f.state.resources.length, 5)
  assert.equal(f.player.buildings.length, 11)
  assert.equal(f.unit.inventory.resources.wheat, 0)
  assert.equal(f.unit.inventory.resources.berry, 12)
  assert.ok(f.state.resources.every(tile => tile.type === 'Wheat' && tile.currentFrame === 0))
  assert.deepEqual(f.player.completedObjectives, ['createWheatField'])
  const state = JSON.parse(JSON.stringify(f.state))
  f = { state, player: state.players[0], unit: state.players[0].units[0] }
  f.unit.inventory.resources.wheat = 11
  for (let n = 0; n < 11; n++) sow(f)
  assert.equal(f.state.resources.length, 16)
  assert.equal(f.player.buildings.length, 0)
  assert.equal(new Set(f.state.resources.map(tile => `${tile.i}:${tile.j}`)).size, 16)
  assert.equal(f.unit.inventory.resources.wheat, 0)
})

test('live sowing replaces only the completed site and begins wheat growth at frame zero', () => {
  const created = []
  const { finishSowingTile } = loadTsModule('app/classes/building/BuildingSowing.ts', {
    mocks: {
      '../Resource': {
        Resource: class {
          constructor(options) {
            Object.assign(this, options)
            created.push(this)
          }
        },
      },
      '../../lib/mapSpaces': { getEntityMapSpace: () => null, addEntityToMapSpaceContainer() {} },
      '../../lib/objectives/ageObjectives': { AGE_OBJECTIVES: { createWheatField: 'sow' }, completeAgeObjective() {} },
    },
  })
  const cell = { solid: true, updateVisible() {} }
  const site = {
    i: 0,
    j: 0,
    label: 'tile',
    clear() {
      this.isDestroyed = true
    },
  }
  cell.has = site
  const remaining = { i: 0, j: 1 }
  site.owner = { buildings: [site, remaining], foundedWheats: new Set(), foundedResources: { Wheat: new Set() } }
  site.context = { map: { grid: [[cell]], resources: new Set(), removeFromInstanceBucket() {} }, menu: {} }
  finishSowingTile(site)
  assert.deepEqual(site.owner.buildings, [remaining])
  assert.equal(created.length, 1)
  assert.equal(created[0].currentFrame, 0)
  assert.equal(cell.solid, false)
  assert.ok(site.context.map.resources.has(created[0]))
  finishSowingTile(site)
  assert.equal(created.length, 1)
})

test('placing a parcel reserves sixteen independent seed sites without spending or starting growth', () => {
  const sites = []
  const cells = Array.from({ length: 16 }, (_, n) => ({ i: 10 + (n % 4), j: 10 + Math.floor(n / 4) }))
  const { plantPlayerWheatField } = loadTsModule('app/classes/players/PlayerBuildingPlacement.ts', {
    mocks: {
      '../../lib': {
        canPlaceBuildingAt: (_grid, _i, _j, config) => config.size === 4,
        hasBuildingPlacementClearance: () => true,
        getBuildingFootprintCells: (_i, _j, _grid, size) => {
          assert.equal(size, 4)
          return cells
        },
      },
      '../../lib/buildings/passageCells': { createReservedPassageCellLookup: () => new Set() },
      '../../lib/mapSpaces': { getMapSpace: () => null },
    },
  })
  const player = {
    age: 0,
    config: { buildings: definitions },
    isBuildingEligible: () => true,
    context: { map: { grid: [] }, menu: {} },
    spawnBuilding: options => sites.push(options),
  }
  assert.equal(plantPlayerWheatField(player, 10, 10), true)
  assert.equal(sites.length, 16)
  assert.ok(sites.every(site => !site.isBuilt && site.constructionMaterials.cost.wheat === 1))
})
