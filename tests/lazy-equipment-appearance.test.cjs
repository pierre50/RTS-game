const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const cache = new Map()
  const loads = []
  const { getLayerRenderState } = loadTsModule('app/classes/unit/appearance/UnitAppearanceRenderState.ts', {
    mocks: {
      'pixi.js': { Assets: { cache } },
      '../../../lib': {
        getSpriteFrameSelection: textures => ({ textures: Object.values(textures), mirrored: false }),
      },
      '../../../lib/lpc/lazyEquipmentAssets': {
        loadDynamicEquipmentAssetQueued: equipment => new Promise(resolve => loads.push({ equipment, resolve })),
      },
    },
  })
  const unit = {
    type: 'Hero',
    controlMode: 'hero',
    owner: {},
    sprite: { currentFrame: 0 },
    context: { map: { ready: true } },
    currentSheet: 'walkingSheet',
  }
  const layers = ['back', 'front'].map(side => ({
    equipmentKey: 'axe_ceramic',
    walkingSheet: `equipments/axe_ceramic/${side}/walking`,
  }))
  let refreshes = 0
  const render = () => layers.map(layer => getLayerRenderState(unit, layer, unit.currentSheet))
  unit.syncAppearanceLayers = () => {
    refreshes++
    render()
  }
  return { unit, layers, loads, cache, render, getLayerRenderState, refreshes: () => refreshes }
}

async function settle() {
  await Promise.resolve()
  await Promise.resolve()
}

test('missing equipment animations cannot multiply refresh callbacks or reload a completed atlas', async () => {
  const f = fixture()
  for (let frame = 0; frame < 100; frame++) f.render()
  assert.equal(f.loads.length, 1, 'one callback per unit and atlas, including front/back layers')
  f.loads[0].resolve()
  await settle()
  for (let frame = 0; frame < 100; frame++) f.render()
  assert.equal(f.loads.length, 1, 'missing aliases after a successful load must not restart loading')
  assert.equal(f.refreshes(), 1)
})

test('successful loading refreshes newly available textures', async () => {
  const f = fixture()
  f.render()
  const sheet = { textures: { frame: {} } }
  f.cache.set(f.layers[0].walkingSheet, sheet)
  f.loads[0].resolve()
  await settle()
  assert.equal(f.refreshes(), 1)
  assert.equal(f.render()[0].spritesheet, sheet)
})

test('hidden and inactive equipment layers do not request assets', () => {
  const f = fixture()
  f.layers[0].workTypes = ['woodcutter']
  f.layers[1].hideWhenEquippedSlots = ['weapon']
  f.unit.inventory = { equipped: { weapon: 'sword_bronze' } }
  assert.deepEqual(f.render(), [null, null])
  assert.equal(f.loads.length, 0)
  f.unit.work = 'woodcutter'
  f.render()
  assert.equal(f.loads.length, 1)
})

test('destroyed units are not refreshed by a delayed equipment load', async () => {
  const f = fixture()
  f.render()
  f.unit.isDestroyed = true
  f.loads[0].resolve()
  await settle()
  assert.equal(f.refreshes(), 0)
})

test('another equipment family can still load after an absent animation', async () => {
  const f = fixture()
  f.render()
  f.loads[0].resolve()
  await settle()
  f.unit.inventory = { toolsInitialized: true, activeWeapons: { tool: 'pickaxe_ceramic' } }
  f.getLayerRenderState(
    f.unit,
    {
      equipmentKey: 'pickaxe_ceramic',
      walkingSheet: 'equipments/pickaxe_ceramic/front/walking',
    },
    'walkingSheet'
  )
  assert.equal(f.loads.length, 2)
})
