const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const { addVillageGroves } = require('../tools/maps/village-groves.cjs')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { assignContinentVillages } = loadTsModule('app/lib/campaign/continentVillagePlacement.ts')

function fixture() {
  const size = 100
  return {
    size,
    seed: 4242,
    terrain: Buffer.alloc((size + 1) ** 2, 1).toString('base64'),
    relief: Buffer.alloc((size + 1) ** 2).toString('base64'),
    resources: [],
    animals: [],
    spawns: [{ i: 50, j: 50 }],
    settlements: [{ kind: 'village', civ: 'Nobatia', local: { i: 50, j: 50 } }],
  }
}

test('oasis adds small local palm groves reproducibly without touching existing resources', () => {
  const before = fixture()
  const after = addVillageGroves(before)
  assert.ok(after.resources.length >= 15 && after.resources.length <= 60)
  assert.deepEqual(before.resources, [])
  assert.deepEqual(addVillageGroves(before), after)
  assert.deepEqual(addVillageGroves(after), after)
  for (const tree of after.resources) {
    assert.ok(Math.hypot(tree.i - 50, tree.j - 50) < 30)
    assert.ok(Math.hypot(tree.i - 50, tree.j - 50) >= 12)
    assert.match(tree.textureName, /resources\/tree\/palm$/)
    assert.ok(tree.quantity >= 140 && tree.quantity <= 220)
  }
  before.settlements[0].civ = 'Kemet'
  assert.deepEqual(addVillageGroves(before).resources, after.resources)
  delete before.settlements[0].civ
  assert.deepEqual(addVillageGroves(before).resources, after.resources)
})

test('village groves follow the terrain preset, not the civilization or biome label', () => {
  const before = fixture()
  before.settlements[0].biome = 'desert'
  before.terrain = Buffer.alloc(101 ** 2, 0).toString('base64')
  assert.deepEqual(addVillageGroves(before).resources, [])
  before.terrain = Buffer.alloc(101 ** 2, 1).toString('base64')
  before.settlements[0].kind = 'banditCamp'
  assert.deepEqual(addVillageGroves(before).resources, [])
})

test('oasis avoids water, slopes, animals, resources and cave/camp clearings', () => {
  const before = fixture()
  const candidates = addVillageGroves(before).resources
  const [water, slope, animal, resource, cave, camp] = candidates
  const terrain = Buffer.from(before.terrain, 'base64')
  terrain[water.i * 101 + water.j + 1] = 2
  before.terrain = terrain.toString('base64')
  const relief = Buffer.from(before.relief, 'base64')
  relief[slope.i * 101 + slope.j + 1] = 1
  before.relief = relief.toString('base64')
  before.animals = [animal]
  before.resources = [{ ...resource, type: 'Stone' }]
  before.caves = [cave]
  before.banditCampPositions = [camp]
  const added = addVillageGroves(before).resources.slice(1)
  for (const blocked of [water, slope, animal, resource, cave, camp])
    assert.ok(!added.some(tree => tree.i === blocked.i && tree.j === blocked.j))
})

for (const file of ['world-4242/maps/world-4242-r3-4-desert.map', 'world-test-1000/maps/world-test-1000-r0-0.map']) {
  test(`Nobatia has reachable wood in the shipped ${file}`, () => {
    const before = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../public/maps/worlds', file)))
    const after = addVillageGroves(before)
    const home = assignContinentVillages(after).settlements.find(site => site.civ === 'Nobatia').local
    const width = after.size + 1
    const terrain = Buffer.from(after.terrain, 'base64')
    const relief = Buffer.from(after.relief, 'base64')
    const occupied = new Set(after.resources.map(r => r.i * width + r.j))
    const visited = new Set([home.i * width + home.j])
    const queue = [home]
    for (let index = 0; index < queue.length; index++) {
      const p = queue[index]
      for (const [di, dj] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const i = p.i + di,
          j = p.j + dj,
          key = i * width + j
        if (Math.hypot(i - home.i, j - home.j) > 30 || visited.has(key) || occupied.has(key)) continue
        if (terrain[key] === 2 || terrain[key] === 255 || relief[key] !== relief[p.i * width + p.j]) continue
        visited.add(key)
        queue.push({ i, j })
      }
    }
    const reachable = after.resources.filter(
      tree =>
        tree.type === 'Tree' &&
        Math.hypot(tree.i - home.i, tree.j - home.j) <= 30 &&
        [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ].some(([di, dj]) => visited.has((tree.i + di) * width + tree.j + dj))
    )
    assert.ok(reachable.length >= 15, `Only ${reachable.length} reachable trees`)
    assert.deepEqual(after.resources.slice(0, before.resources.length), before.resources)
    assert.deepEqual(addVillageGroves(after), after)
  })
}
