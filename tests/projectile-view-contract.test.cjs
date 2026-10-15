const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { projectileVisualState } = loadTsModule('app/rendering/ProjectileView.ts', {
  mocks: {
    '../constants': { CELL_DEPTH: 16 },
    '../lib/maths': {
      pointsDistance: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
      isometricToCartesian: (x, y) => [Math.round(x / 10), Math.round(y / 10)],
    },
    '../lib/terrain/reliefSurface': {
      getReliefLevelAtPoint: (_map, _point, cell) => cell?.z ?? 0,
    },
  },
})

test('projectile view samples cell height and adds flight altitude to z', () => {
  const map = { grid: [[], [undefined, { z: 2 }]] }
  const source = {
    label: 'shot-1', type: 'Arrow', spaceId: 'outside',
    x: 10, y: 10, currentAltitude: 32,
    spawnOrigin: { x: 0, y: 0 },
    terrainOrigin: { x: 0, y: 0 },
    terrainDestination: { x: 20, y: 20 },
    totalDistance: Math.hypot(20, 20),
    visible: true, zIndex: 5,
  }
  const state = projectileVisualState(source, map)
  assert.deepEqual(state.cell, { i: 1, j: 1, z: 2 })
  assert.deepEqual(state.position, { x: 10, y: 10, z: 4 })
  assert.equal(state.altitude, 32)
  source.x = 0
  assert.equal(state.position.x, 10)
})
