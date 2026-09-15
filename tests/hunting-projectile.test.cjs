const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('villager hunting uses the age-scaled arrow projectile family', () => {
  const { HUNTING_PROJECTILE } = loadTsModule('app/lib/units/hunting.ts')
  const { getEffectiveProjectileType } = loadTsModule('app/lib/projectiles.ts')

  assert.equal(getEffectiveProjectileType(HUNTING_PROJECTILE, { age: 2 }), 'ArrowIron')
  assert.equal(HUNTING_PROJECTILE, 'Arrow')
  assert.equal(getEffectiveProjectileType(HUNTING_PROJECTILE, { age: 0 }), 'ArrowCeramic')
  assert.equal(getEffectiveProjectileType(HUNTING_PROJECTILE, { age: 1 }), 'ArrowBronze')
})
