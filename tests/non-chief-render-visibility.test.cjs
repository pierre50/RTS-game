const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('camera rendering is independent of chief status and gameplay perception', () => {
  const { updateInstanceRenderVisibility, instanceIsInPlayerSight } = loadTsModule('app/lib/grid/visibility.ts', {
    mocks: {
      '../../services/visibility/UnitPerception': { updateVisibility() {} },
      './screenBounds': {
        getRenderablePosition: instance => instance,
        getVisibilityRuntimeMap: instance => instance.context.map,
        getInstanceCameraBounds: () => ({}),
      },
    },
  })
  const { playerCanSeeInstance } = loadTsModule('app/lib/extra.ts', {
    mocks: {
      './grid': { instanceIsInPlayerSight },
      './ui/Modal': {},
      './entities/spriteTextures': {},
    },
  })
  let inSight = false
  const hero = { type: 'Hero', isChief: false }
  const owner = { label: 'player', isPlayed: true, views: { isVisible: () => inSight } }
  const context = {
    player: owner,
    map: { showResources: true },
    controls: { heroUnit: hero, instanceInCamera: () => true },
  }
  for (const family of ['unit', 'building']) {
    const instance = { label: family, family, i: 1, j: 1, x: 1, y: 1, owner, context }
    assert.equal(updateInstanceRenderVisibility(instance), true)
    assert.equal(playerCanSeeInstance(instance, owner), false)
    inSight = true
    assert.equal(updateInstanceRenderVisibility(instance), true)
    assert.equal(playerCanSeeInstance(instance, owner), true)
    inSight = false
    hero.isChief = true
    assert.equal(updateInstanceRenderVisibility(instance), true)
    assert.equal(playerCanSeeInstance(instance, owner), true)
    hero.isChief = false
  }
})


test('AI movement refreshes the minimap even on the step leaving sight, only in the active space', () => {
  const { canUpdateMinimap } = loadTsModule('app/lib/extra.ts', {
    mocks: { './grid': {}, './ui/Modal': {}, './entities/spriteTextures': {} },
  })
  const unit = { i: 1, j: 1, owner: { type: 'AI', label: 'enemy' }, context: { map: {} } }
  const player = { label: 'self', views: { isVisible: () => false } }
  assert.equal(canUpdateMinimap(unit, player), true)
  unit.spaceId = 'interior:house'
  assert.equal(canUpdateMinimap(unit, player), false)
})
