const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { applyStartingBonuses } = loadTsModule('app/classes/map/MapPlayerGeneration.ts', {
  mocks: {
    '../../lib': {},
    '../players': {},
    './BanditCampGeneration': {},
    './CivilizationStartingKit': {},
    '../../lib/resources/playerResourceTotals': {},
  },
})

test('legacy all-technologies flag cannot grant bonuses on map creation', () => {
  const player = { age: 0, applyEligibleTechnologies: () => assert.fail('obsolete bonus applied') }
  applyStartingBonuses({ startingAge: 2, allTechnologies: true }, player)
  assert.equal(player.age, 2)
  assert.equal(player.autoTechnologyByAge, undefined)
})

test('a player-specific starting age overrides the global age', () => {
  const player = { age: 0 }
  applyStartingBonuses({ startingAge: 1 }, player, 2)
  assert.equal(player.age, 2)
})
