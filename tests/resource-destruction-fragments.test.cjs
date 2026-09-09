const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadResource(calls) {
  const constants = {
    CELL_HEIGHT: 32,
    CELL_WIDTH: 64,
    FADE_DURATION_MS: 500,
    FAMILY_TYPES: { resource: 'resource' },
    LABEL_TYPES: { sprite: 'sprite' },
    PASSABLE_RESOURCE_TYPES: new Set(['MedicinalHerb', 'ToxicHerb', 'FiberPlant']),
    RESOURCE_TYPES: {
      berrybush: 'Berrybush',
      copper: 'Copper',
      fiberPlant: 'FiberPlant',
      gold: 'Gold',
      iron: 'Iron',
      medicinalHerb: 'MedicinalHerb',
      stone: 'Stone',
      toxicHerb: 'ToxicHerb',
      tree: 'Tree',
      wheat: 'Wheat',
    },
    WILDGRASS_RESOURCE_TYPES: new Set(['MedicinalHerb', 'ToxicHerb', 'FiberPlant']),
  }

  return loadTsModule('app/classes/Resource.ts', {
    mocks: {
      '../config/gameplay': { NATURAL_RESOURCE_REGROWTH_BY_TYPE: {} },
      '../constants': constants,
      '../lib': {
        spawnSpriteFragmentBurst: options => calls.push(options),
      },
      '../lib/audio/settings': { onVisualSettingsChange: () => () => {} },
      '../lib/entities/entityFade': { fadeOutThenClear: () => {} },
      '../ui/entity/ResourceInterface': { ResourceInterface: class {} },
      './Instance': { Instance: class {} },
      './ResourceSpriteFactory': { createResourceSprite: () => ({}) },
      './ResourceTexture': {
        EMPTY_BERRYBUSH_FRAME: 0,
        BERRYBUSH_SHEET_ID: 'resources/berrybush',
        getResourceConfig: () => ({ resources: {} }),
        getTerrainAssets: () => null,
        pickLifecycleTextureRef: () => null,
      },
      './ResourceVisuals': {
        canApplyWindMotion: () => false,
        createShadow: () => null,
        isCutOrFallenTree: () => false,
        isWindAnimatedWheat: () => false,
        isWindMotionEligible: () => false,
        resetWindMotion: () => {},
        shouldUseWindMotion: () => false,
        startWindMotion: () => {},
        stopWindMotion: () => {},
        syncShadow: () => {},
        syncVisualSettings: () => {},
        updateWindMotion: () => {},
      },
      'pixi.js': {
        AnimatedSprite: class {},
        Assets: {},
        Polygon: class {},
      },
    },
  })
}

function makeResource(type) {
  return {
    context: { app: {}, scheduler: {} },
    getFragmentGroundTargets: () => [{ x: 10, y: 20, zIndex: 3 }],
    parent: { label: 'resource-layer' },
    sprite: { label: 'resource-sprite' },
    type,
  }
}

test('depleted wildgrass resources spawn final destruction fragments', () => {
  const calls = []
  const { Resource } = loadResource(calls)

  for (const type of ['MedicinalHerb', 'ToxicHerb', 'FiberPlant']) {
    assert.equal(Resource.prototype.spawnDepletedResourceFragmentBurst.call(makeResource(type)), true)
  }

  assert.deepEqual(
    calls.map(call => [call.host.type, call.fragmentSize, call.maxFragments, call.durationMs, call.layer.label]),
    [
      ['MedicinalHerb', 8, 8, 620, 'resource-layer'],
      ['ToxicHerb', 8, 8, 620, 'resource-layer'],
      ['FiberPlant', 8, 8, 620, 'resource-layer'],
    ]
  )
})
