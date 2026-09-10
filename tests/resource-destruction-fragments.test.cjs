const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadResource(calls, AnimatedSprite = class {}) {
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
        AnimatedSprite,
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

test('harvested natural and hero-planted wheat stays in place and restarts daily growth', () => {
  class AnimatedSprite {
    textures = [0, 1, 2, 3, 4, 5]
    currentFrame = 5
    gotoAndStop(frame) {
      this.currentFrame = frame
    }
  }
  const { Resource } = loadResource([], AnimatedSprite)
  for (const isNaturalResource of [true, false]) {
    const crop = {
      type: 'Wheat',
      label: 'plot',
      i: 8,
      j: 9,
      quantity: 0,
      totalQuantity: 12,
      isNaturalResource,
      sprite: new AnimatedSprite(),
      isUsedBy: {},
      context: { map: { resources: new Set() }, menu: {} },
      stopWindMotion() {},
      syncShadow() {},
      isWindAnimatedWheat: () => false,
      registerNaturalRespawnSlot() {
        assert.fail('a harvested crop must not enter the respawn queue')
      },
    }
    crop.context.map.resources.add(crop)
    Resource.prototype.die.call(crop)
    assert.equal(crop.sprite.currentFrame, 0)
    assert.equal(crop.quantity, 12)
    assert.equal(crop.isUsedBy, null)
    assert.equal(crop.isDead, undefined)
    assert.equal(crop.context.map.resources.has(crop), true)
    for (let day = 1; day <= 5; day++) {
      assert.equal(Resource.prototype.advanceWheatGrowth.call(crop), true)
      assert.equal(crop.sprite.currentFrame, day)
      assert.deepEqual([crop.i, crop.j], [8, 9])
    }
    crop.quantity = 0
    Resource.prototype.die.call(crop)
    assert.equal(crop.sprite.currentFrame, 0)
  }
})

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
