const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('Pixi building destruction resets the ghost, emits fragments, and disposes sprites', () => {
  const calls = []
  const parent = { label: 'world' }
  const sprite = {
    alpha: 0.42,
    tint: 0x999999,
    mask: {},
    eventMode: 'static',
    visible: true,
    parent: { removeChild: child => calls.push(['removeSprite', child]) },
    destroy: options => calls.push(['destroySprite', options]),
  }
  const shadow = {
    parent: { removeChild: child => calls.push(['removeShadow', child]) },
    destroy: options => calls.push(['destroyShadow', options]),
  }
  const decoration = { destroy: () => calls.push(['destroyDecoration']) }
  const building = { context: {}, sprite, shadow }
  const container = { parent, getChildByLabel: label => (label === 'deco' ? decoration : null) }
  const { showBuildingDestruction } = loadTsModule('app/rendering/pixi/PixiBuildingDestruction.ts', {
    mocks: {
      '../../constants': { LABEL_TYPES: { color: 'color', deco: 'deco', fire: 'fire' } },
      './PixiBuildingFire': {
        CAMPFIRE_DECORATION_LABEL: 'campfireDecorationFire',
        CAMPFIRE_SMOKE_DECORATION_LABEL: 'campfireDecorationSmoke',
      },
      './PixiBuildingVisuals': {
        clearBuildingConstructionReveal: target => {
          calls.push(['clearConstructionReveal'])
          target.sprite.alpha = 1
          target.sprite.tint = 0xffffff
          target.sprite.mask = null
        },
      },
      '../../lib': {
        spawnSpriteFragmentBurst: options => {
          assert.equal(sprite.alpha, 1)
          assert.equal(sprite.tint, 0xffffff)
          assert.equal(sprite.mask, null)
          assert.equal(sprite.visible, true)
          calls.push(['burst', options])
        },
      },
    },
  })
  const groundTargets = [
    { x: 0, y: 128, zIndex: 8 },
    { x: -32, y: 144, zIndex: 9 },
    { x: 32, y: 144, zIndex: 9 },
    { x: 0, y: 160, zIndex: 10 },
  ]
  showBuildingDestruction(building, container, groundTargets)

  const burst = calls.find(call => call[0] === 'burst')[1]
  assert.equal(burst.host, building)
  assert.equal(burst.sprite, sprite)
  assert.equal(burst.layer, parent)
  assert.equal(burst.maxFragments, 60)
  assert.equal(burst.lockX, true)
  assert.deepEqual(burst.groundTargets, groundTargets)
  assert.equal(calls[0][0], 'destroyDecoration')
  assert.equal(calls[1][0], 'clearConstructionReveal')
  assert.equal(sprite.eventMode, 'none')
  assert.equal(sprite.visible, false)
  assert.equal(building.shadow, null)
  assert.ok(calls.some(call => call[0] === 'destroySprite'))
  assert.ok(calls.some(call => call[0] === 'destroyShadow'))
})
