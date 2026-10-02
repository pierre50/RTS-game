const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('villager hunting uses the forge arrow upgrade independently of age', () => {
  const { HUNTING_PROJECTILE } = loadTsModule('app/lib/units/hunting.ts')
  const { getEffectiveProjectileType } = loadTsModule('app/lib/projectiles.ts')

  assert.equal(getEffectiveProjectileType(HUNTING_PROJECTILE, { age: 0, forgeUpgrades: { arrows: 3 } }), 'ArrowIron')
  assert.equal(HUNTING_PROJECTILE, 'Arrow')
  assert.equal(getEffectiveProjectileType(HUNTING_PROJECTILE, { age: 2 }), 'ArrowCeramic')
  assert.equal(getEffectiveProjectileType(HUNTING_PROJECTILE, { forgeUpgrades: { arrows: 2 } }), 'ArrowBronze')
})
