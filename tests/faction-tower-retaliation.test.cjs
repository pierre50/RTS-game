const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { changeGameFactionRelation } = loadTsModule('app/screens/game/GameFactionRelations.ts')

test('war immediately refreshes tower targets even when nobody moves', () => {
  const scanned = []
  const game = {
    _campaignSave: { factions: { village: { relationScore: 0, relationState: 'neutral' } } },
    context: { players: [] },
  }
  const tower = (label, extra = {}) => ({
    isBuilt: true,
    range: 6,
    projectile: 'Arrow',
    scanForInitialTarget() {
      assert.equal(game._campaignSave.factions.village.relationState, 'hostile')
      scanned.push(label)
    },
    ...extra,
  })
  game.context.players = [
    { buildings: [tower('village'), tower('unfinished', { isBuilt: false }), tower('dead', { isDead: true })] },
    {
      buildings: [
        tower('player'),
        tower('house', { range: undefined, projectile: undefined }),
        tower('destroyed', { isDestroyed: true }),
      ],
    },
  ]
  changeGameFactionRelation.call(game, 'village', -65)
  assert.deepEqual(scanned, ['village', 'player'])
  changeGameFactionRelation.call(game, 'village', -8)
  assert.deepEqual(scanned, ['village', 'player'])
})

test('a peaceful relation change does not refresh combat targets', () => {
  const game = {
    _campaignSave: { factions: { village: { relationScore: 0, relationState: 'neutral' } } },
    context: {
      players: [
        {
          buildings: [
            { isBuilt: true, range: 6, projectile: 'Arrow', scanForInitialTarget: () => assert.fail('peaceful') },
          ],
        },
      ],
    },
  }
  changeGameFactionRelation.call(game, 'village', 8)
  changeGameFactionRelation.call(game, 'missing', -65)
})
