const assert = require('node:assert/strict')
const test = require('node:test')
const { createMacroTreeOptions } = require('../tools/maps/macro.cjs')
const { generateLargeContent } = require('../tools/maps/large-content.cjs')
globalThis.requestAnimationFrame ??= callback => setImmediate(() => callback(0))

test('forest probabilities are continuous across generation patch origins', () => {
  const rows = Array(200).fill('T'.repeat(200))
  const global = createMacroTreeOptions(rows, 'Grass', 5000)
  const patch = createMacroTreeOptions(rows, 'Grass', 5000, { i: 100, j: 80 })
  for (let i = 0; i < 80; i++) {
    assert.equal(patch.treeChanceForCell({ i, j: 15 }), global.treeChanceForCell({ i: i + 100, j: 95 }))
  }
})

test('large map patches retain unique on-land entities and shore appearances deterministically', async () => {
  const size = 191,
    stride = size + 1
  const terrain = Buffer.alloc(stride * stride, 255)
  for (let i = 12; i < 180; i++)
    for (let j = 12; j < 180; j++) {
      terrain[i * stride + j] = j < 40 ? 2 : 0
    }
  const generate = () => generateLargeContent(terrain, size, [], 5000)
  const content = await generate()
  assert.deepEqual(await generate(), content)
  assert.ok(content.resources.some(resource => resource.type === 'Tree'))
  assert.ok(content.resources.some(resource => resource.type !== 'Tree'))
  assert.ok(content.animals.length)
  assert.ok(content.appearance.some(entry => entry.water))
  const occupied = new Set()
  for (const entity of [...content.resources, ...content.animals]) {
    const index = entity.i * stride + entity.j
    assert.equal(terrain[index], 0)
    assert.ok(!occupied.has(index), `duplicate entity at ${entity.i},${entity.j}`)
    occupied.add(index)
  }
  const appearances = new Set()
  for (const entry of content.appearance) {
    const index = entry.i * stride + entry.j
    assert.equal(terrain[index], 0)
    assert.ok(!appearances.has(index))
    appearances.add(index)
  }
})

test('mixed biome patches preserve desert and forest terrain, resources and transitions', async () => {
  const size = 191,
    stride = size + 1
  const terrain = Buffer.alloc(stride * stride, 2)
  const biomes = Buffer.alloc(stride * stride, 'W'.charCodeAt(0))
  for (let i = 10; i < 182; i++)
    for (let j = 10; j < 182; j++) {
      const code = j < 65 ? 'D' : j < 120 ? 'F' : 'S'
      terrain[i * stride + j] = code === 'D' ? 1 : code === 'F' ? 4 : 0
      biomes[i * stride + j] = code.charCodeAt(0)
    }
  const content = await generateLargeContent(terrain, size, [], 5000, () => {}, biomes)
  const occupied = new Set()
  for (const entity of [...content.resources, ...content.animals]) {
    const index = entity.i * stride + entity.j
    assert.notEqual(terrain[index], 2)
    assert.ok(!occupied.has(index))
    occupied.add(index)
  }
  for (const type of [1, 4, 0]) {
    assert.ok(
      content.resources.some(resource => terrain[resource.i * stride + resource.j] === type),
      `resources on terrain ${type}`
    )
  }
  assert.ok(
    content.resources.some(resource => resource.type === 'Tree' && terrain[resource.i * stride + resource.j] === 4)
  )
  assert.ok(
    content.appearance.some(entry => entry.patches?.length),
    'biome transitions are prepared'
  )
  assert.ok(
    content.appearance.some(entry => entry.water),
    'coastlines are prepared'
  )
})

test('cave approaches stay free of resources and animals across patch boundaries', async () => {
  const size = 191
  const terrain = Buffer.alloc((size + 1) ** 2, 0)
  const cave = { i: 144, j: 144, id: 'seam-cave' }
  const content = await generateLargeContent(terrain, size, [], 5000, () => {}, null, [cave])
  assert.ok(content.resources.length > 0)
  for (const entity of [...content.resources, ...content.animals]) {
    assert.ok(
      Math.abs(entity.i - cave.i) > 6 || Math.abs(entity.j - cave.j) > 6,
      `blocked cave approach at ${entity.i},${entity.j}`
    )
  }
})

test('small camps and cave approaches remain clear across resource patch seams', async () => {
  const size = 191
  const terrain = Buffer.alloc((size + 1) ** 2, 0)
  const caves = [{ i: 140, j: 140, id: 'lair' }]
  const camps = [
    { i: 144, j: 144, caveId: 'lair' },
    { i: 50, j: 144 },
  ]
  const content = await generateLargeContent(terrain, size, [], 5000, () => {}, null, caves, camps)
  for (const entity of [...content.resources, ...content.animals])
    for (const camp of camps) assert.ok(Math.abs(entity.i - camp.i) > 8 || Math.abs(entity.j - camp.j) > 8)
})
