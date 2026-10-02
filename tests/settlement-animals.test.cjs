const test = require('node:test')
const assert = require('node:assert/strict')
const {
  relocateSettlementAnimals,
  stockSettlementStables,
  settlementAnimalZones,
} = require('../tools/maps/settlements/settlement-animals.cjs')
const grid = (size = 80, type = 'Grass') =>
  Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ type, category: type === 'Water' ? 'Water' : 'Land', z: 0 }))
  )
const stateFor = animals => ({
  players: [
    {
      label: 'home',
      type: 'AI',
      settlementType: 'outpost',
      units: [],
      buildings: [{ type: 'FireCamp', i: 30, j: 30, size: 1 }],
    },
  ],
  animals,
  resources: [],
})
const distance = (a, b) => Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j))

test('settlement clearance follows actual buildings and fields, leaving nearby unaffected wildlife in place', () => {
  const state = stateFor([
    { type: 'Deer', i: 30, j: 30 },
    { type: 'Horse', i: 40, j: 40 },
  ])
  assert.deepEqual(settlementAnimalZones(state), [{ minI: 28, maxI: 32, minJ: 28, maxJ: 32 }])
  const before = structuredClone(state.animals[1])
  relocateSettlementAnimals(state, grid())
  assert.deepEqual(state.animals[1], before)
  assert.ok(distance(state.animals[0], { i: 30, j: 30 }) > 2)
  assert.ok(distance(state.animals[0], { i: 30, j: 30 }) < 10)
  state.resources.push({ label: 'start:home:wheat:0:45:42', type: 'Wheat', i: 45, j: 42 })
  assert.deepEqual(settlementAnimalZones(state), [{ minI: 28, maxI: 47, minJ: 28, maxJ: 44 }])
})

test('groups straddling a settlement move together onto a connected compatible habitat', () => {
  const terrain = grid(80, 'DarkForest')
  for (let i = 0; i < 80; i++) for (let j = 50; j < 80; j++) terrain[i][j].type = 'Grass'
  const state = stateFor([
    { label: 'a', type: 'Horse', i: 30, j: 30, horseColor: 'bay', hitPoints: 7 },
    { label: 'b', type: 'Horse', i: 31, j: 30 },
    { label: 'c', type: 'Horse', i: 33, j: 30 },
    { label: 'far', type: 'Deer', i: 75, j: 75 },
  ])
  for (const animal of state.animals.slice(0, 3)) terrain[animal.i][animal.j].type = 'Grass'
  state.players[0].units.push({ type: 'Villager', i: 30, j: 50 })
  state.resources.push({ type: 'Tree', i: 29, j: 50 })
  const original = structuredClone(state)
  relocateSettlementAnimals(state, terrain)
  const replay = structuredClone(original)
  relocateSettlementAnimals(replay, terrain)
  assert.deepEqual(state, replay)
  assert.equal(state.animals.length, 4)
  for (const animal of state.animals.slice(0, 3)) {
    assert.equal(terrain[animal.i][animal.j].type, 'Grass')
    assert.ok(animal.j >= 50)
    assert.ok(state.animals.slice(0, 3).every(other => distance(animal, other) <= 6))
    assert.ok(!state.resources.some(r => distance(r, animal) === 0))
    assert.ok(!state.players[0].units.some(u => distance(u, animal) === 0))
  }
  assert.equal(new Set(state.animals.map(a => `${a.i}:${a.j}`)).size, 4)
  assert.equal(state.animals[0].horseColor, 'bay')
  assert.equal(state.animals[0].hitPoints, 7)
  assert.deepEqual(state.animals[3], original.animals[3])
})

test('a nearby pocket with nine free cells is rejected in favor of a large connected roaming area', () => {
  const terrain = grid(80, 'Water')
  const land = (i, j) => Object.assign(terrain[i][j], { type: 'Grass', category: 'Land' })
  for (let i = 20; i <= 26; i++) for (let j = 20; j <= 26; j++) land(i, j)
  for (let i = 5; i <= 74; i++) for (let j = 45; j <= 74; j++) land(i, j)
  land(30, 30)
  const state = stateFor([{ type: 'Deer', i: 30, j: 30 }])
  relocateSettlementAnimals(state, terrain)
  assert.ok(state.animals[0].j >= 45)
})

test('cliffs block roaming even when neighboring cells are dry land', () => {
  const terrain = grid()
  for (let i = 0; i < 80; i++) for (let j = 0; j < 45; j++) terrain[i][j].z = (i + j) % 2 ? 5 : 0
  const state = stateFor([{ type: 'Deer', i: 30, j: 30 }])
  relocateSettlementAnimals(state, terrain)
  assert.ok(state.animals[0].j >= 44)
})

test('compatible habitat fallback is allowed, forbidden horse habitat and full maps fail explicitly', () => {
  const terrain = grid()
  terrain[30][30].type = 'Jungle'
  const state = stateFor([{ type: 'Deer', i: 30, j: 30 }])
  relocateSettlementAnimals(state, terrain)
  assert.equal(terrain[state.animals[0].i][state.animals[0].j].type, 'Grass')
  assert.throws(
    () => relocateSettlementAnimals(stateFor([{ type: 'Horse', i: 30, j: 30 }]), grid(40, 'DarkForest')),
    /no safe wildlife relocation/
  )
  assert.throws(
    () => relocateSettlementAnimals(stateFor([{ type: 'Deer', i: 30, j: 30 }]), grid(40, 'Water')),
    /no safe wildlife relocation/
  )
})

test('cave and bandit camp clearings remain free after wildlife placement', () => {
  const state = stateFor([{ type: 'Deer', i: 30, j: 30 }])
  const blueprint = { caves: [{ i: 26, j: 26 }], banditCampPositions: [{ i: 35, j: 35 }] }
  relocateSettlementAnimals(state, grid(), blueprint)
  assert.ok([...blueprint.caves, ...blueprint.banditCampPositions].every(c => distance(c, state.animals[0]) > 8))
})

test('horse stock varies deterministically within each settlement tier without creating stables', () => {
  const bounds = { outpost: [1, 2], village: [1, 3], city: [3, 5] }
  for (const [settlementType, [min, max]] of Object.entries(bounds)) {
    const state = { players: [{ settlementType, buildings: [{ label: 'stable', type: 'Stable' }, { type: 'House' }] }] }
    const counts = new Set()
    for (let seed = 0; seed < 40; seed++) {
      stockSettlementStables(state, seed)
      const stable = state.players[0].buildings[0]
      assert.ok(stable.horseAmount >= min && stable.horseAmount <= max)
      assert.equal(stable.stableHorses.length, stable.horseAmount)
      assert.ok(stable.stableHorses.every(h => h.tamingStatus === 'tamed'))
      const before = structuredClone(state)
      stockSettlementStables(state, seed)
      assert.deepEqual(state, before)
      assert.equal(state.players[0].buildings[1].horseAmount, undefined)
      counts.add(stable.horseAmount)
    }
    assert.ok(counts.size > 1)
    assert.equal(state.players[0].buildings.length, 2)
  }
})
