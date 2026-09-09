const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup({ failVariant = false } = {}) {
  const variants = [],
    loads = [],
    aliases = [],
    metrics = []
  const module = loadTsModule('app/lib/lpc/bakedPreload.ts', {
    mocks: {
      'pixi.js': { Assets: { load: async assets => loads.push(assets.map(asset => asset.alias)) } },
      './bakedAliasCache': {
        isAssetCached: alias => alias === 'cached',
        loadBakedUnitVariant: async (type, variant) => {
          variants.push([type, variant])
          if (failVariant) throw new Error('variant unavailable')
        },
        registerDynamicEquipmentAliases: batch => aliases.push([...batch]),
      },
      './bakedAliases': {
        BAKED_UNITS: ['villager'],
        gendersForBakedUnit: () => ['male', 'female'],
        bakedVariantKey: (_type, player, _seed, gender) => `${player.civ}/${gender}`,
      },
      './bakedUnitAssets': { applyBakedLpcUnitAssets: () => true },
      './equipment': {
        dynamicEquipmentAsset: key => ({ alias: key, src: `${key}.json` }),
        dynamicEquipmentAssets: () => [{ alias: 'cached' }, { alias: 'sword' }],
        isDynamicEquipmentKey: () => true,
      },
      './heroAppearance': {
        heroAppearanceAssetsForPlayers: () => [{ alias: 'hero-hair' }],
        registerHeroAppearanceAliasesForPlayers: () => aliases.push(['hero-hair']),
      },
    },
  })
  return { ...module, variants, loads, aliases, metrics, monitor: { record: name => metrics.push(name) } }
}

test('runtime preload deduplicates variants, batches equipment and refreshes units and corpses', async () => {
  const state = setup()
  const refreshed = []
  const unit = {
    currentSheet: 'walking',
    setTextures: sheet => refreshed.push(sheet),
    appearance: { layers: [{ equipmentKey: 'cached' }, { equipmentKey: 'sword' }] },
  }
  const corpse = {
    currentSheet: 'corpse',
    setTextures: sheet => refreshed.push(sheet),
    appearance: { layers: [{ equipmentKey: 'sword' }, { equipmentKey: 'armor' }] },
  }
  await state.preloadBakedLpcUnitsForPlayers(
    [{ civ: 'Hellas', units: [unit], corpses: [corpse] }, { civ: 'Hellas' }],
    state.monitor,
    { preloadEquipment: false, preloadRuntimeEquipment: true, runtimeEquipmentBatchSize: 1 }
  )
  assert.deepEqual(state.variants, [
    ['villager', 'Hellas/male'],
    ['villager', 'Hellas/female'],
  ])
  assert.deepEqual(state.loads, [['sword'], ['armor'], ['hero-hair']])
  assert.deepEqual(state.aliases, [['cached'], ['sword'], ['armor'], ['hero-hair']])
  assert.deepEqual(refreshed, ['walking', 'walking', 'corpse'])
})

test('failed base variant loads propagate before equipment loading and record timing', async () => {
  const state = setup({ failVariant: true })
  await assert.rejects(state.preloadBakedLpcUnitsForPlayers([{ civ: 'Hellas' }], state.monitor), /variant unavailable/)
  assert.deepEqual(state.loads, [])
  assert.deepEqual(state.aliases, [])
  assert.ok(state.metrics.includes('preloadUnits.loadBakedVariants'))
})
