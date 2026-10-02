const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const removed = []
  const calls = []
  const lifecycle = loadTsModule('app/classes/ProjectileLifecycle.ts', { mocks: {
    '../lib/audio/sound': { playAudibleSoundCue() {} },
    '../lib/entities/entityFade': { fadeOutThenClear: () => calls.push('fade') },
    '../lib/grid/visibility': { updateInstanceRenderVisibility() {} },
    '../lib/mapSpaces': { getEntitySpaceGrid: () => [] },
    '../lib/maths': { randomRange: () => 0, getReliefOffset: () => 0 },
    './ProjectileGeometry': { TREE_STICK_HEIGHT: 1, TREE_STICK_JITTER: 0 },
  } })
  let fade
  const projectile = {
    context: { map: {}, scheduler: {
      remove: id => removed.push(id),
      addOneShot(callback) { fade = callback; return 8 },
    } },
    interval: 7, timeoutId: 8, isDestroyed: false, x: 0, y: 0,
    position: { set() {} }, applyEmbeddedMask() {}, once() {},
    stopTimeout() { lifecycle.stopProjectileTimeout(this) },
    createImpactEffect: () => calls.push('impact'),
    destroy: () => calls.push('destroy'),
  }
  return { lifecycle, projectile, removed, calls, fireFade: () => fade() }
}

test('clearing a flying projectile cancels movement and fade, even if cleared twice', () => {
  const { lifecycle, projectile, removed, calls } = fixture()
  lifecycle.clearProjectile(projectile)
  lifecycle.clearProjectile(projectile)
  assert.deepEqual(removed, [7, 8])
  assert.deepEqual(calls, ['destroy'])
  assert.equal(projectile.isDestroyed, true)
})

test('projectile impact destruction is idempotent and cancels pending work', () => {
  const { lifecycle, projectile, removed, calls } = fixture()
  lifecycle.destroyProjectile(projectile)
  lifecycle.destroyProjectile(projectile)
  assert.deepEqual(calls, ['impact', 'destroy'])
  assert.deepEqual(removed, [8, 7])
  assert.equal(projectile.isDead, true)
  assert.equal(projectile.isDestroyed, true)
})

test('late projectile fade cannot touch a cleared projectile', () => {
  const { lifecycle, projectile, fireFade, calls } = fixture()
  lifecycle.stickProjectileInTree(projectile, { x: 0, y: 0, addChild() {} })
  lifecycle.clearProjectile(projectile)
  fireFade()
  assert.deepEqual(calls, ['impact', 'destroy'])
})
