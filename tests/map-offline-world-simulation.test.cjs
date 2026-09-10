const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { applyOfflineWorldSimulation } = loadTsModule('app/classes/map/generation/MapOfflineWorldSimulation.ts', {
  mocks: {
    'pixi.js': { Assets: { cache: { get: name => (name === 'config' ? { resources: {} } : undefined) } } },
    '../../../lib/buildings/buildingOccupancy': {
      getBuildingShelterCapacity: ({ type }) => (type === 'House' ? 5 : 0),
    },
  },
})

function fixture() {
  const player = {
    type: 'Human',
    label: 'p',
    population: 1,
    populationMax: 1,
    units: [{ type: 'Villager', label: 'builder', autonomousJob: 'construction', i: 8, j: 8 }],
    buildings: [
      { type: 'House', label: 'house', i: 12, j: 12, isBuilt: false, hitPoints: 95 },
      { type: 'TownCenter', i: 4, j: 4, isBuilt: true, inventory: { resources: { wheat: 1000 } } },
    ],
  }
  const data = {
    camera: { x: 0, y: 0 },
    players: [player],
    resources: [],
    animals: [],
    runtime: { dayNightElapsedMs: 1440000, offlineFromElapsedMs: 0 },
  }
  const runtimePlayer = {
    population: 1,
    populationMax: 1,
    views: { isViewed: () => true },
    config: {
      units: { Villager: { speed: 1.5 } },
      buildings: {
        House: { size: 2, totalHitPoints: 96, constructionTime: 48 },
        TownCenter: { size: 3 },
      },
    },
  }
  const map = {
    context: { players: [runtimePlayer] },
    grid: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => ({ category: 'Grass' }))),
  }
  return { data, player, runtimePlayer, map }
}

test('map restoration advances the save on generated terrain and synchronizes population before creating entities', () => {
  const { data, player, runtimePlayer, map } = fixture()
  applyOfflineWorldSimulation(map, data)
  assert.equal(player.buildings[0].isBuilt, true)
  assert.equal(runtimePlayer.populationMax, 6)
  assert.equal(player.units.length, 2)
  assert.equal(runtimePlayer.population, 2)
  assert.equal(data.runtime.offlineFromElapsedMs, undefined)
  const processed = structuredClone(data)
  applyOfflineWorldSimulation(map, data)
  assert.deepEqual(data, processed)
})

test('ordinary loads and missing visit timestamps do not advance a world', () => {
  const { data, map } = fixture()
  delete data.runtime.offlineFromElapsedMs
  const original = structuredClone(data)
  applyOfflineWorldSimulation(map, data)
  assert.deepEqual(data, original)
})
