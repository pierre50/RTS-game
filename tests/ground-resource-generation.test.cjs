const assert = require('node:assert/strict')
const test = require('node:test')
const { addGroundResources } = require('../tools/maps/ground-resources.cjs')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture(seed = 4321) {
  const size = 95,
    width = size + 1
  const terrain = Buffer.alloc(width * width, 0)
  const relief = Buffer.alloc(width * width)
  const resources = []
  for (let i = 8; i < 80; i += 6) for (let j = 8; j < 80; j += 6) resources.push({ type: 'Tree', i, j, quantity: 180 })
  for (let i = 0; i < width; i++) {
    for (let j = 85; j < width; j++) terrain[i * width + j] = 2
    relief[i * width + 40] = 2
  }
  return {
    size,
    seed,
    terrain: terrain.toString('base64'),
    relief: relief.toString('base64'),
    resources,
    spawns: [{ i: 20, j: 20 }],
    caves: [{ i: 65, j: 65 }],
    animals: [{ type: 'Deer', i: 50, j: 50 }],
  }
}
const ground = map => map.resources.filter(resource => resource.type.startsWith('Ground'))

test('ground resources are reproducible, idempotent and bounded per zone', () => {
  const source = fixture()
  const before = JSON.stringify(source)
  const map = addGroundResources(source)
  assert.equal(JSON.stringify(source), before)
  assert.deepEqual(addGroundResources(source), map)
  assert.deepEqual(addGroundResources(map), map)
  assert.notDeepEqual(ground(addGroundResources(fixture(9876))), ground(map))
  for (const type of ['GroundWood', 'GroundStone']) assert.ok(ground(map).some(item => item.type === type))
  const zones = ground(map).map(item => `${item.type}:${Math.floor(item.i / 6)}:${Math.floor(item.j / 6)}`)
  assert.equal(new Set(zones).size, zones.length)
})

test('scatter preserves trees, avoids water, slopes, occupied cells and protected clearings', () => {
  const source = fixture(),
    map = addGroundResources(source),
    width = source.size + 1
  const terrain = Buffer.from(source.terrain, 'base64'),
    relief = Buffer.from(source.relief, 'base64')
  const occupied = new Set([...source.resources, ...source.animals].map(item => `${item.i}:${item.j}`))
  for (const item of ground(map)) {
    const key = `${item.i}:${item.j}`
    assert.ok(!occupied.has(key))
    occupied.add(key)
    assert.ok(Math.abs(item.i - 65) > 6 || Math.abs(item.j - 65) > 6)
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        assert.notEqual(terrain[(item.i + di) * width + item.j + dj], 2)
        assert.equal(relief[(item.i + di) * width + item.j + dj], relief[item.i * width + item.j])
      }
    if (item.type === 'GroundWood')
      assert.ok(source.resources.some(tree => Math.hypot(tree.i - item.i, tree.j - item.j) <= 3))
  }
  assert.deepEqual(
    map.resources.filter(item => item.type === 'Tree'),
    source.resources
  )
  assert.ok(!ground(addGroundResources({ ...source, resources: [] })).some(item => item.type === 'GroundWood'))
})

test('generated resources reference the supplied atlas and remain passable in the game', () => {
  const { PASSABLE_RESOURCE_TYPES } = loadTsModule('app/constants/entities.ts')
  const definitions = require('../public/assets/data/gameplay/resources.json')
  const atlas = require('../public/assets/graphics/resources/ground/texture.json')
  for (const item of ground(addGroundResources(fixture()))) {
    assert.ok(PASSABLE_RESOURCE_TYPES.has(item.type))
    assert.equal(item.quantity, 1)
    const frame = Number(item.textureName.slice(0, 3))
    assert.ok(definitions[item.type].assets.some(asset => asset.sheet === 'resources/ground' && asset.frame === frame))
    assert.ok(Object.keys(atlas.frames).some(name => Number(name.slice(0, 3)) === frame))
  }
})

test('starting locations do not bias wilderness placement and items remain scattered', () => {
  const source = fixture()
  const map = addGroundResources(source)
  assert.deepEqual(ground(map), ground(addGroundResources({ ...source, spawns: [{ i: 60, j: 10 }] })))
  const items = ground(map)
  for (let a = 0; a < items.length; a++)
    for (let b = a + 1; b < items.length; b++)
      assert.ok(Math.hypot(items[a].i - items[b].i, items[a].j - items[b].j) >= 3)
  const settled = addGroundResources({ ...source, settlements: [{ local: { i: 30, j: 30 }, radius: 18 }] })
  for (const item of ground(settled)) assert.ok(Math.hypot(item.i - 30, item.j - 30) > 21)
})

test('renewal keeps pickups separated and refuses buildings or wood without a living nearby tree', () => {
  const { groundResourceSurroundings } = loadTsModule('app/lib/resources/groundResourceRegrowth.ts')
  const point = { i: 10, j: 10 }
  const at = entities => (i, j) => ({
    tree: entities.some(e => e.type === 'Tree' && e.i === i && e.j === j),
    ground: entities.some(e => e.type.startsWith('Ground') && e.i === i && e.j === j),
    building: entities.some(e => e.type === 'House' && e.i === i && e.j === j),
  })
  assert.equal(groundResourceSurroundings('GroundWood', point, at([])), false)
  assert.equal(groundResourceSurroundings('GroundWood', point, at([{ type: 'Tree', i: 13, j: 10 }])), true)
  assert.equal(groundResourceSurroundings('GroundStone', point, at([{ type: 'GroundWood', i: 12, j: 10 }])), false)
  assert.equal(groundResourceSurroundings('GroundStone', point, at([{ type: 'GroundWood', i: 13, j: 10 }])), true)
  assert.equal(groundResourceSurroundings('GroundStone', point, at([{ type: 'House', i: 13, j: 13 }])), false)
})
