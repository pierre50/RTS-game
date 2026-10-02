const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('arrow family follows forge upgrades and ignores legacy ages and technologies', () => {
  const { getEffectiveProjectileType } = loadTsModule('app/lib/projectiles.ts')
  for (const age of [0, 1, 2]) {
    assert.equal(getEffectiveProjectileType('Arrow', { age, technologies: ['Alchemy'] }), 'ArrowCeramic')
    for (const [arrows, expected] of ['ArrowCeramic', 'ArrowCopper', 'ArrowBronze', 'ArrowIron'].entries()) {
      const owner = { age, forgeUpgrades: { arrows, weapons: 3 } }
      assert.equal(getEffectiveProjectileType('Arrow', owner), expected)
      assert.equal(
        getEffectiveProjectileType('ArrowCopper', owner),
        'ArrowCopper',
        'explicit hero ammunition is preserved'
      )
    }
  }
})
