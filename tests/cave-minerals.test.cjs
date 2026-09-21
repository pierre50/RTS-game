const assert = require('node:assert/strict')
const test = require('node:test')
const { createCave, VARIANTS } = require('../tools/caves/layout.cjs')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function assertAccessible(map) {
  const width = map.size + 1
  const floor = Buffer.from(map.floorMask, 'base64')
  const border = Buffer.from(map.borderMask, 'base64')
  const blocked = new Set(map.resources.map(r => r.i * width + r.j))
  const walkable = index => floor[index] && !border[index] && !blocked.has(index)
  const start = map.exits[0].i * width + map.exits[0].j
  const reached = new Set([start]),
    queue = [start]
  for (let n = 0; n < queue.length; n++) {
    const i = Math.floor(queue[n] / width),
      j = queue[n] % width
    for (const [di, dj] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      ...(map.tier === 'small'
        ? [
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ]
        : []),
    ]) {
      const x = i + di,
        y = j + dj,
        next = x * width + y
      if (x < 0 || y < 0 || x >= width || y >= width || !walkable(next) || reached.has(next)) continue
      reached.add(next)
      queue.push(next)
    }
  }
  assert.equal(
    reached.size,
    floor.reduce((sum, _, index) => sum + Number(Boolean(walkable(index))), 0),
    map.id
  )
}

test('cave minerals are sparse, finite, flat, reproducible and never block a passage', () => {
  for (const seed of [0, 1, 2, 3, 42, 4242, 12345])
    for (const tier of ['small', 'medium', 'large']) {
      for (const variant of tier === 'small' ? ['circle'] : VARIANTS) {
        const map = createCave(tier, variant, seed)
        assert.deepEqual(map.resources, createCave(tier, variant, seed).resources)
        assert.ok(map.resources.length > 0 && map.resources.length <= { small: 2, medium: 4, large: 6 }[tier])
        const width = map.size + 1,
          floor = Buffer.from(map.floorMask, 'base64'),
          relief = Buffer.from(map.relief, 'base64')
        for (const mineral of map.resources) {
          assert.ok(['Gold', 'Copper', 'Iron'].includes(mineral.type))
          assert.ok(mineral.quantity >= 3 && mineral.quantity <= 9)
          assert.ok(Math.hypot(mineral.i - map.exits[0].i, mineral.j - map.exits[0].j) >= 4)
          for (let di = -1; di <= 1; di++)
            for (let dj = -1; dj <= 1; dj++) {
              const index = (mineral.i + di) * width + mineral.j + dj
              assert.equal(floor[index], 1)
              assert.equal(relief[index], relief[mineral.i * width + mineral.j])
            }
        }
        assertAccessible(map)
      }
    }
})

function loadMinerals() {
  const moduleCache = new Map()
  const created = []
  class Resource {
    constructor(options, context) {
      Object.assign(this, options)
      this.quantity = options.totalQuantity
      const cell = context.space.grid[this.i][this.j]
      cell.has = this
      cell.solid = true
      created.push(this)
    }
  }
  const options = { moduleCache, mocks: { '../../app/classes/Resource': { Resource } } }
  return {
    ...loadTsModule('engine/services/BuildingInteriorSpaceMinerals.ts', options),
    ...loadTsModule('app/lib/resources/caveMinerals.ts', options),
    ...loadTsModule('app/lib/combat/resourceActionConditions.ts', {
      ...options,
      mocks: { ...options.mocks, '../horses/horseTaming': { isWildHorse: () => false } },
    }),
    created,
  }
}
function space(cave) {
  const entityLayer = {
    children: [],
    addChild(child) {
      this.children.push(child)
    },
  }
  return {
    id: 'interior:cave',
    building: { type: 'Cave', cave },
    renderer: { entityLayer },
    grid: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ solid: false, has: null }))),
  }
}
const definition = () => ({ id: 'cave-1', blueprintId: 'cave-medium-loop', tier: 'medium', seed: 42 })
const blueprint = {
  resources: [
    { i: 2, j: 2, type: 'Gold', quantity: 4 },
    { i: 5, j: 5, type: 'Iron', quantity: 6 },
  ],
}

