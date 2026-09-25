const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { isLargeMapIsolationTest, isolateLargeMapConfig, isolateLargeMapBlueprint } =
  loadTsModule('app/config/largeMapTest.ts')

test('both continent sizes keep the human setup, rival villages, caves and bandit camps', () => {
  for (const edge of [1000, 5000]) {
    const config = {
      worldId: `world-test-${edge}`,
      size: edge - 1,
      bots: 7,
      players: [{ civ: 'Nobatia', isHuman: true, name: 'Test', civilizationLevel: 3 }],
      heroOnlyStart: true,
    }
    const blueprint = {
      settlements: [
        { kind: 'village', civ: 'Hellas' },
        { kind: 'village', civ: 'Nobatia' },
      ],
      caves: [{ id: 'cave' }],
      banditCampPositions: [{ id: 'camp' }],
    }
    assert.equal(isLargeMapIsolationTest(config.worldId), false)
    assert.equal(isolateLargeMapConfig(config), config)
    assert.equal(isolateLargeMapBlueprint(blueprint, config), blueprint)
  }
})
test('normal worlds preserve their original configuration', () => {
  const config = { worldId: 'world-4242', size: 4999 }
  const blueprint = { animals: [{ type: 'Deer' }] }
  assert.equal(isolateLargeMapConfig(config), config)
  assert.equal(isolateLargeMapBlueprint(blueprint, config), blueprint)
})
