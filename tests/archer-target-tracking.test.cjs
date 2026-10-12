const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { onSpriteLoopAtFrame } = loadTsModule('app/lib/graphics.ts', {
  mocks: Object.fromEntries(
    ['assets', 'colors', 'canvas', 'isoFootprint', 'textures'].map(name => [`./graphics/${name}`, {}])
  ),
})
const { syncMovedActionTarget } = loadTsModule('app/lib/units/unitActionTarget.ts', {
  mocks: {
    '../constants': { SHEET_TYPES: { action: 'actionSheet' } },
    '../maths': {
      getInstanceDegree: (_unit, x, y) => (Math.atan2(y, x) * 180) / Math.PI,
      degreeToDirection: degree => Math.round(degree / 45),
    },
  },
})

test('an archer tracks movement within a grid cell and fires once when turning at release', () => {
  const sprite = { textures: Array(9) }
  const target = { family: 'unit', i: 1, j: 1, x: 100, y: 0 }
  const unit = {
    realDest: { ...target },
    degree: 0,
    destHasMoved: () => false,
    setTextures() {
      // Pixi resets and restores the frame when switching direction textures.
      sprite.onFrameChange(0)
      sprite.onFrameChange(8)
    },
  }
  const shots = []
  onSpriteLoopAtFrame(sprite, 8, () => {
    syncMovedActionTarget(unit, target)
    shots.push({ x: unit.realDest.x, y: unit.realDest.y })
  })
  target.x = 0
  target.y = 100
  sprite.onFrameChange(8)
  assert.deepEqual(shots, [{ x: 0, y: 100 }])
  sprite.onFrameChange(8)
  assert.equal(shots.length, 1)
  sprite.onFrameChange(0)
  target.x = 10
  sprite.onFrameChange(8)
  assert.deepEqual(shots, [
    { x: 0, y: 100 },
    { x: 10, y: 100 },
  ])
})