test('partial mining and depletion survive JSON save/restore without duplicating exterior resources', () => {
  const runtime = loadMinerals(),
    cave = definition(),
    first = space(cave)
  const context = { space: first, map: { resources: new Set() } }
  runtime.ensureCaveMinerals(context, first, blueprint)
  runtime.ensureCaveMinerals(context, first, blueprint)
  assert.equal(runtime.created.length, 2)
  assert.equal(context.map.resources.size, 0)
  assert.ok(runtime.created.every(r => r.isNaturalResource === false && r.spaceId === first.id))
  runtime.created[0].quantity -= 1
  runtime.created[1].quantity = 0
  const saved = JSON.parse(JSON.stringify(cave))
  assert.deepEqual(
    saved.minerals.map(r => r.quantity),
    [3, 0]
  )
  const second = space(saved)
  runtime.ensureCaveMinerals({ space: second }, second, blueprint)
  assert.equal(runtime.created.length, 3)
  assert.equal(runtime.created[2].quantity, 3)
  assert.equal(runtime.created[2].totalQuantity, 4)
  assert.equal(runtime.created[2].label, runtime.created[0].label)
})

test('only heroes can mine cave nodes, retaining age restrictions and normal outdoor mining', () => {
  const runtime = loadMinerals(),
    room = space(definition())
  runtime.ensureCaveMinerals({ space: room }, room, blueprint)
  const [gold, iron] = runtime.created
  const conditions = (type, age, target) => runtime.getResourceActionConditions({ type, owner: { age } }, target)
  assert.equal(conditions('Hero', 0, gold).minegold(), true)
  assert.equal(conditions('Villager', 2, gold).minegold(), false)
  assert.equal(conditions('Hero', 0, iron).mineiron(), false)
  assert.equal(conditions('Hero', 2, iron).mineiron(), true)
  assert.equal(conditions('Villager', 2, { type: 'Gold', quantity: 4 }).minegold(), true)
  gold.quantity = 0
  assert.equal(conditions('Hero', 2, gold).minegold(), false)
})

test('saved mineral stocks reject invalid quantities, coordinates and duplicates', () => {
  const { validateCaveDefinition } = loadTsModule('app/serialization/CaveSave.ts')
  const record = { i: 2, j: 2, type: 'Gold', quantity: 0, totalQuantity: 4 }
  assert.doesNotThrow(() => validateCaveDefinition({ ...definition(), minerals: [record] }))
  for (const patch of [
    { quantity: -1 },
    { quantity: 5 },
    { quantity: 0.5 },
    { totalQuantity: 0 },
    { type: 'Tree' },
    { i: 32 },
  ]) {
    assert.throws(() => validateCaveDefinition({ ...definition(), minerals: [{ ...record, ...patch }] }))
  }
  assert.throws(() => validateCaveDefinition({ ...definition(), minerals: [record, record] }))
})

test('saved minerals outside a reshaped cave move to accessible floor without replenishing stock', () => {
  const runtime = loadMinerals()
  const cave = { ...definition(), minerals: [{ i: 0, j: 0, type: 'Gold', quantity: 2, totalQuantity: 6 }] }
  const room = space(cave)
  room.size = 7
  room.exitCell = { i: 7, j: 4 }
  room.grid.forEach((row, i) =>
    row.forEach((cell, j) =>
      Object.assign(cell, {
        i,
        j,
        terrainHidden: i === 0 || j === 0,
        border: false,
        z: 0,
      })
    )
  )
  runtime.ensureCaveMinerals({ space: room }, room, blueprint)
  assert.equal(runtime.created.length, 1)
  const mineral = runtime.created[0]
  assert.ok(mineral.i > 1 && mineral.j > 1)
  assert.equal(mineral.quantity, 2)
  assert.equal(mineral.totalQuantity, 6)
  assert.equal(cave.minerals[0].i, mineral.i)
  assert.equal(cave.minerals[0].j, mineral.j)
})
