const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { observeVillage } = loadTsModule('app/services/world/VillageObservation.ts')
const home = { i: 50, j: 50, spaceId: 'outside' }
test('remote player workers and hostile buildings do not count as an observer', () => {
  const context = {
    map: {},
    players: [
      { isPlayed: true, units: [{ i: 51, j: 50, action: 'chopwood' }], buildings: [{ i: 50, j: 50 }] },
      { units: [{ i: 52, j: 50 }], buildings: [{ i: 51, j: 50 }], isEnemy: () => true },
    ],
  }
  assert.equal(observeVillage(context, home, 80).reason, 'distant')
  context.players[1].units[0].action = 'attack'
  assert.equal(observeVillage(context, home, 80).reason, 'combat')
})
test('hero distance and camera interest expose their actual reason', () => {
  const hero = { label: 'hero', i: 100, j: 50 }
  const context = { map: { grid: [] }, players: [], controls: { heroUnit: hero, instanceInCamera: () => true } }
  assert.deepEqual(observeVillage(context, home, 80), { reason: 'hero', actor: 'hero', distance: 50 })
  hero.i = 300
  assert.equal(observeVillage(context, home, 80, [{ i: 51, j: 50, x: 0, y: 0 }]).reason, 'camera')
  context.map.activeSpaceId = 'interior:room'
  assert.equal(observeVillage(context, home, 80, [{ i: 51, j: 50, x: 0, y: 0 }]).reason, 'distant')
})
