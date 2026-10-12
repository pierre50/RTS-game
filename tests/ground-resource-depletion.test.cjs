const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

for (const type of ['GroundWood', 'GroundStone']) {
  test(`${type} clears immediately while preserving depletion and respawn bookkeeping`, () => {
    let cleared = 0,
      respawns = 0,
      removed = 0
    const { die } = loadTsModule('app/classes/resources/ResourceDepletion.ts', {
      mocks: {
        '../../lib': { isAIControlledPlayer: () => false },
        '../../lib/entities/entityFade': { fadeOutThenClear: () => assert.fail('Unexpected fade') },
        '../../lib/resources/wheatGrowth': { resetHarvestedWheat: () => false },
      },
    })
    const resource = {
      type,
      context: {
        player: {},
        players: [],
        map: { resources: { delete: () => removed++ }, removeFromInstanceBucket() {} },
        menu: { updateResourcesMiniMap() {} },
      },
      stopWindMotion() {},
      registerNaturalRespawnSlot: () => respawns++,
      clear: () => cleared++,
      prepareFadeOut: () => assert.fail('Unexpected fade preparation'),
    }
    die.call(resource, true)
    die.call(resource, true)
    assert.equal(resource.isDead, true)
    assert.equal(cleared, 1)
    assert.equal(respawns, 1)
    assert.equal(removed, 1)
  })
}
