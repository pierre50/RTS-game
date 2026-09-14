const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('owned NPCs and live buildings obey fog for a non-chief, while chief ownership keeps its existing visibility', () => {
  const { updateInstanceRenderVisibility, instanceIsInPlayerSight } = loadTsModule('app/lib/grid/visibility.ts', {
    mocks: {
      '../../services/FogOfWar': { updateVisibility() {} },
      './screenBounds': {
        getRenderablePosition: instance => instance,
        getVisibilityRuntimeMap: instance => instance.context.map,
        getInstanceCameraBounds: () => ({}),
      },
    },
  })
  const { playerCanSeeInstance } = loadTsModule('app/lib/extra.ts', { mocks: {
    './grid': { instanceIsInPlayerSight }, './ui/Modal': {}, './entities/spriteTextures': {},
  } })
  let inSight = false
  const hero = { type: 'Hero', isChief: false }
  const owner = { label: 'player', isPlayed: true, views: { isVisible: () => inSight } }
  const context = { player: owner, map: { showResources: true }, controls: { heroUnit: hero, instanceInCamera: () => true } }
  for (const family of ['unit', 'building']) {
    const instance = { label: family, family, i: 1, j: 1, x: 1, y: 1, owner, context }
    assert.equal(updateInstanceRenderVisibility(instance), false)
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
