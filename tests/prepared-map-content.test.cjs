const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { prepareContent } = require('../tools/maps/prepared-content.cjs')
const { decodeMapBlueprintPayload } = loadTsModule('app/serialization/MapBlueprintDecoding.ts')
const root = path.join(__dirname, '../public/maps/worlds/world-4242')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')))

test('all regions store reproducible animals on available land and exact precomputed terrain borders', async () => {
  let animalCount = 0
  for (const entry of manifest.maps) {
    const payload = JSON.parse(fs.readFileSync(path.join(root, 'maps', entry.path)))
    const blueprint = await decodeMapBlueprintPayload(payload, entry, {})
    blueprint.environment = payload.environment
    const rebuilt = prepareContent(blueprint)
    assert.deepEqual(
      blueprint.terrainAppearance.map(e => ({ ...e, patches: e.patches?.slice().sort() })),
      rebuilt.terrainAppearance.map(e => ({ ...e, patches: e.patches?.slice().sort() })),
      entry.id
    )
    assert.deepEqual(payload.animals, rebuilt.animals, entry.id)
    const occupied = new Set(blueprint.resources.map(r => `${r.i},${r.j}`))
    for (const animal of payload.animals) {
      const key = `${animal.i},${animal.j}`
      assert.ok(!occupied.has(key), `${entry.id}: animal overlaps another entity`)
      occupied.add(key)
      assert.notEqual(blueprint.terrain[animal.i][animal.j], 'Water')
      assert.notEqual(animal.type, 'Wolf')
      animalCount++
    }
  }
  assert.ok(animalCount > 0)
})

test('scenery files preserve edge terrain, resources and borders with fewer cells and bytes', async () => {
  let sourceBytes = 0,
    sceneryBytes = 0
  for (const entry of manifest.maps) {
    const fullText = fs.readFileSync(path.join(root, 'maps', entry.path), 'utf8')
    const sideText = fs.readFileSync(path.join(root, 'maps', entry.sceneryPath), 'utf8')
    sourceBytes += Buffer.byteLength(fullText)
    sceneryBytes += Buffer.byteLength(sideText)
    const full = await decodeMapBlueprintPayload(JSON.parse(fullText), entry, {})
    const side = await decodeMapBlueprintPayload(JSON.parse(sideText), { ...entry, path: entry.sceneryPath }, {})
    assert.ok(side.terrain.flat().length < full.terrain.flat().length)
    for (let i = 0; i <= side.size; i++)
      for (let j = 0; j <= side.size; j++) {
        if (side.terrain[i]?.[j] == null) continue
        assert.equal(side.terrain[i][j], full.terrain[i][j])
        assert.equal(side.relief[i][j], full.relief[i][j])
      }
    for (const resource of side.resources)
      assert.ok(
        full.resources.some(r => r.i === resource.i && r.j === resource.j && r.textureName === resource.textureName)
      )
  }
  assert.ok(sceneryBytes < sourceBytes * 0.8)
})

test('prepared borders apply once without invoking terrain topology calculations', () => {
  const { registerPreparedMapContent, consumePreparedTerrain, takePreparedAnimals } = loadTsModule(
    'app/classes/map/generation/PreparedMapContent.ts'
  )
  const calls = []
  const map = {
    grid: [[{ resetTerrainAppearance() {}, setReliefBorder: (...args) => calls.push(args), setPatchBorder() {} }]],
  }
  registerPreparedMapContent(map, { animals: [], terrainAppearance: [{ i: 0, j: 0, relief: ['014', 0.5] }] })
  assert.equal(consumePreparedTerrain(map), true)
  assert.deepEqual(calls, [['014', 8]])
  assert.equal(consumePreparedTerrain(map), false)
  assert.deepEqual(takePreparedAnimals(map), [])
  assert.equal(takePreparedAnimals(map), undefined)
})
