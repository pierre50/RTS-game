const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { entityHudAnchor } = loadTsModule('app/rendering/EntityHudAnchor.ts')
const { pixiHudLocalPosition } = loadTsModule('app/rendering/pixi/PixiEntityHudAnchor.ts')

test('HUD anchor takes z from the occupied cell and retains flat x/y', () => {
  const source = {
    x: 132,
    y: 74,
    z: 99,
    i: 2,
    j: 3,
    currentCell: { z: 5 },
    context: { map: { grid: [[], [], []] } },
  }
  assert.deepEqual(entityHudAnchor(source), {
    spaceId: 'outside',
    position: { x: 132, y: 74, z: 5 },
  })
})

test('building HUD anchor uses its own map space cell before cached z', () => {
  const source = {
    x: -64,
    y: 112,
    z: 1,
    i: 1,
    j: 2,
    spaceId: 'interior:house',
    context: {
      map: {
        grid: [[], [null, null, { z: 9 }]],
        spaces: new Map([['interior:house', { grid: [[], [null, null, { z: 3 }]] }]]),
      },
    },
  }
  assert.deepEqual(entityHudAnchor(source), {
    spaceId: 'interior:house',
    position: { x: -64, y: 112, z: 3 },
  })
})

test('Pixi projects the world anchor into the view while preserving relief lift', () => {
  const host = {
    x: 150,
    y: 80,
    z: 8,
    currentCell: { z: 2 },
    displayObject: { x: 148, y: 76 },
    reliefLift: -24,
  }
  assert.deepEqual(pixiHudLocalPosition(host, -42, 3, 5), { x: 5, y: -57 })
  assert.equal(entityHudAnchor(host).position.z, 2)
})
