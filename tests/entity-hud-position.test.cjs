const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('unit HUD top uses LPC visible body height instead of transparent frame height', () => {
  const { getEntityHudTopY } = loadTsModule('app/lib/entities/entityHudPosition.ts')

  const y = getEntityHudTopY(
    {
      family: 'unit',
      sprite: { height: 64, anchor: { y: 0.86 } },
      type: 'Villager',
    },
    10
  )

  assert.equal(y, -52)
})

test('animal HUD top uses animal visual height and honors sprite scale', () => {
  const { getEntityHudTopY } = loadTsModule('app/lib/entities/entityHudPosition.ts')

  const hareY = getEntityHudTopY(
    {
      family: 'animal',
      sprite: { height: 46 * 0.875, anchor: { y: 0.86 }, scale: { y: 0.875 } },
      type: 'Hare',
    },
    10
  )

  assert.equal(hareY, -41)
})

test('building HUD top keeps using frame height', () => {
  const { getEntityHudTopY } = loadTsModule('app/lib/entities/entityHudPosition.ts')

  const y = getEntityHudTopY(
    {
      family: 'building',
      sprite: { height: 96, anchor: { y: 1 } },
    },
    10
  )

  assert.equal(y, -106)
})
