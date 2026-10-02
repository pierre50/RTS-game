const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { decodeMapBlueprintPayload } = loadTsModule('app/serialization/blueprint/MapBlueprintDecoding.ts')
const { createLocalMapLayout } = loadTsModule('app/lib/localMapLayout.ts')
function fixture() {
  const layout = createLocalMapLayout(40)
  const size = layout.columns - 1 + Math.ceil((layout.rows - 1) / 2)
  return {
    format: 'map-blueprint',
    version: 2,
    sourceSize: 40,
    size,
    localGridLayout: layout,
    terrain: Buffer.alloc((size + 1) ** 2).toString('base64'),
    relief: Buffer.alloc((size + 1) ** 2).toString('base64'),
    caves: [10, 30].map(i => ({ i, j: i, id: `cave-${i}`, seed: i, blueprintId: 'cave-small-circle', tier: 'small' })),
    banditCampPositions: [
      {
        i: 14,
        j: 14,
        id: 'camp-1',
        seed: 2,
        profile: 'lair',
        caveId: 'cave-10',
        unitTypes: ['BanditChief', 'BanditSword', 'BanditSword', 'BanditSword', 'BanditArcher'],
      },
    ],
  }
}
const decode = payload => decodeMapBlueprintPayload(payload, { size: 40, path: 'test.map' }, {})
test('multi-cave blueprints preserve camp metadata and validate cave links and rosters', async () => {
  const raw = fixture()
  const result = await decode(raw)
  assert.equal(result.caves.length, 2)
  assert.deepEqual(result.banditCampPositions, raw.banditCampPositions)
  const duplicate = fixture()
  duplicate.caves[1].id = duplicate.caves[0].id
  await assert.rejects(decode(duplicate), /Duplicate cave/)
  const missing = fixture()
  missing.banditCampPositions[0].caveId = 'absent'
  await assert.rejects(decode(missing), /Missing camp cave/)
  const roster = fixture()
  roster.banditCampPositions[0].unitTypes = ['Hero']
  await assert.rejects(decode(roster), /Invalid camp roster/)
})
