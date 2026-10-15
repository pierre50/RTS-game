const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { sampleProjectileTrajectory } = loadTsModule('app/classes/ProjectileTrajectory.ts', {
  mocks: {
    '../lib/maths': {
      pointsDistance: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
      getArcProgressOffset: (progress, height) => 4 * height * progress * (1 - progress),
    },
  },
})

test('projectile altitude is sampled from logical flight state without a sprite', () => {
  const source = {
    spawnOrigin: { x: 0, y: 0 },
    groundOrigin: { x: 0, y: 0 },
    destinationPoint: { x: 100, y: 0 },
    totalDistance: 100,
    trajectoryState: { kind: 'arc', arcHeight: 20 },
    x: 50,
    y: 0,
  }
  assert.deepEqual(sampleProjectileTrajectory(source), { progress: 0.5, spriteOffsetY: -20, altitude: 20 })
  source.x = 100
  assert.deepEqual(sampleProjectileTrajectory(source), { progress: 1, spriteOffsetY: -0, altitude: 0 })
})
