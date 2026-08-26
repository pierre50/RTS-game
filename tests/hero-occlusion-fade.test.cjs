const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const constants = {
  FAMILY_TYPES: {
    building: 'building',
    resource: 'resource',
    unit: 'unit',
  },
}

function loadHeroOcclusionFade() {
  return loadTsModule('app/services/HeroOcclusionFade.ts', {
    mocks: {
      '../constants': constants,
      '../lib/maths': { getInstanceZIndex: instance => instance.zIndex ?? 0 },
      '../lib/graphics/alphaMask': { texturesHaveOpaqueOverlap: () => false },
      '../lib/graphics/chunkCulling': { boundsIntersect: () => false },
      '../lib/grid/visibility': {
        findInstancesInSight: () => [],
        getInstanceScreenBounds: () => null,
      },
    },
  })
}

test('hero occlusion fade ignores cut or fallen tree resource sprites', () => {
  const { isFadeableHeroOccluder } = loadHeroOcclusionFade()
  const cutTree = {
    family: constants.FAMILY_TYPES.resource,
    isCutOrFallenTree: () => true,
    sprite: {},
  }

  assert.equal(isFadeableHeroOccluder(cutTree), false)
})

test('hero occlusion fade still applies to standing resource sprites', () => {
  const { isFadeableHeroOccluder } = loadHeroOcclusionFade()
  const standingTree = {
    family: constants.FAMILY_TYPES.resource,
    isCutOrFallenTree: () => false,
    sprite: {},
  }

  assert.equal(isFadeableHeroOccluder(standingTree), true)
})

test('hero occlusion fade keeps built buildings fadeable', () => {
  const { isFadeableHeroOccluder } = loadHeroOcclusionFade()
  const building = {
    family: constants.FAMILY_TYPES.building,
    isBuilt: true,
    sprite: {},
  }

  assert.equal(isFadeableHeroOccluder(building), true)
})
