const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const {
  sourcePosition,
  syncBanditSettlementPositions,
  syncWorldSettlementManifest,
} = require('../tools/caves/settlements.cjs')
const { finalizeBlueprintPayload } = require('../tools/maps/local-blueprint.cjs')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { createLocalMapLayout, blueprintToLocalGrid } = loadTsModule('app/lib/localMapLayout.ts')

test('world marker conversion reverses both even and odd source columns', () => {
  const layout = createLocalMapLayout(144)
  for (const i of [0, 42, 80, 144])
    for (const j of [0, 41, 82, 143, 144]) {
      assert.deepEqual(sourcePosition(blueprintToLocalGrid(i, j, layout), layout), { i, j })
    }
})

test('already prepared maps repair markers without rerolling caves or camps', () => {
  const layout = createLocalMapLayout(144)
  const camp = { ...blueprintToLocalGrid(42, 51, layout), caveId: 'cave' }
  const source = {
    version: 2,
    preparedContentVersion: 2,
    sourceSize: 144,
    localGridLayout: layout,
    caves: [{ id: 'cave' }],
    banditCampPositions: [camp],
    settlements: [
      { id: 'bandits', kind: 'banditCamp', region: { x: 2, y: 3 }, local: { i: 0, j: 0 }, world: { i: 0, j: 0 } },
    ],
  }
  const result = finalizeBlueprintPayload(source)
  assert.deepEqual(result.settlements[0].world, { i: 474, j: 339 })
  assert.deepEqual(result.settlements[0].local, camp)
  assert.equal(result.caves, source.caves)
  assert.equal(result.banditCampPositions, source.banditCampPositions)
  assert.equal(syncBanditSettlementPositions(result), result)
  const manifest = { settlements: source.settlements, maps: [{ settlements: result.settlements }] }
  syncWorldSettlementManifest(manifest)
  assert.deepEqual(manifest.settlements, result.settlements)
})

test('every shipped bandit marker matches the actual prepared camp, in both manifests', () => {
  const root = path.join(__dirname, '../public/maps/worlds/world-4242')
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')))
  let count = 0
  for (const entry of manifest.maps) {
    const map = JSON.parse(fs.readFileSync(path.join(root, 'maps', entry.path)))
    let index = 0
    for (const settlement of map.settlements ?? []) {
      if (settlement.kind !== 'banditCamp') continue
      count++
      const camp = map.banditCampPositions[index++]
      const source = sourcePosition(camp, map.localGridLayout)
      assert.deepEqual(settlement.local, camp)
      assert.deepEqual(settlement.world, {
        i: entry.region.y * manifest.regionMapSize + source.i,
        j: entry.region.x * manifest.regionMapSize + source.j,
      })
      assert.deepEqual(
        entry.settlements.find(item => item.id === settlement.id),
        settlement
      )
      assert.deepEqual(
        manifest.settlements.find(item => item.id === settlement.id),
        settlement
      )
    }
  }
  assert.equal(count, 8)
})
