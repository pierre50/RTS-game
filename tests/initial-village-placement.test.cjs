const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { placeInitialVillageUnits } = loadTsModule('app/services/world/InitialVillagePlacement.ts')
const { DAY_NIGHT_CONFIG } = loadTsModule('app/config/gameplay.ts')

function fixture(hour = 12) {
  const unit = (label, type, job, i = 10, j = 12) => ({ label, type, autonomousJob: job, i, j })
  const state = {
    runtime: { dayNightElapsedMs: (((hour - 8 + 24) % 24) / 24) * DAY_NIGHT_CONFIG.dayLengthMs },
    players: [
      {
        type: 'AI',
        factionId: 'test',
        buildings: [
          { label: 'center', type: 'TownCenter', i: 10, j: 10, isBuilt: true },
          { label: 'barracks', type: 'Barracks', i: 20, j: 10, isBuilt: true },
          { label: 'house', type: 'House', i: 8, j: 20, isBuilt: true },
        ],
        units: [
          unit('a', 'Villager', 'food'),
          unit('b', 'Villager', 'food', 11, 12),
          unit('c', 'Villager', 'wood', 12, 12),
          unit('d', 'Fantassin', undefined, 13, 12),
        ],
      },
      { type: 'Human', isPlayed: true, units: [unit('hero', 'Hero')], buildings: [] },
    ],
    resources: [
      { label: 'berries', type: 'Berrybush', i: 18, j: 18, quantity: 100 },
      { label: 'wheat', type: 'Wheat', i: 20, j: 22, quantity: 100, currentFrame: 3 },
      { label: 'young', type: 'Wheat', i: 10, j: 14, quantity: 100, currentFrame: 0 },
      { label: 'tree', type: 'Tree', i: 24, j: 24, quantity: 100 },
    ],
    animals: [],
  }
  const terrain = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => ({ category: 'Land' })))
  const rules = { buildingConfig: () => ({ size: 2 }), wheatMatureFrame: 3 }
  return { state, terrain, rules }
}

test('first arrival distributes workers by job, guards by buildings, without changing stocks or human units', () => {
  const { state, terrain, rules } = fixture()
  const human = structuredClone(state.players[1])
  const resources = structuredClone(state.resources)
  placeInitialVillageUnits(state, new Set(['test']), terrain, rules)
  const [a, b, c, guard] = state.players[0].units
  assert.equal(a.action, 'forageberry')
  assert.equal(b.action, 'farm')
  assert.equal(c.work, 'woodcutter')
  assert.notEqual(a.dest[2], b.dest[2])
  assert.ok(Math.abs(guard.i - 20) <= 2)
  assert.equal(new Set([a, b, c, guard].map(u => `${u.i}:${u.j}`)).size, 4)
  assert.deepEqual(state.players[1], human)
  assert.deepEqual(state.resources, resources)
})

test('night arrival stays near shelters without assigning harvest actions', () => {
  const { state, terrain, rules } = fixture(0)
  placeInitialVillageUnits(state, new Set(['test']), terrain, rules)
  assert.ok(state.players[0].units.every(u => !u.action))
  assert.equal(state.players[0].units[0].autonomousJob, 'food')
})

test('unreachable resources and occupied cells are not used; other factions are untouched', () => {
  const { state, terrain, rules } = fixture()
  for (const row of terrain) row[16] = { category: 'Water' }
  const before = structuredClone(state)
  placeInitialVillageUnits(state, new Set(['other']), terrain, rules)
  assert.deepEqual(state, before)
  placeInitialVillageUnits(state, new Set(['test']), terrain, rules)
  assert.ok(state.players[0].units.every(u => u.j < 16))
  assert.ok(state.players[0].units.every(u => !u.action))
})
