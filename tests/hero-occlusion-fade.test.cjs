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

function loadHeroOcclusionFade(candidates = []) {
  return loadTsModule('app/services/HeroOcclusionFade.ts', {
    mocks: {
      '../constants': constants,
      '../lib/maths': { getInstanceZIndex: instance => instance.zIndex ?? 0 },
      '../lib/graphics/alphaMask': { texturesHaveOpaqueOverlap: () => true },
      '../lib/graphics/chunkCulling': { boundsIntersect: () => true },
      '../lib/grid/visibility': {
        findInstancesInSight: (_origin, predicate) => candidates.filter(predicate),
        getInstanceScreenBounds: instance => ({ x: instance.x ?? 0, y: instance.y ?? 0, width: 16, height: 16 }),
      },
    },
  })
}

function createHero() {
  return {
    context: { app: { renderer: {} } },
    family: constants.FAMILY_TYPES.unit,
    i: 0,
    j: 0,
    label: 'Hero',
    sprite: { texture: {} },
    x: 0,
    y: 0,
    zIndex: 1,
  }
}

test('hero occlusion fade ignores cut or fallen tree resource sprites', () => {
  const cutTree = {
    family: constants.FAMILY_TYPES.resource,
    isCutOrFallenTree: () => true,
    sprite: {},
    zIndex: 2,
  }
  const { HeroOcclusionFade } = loadHeroOcclusionFade([cutTree])

  assert.equal(new HeroOcclusionFade().findOccluders(createHero()).has(cutTree), false)
})

test('hero occlusion fade still applies to standing resource sprites', () => {
  const standingTree = {
    family: constants.FAMILY_TYPES.resource,
    isCutOrFallenTree: () => false,
    sprite: {},
    zIndex: 2,
  }
  const { HeroOcclusionFade } = loadHeroOcclusionFade([standingTree])

  assert.equal(new HeroOcclusionFade().findOccluders(createHero()).has(standingTree), true)
})

test('hero occlusion fade keeps built buildings fadeable', () => {
  const building = {
    family: constants.FAMILY_TYPES.building,
    isBuilt: true,
    sprite: {},
    zIndex: 2,
  }
  const { HeroOcclusionFade } = loadHeroOcclusionFade([building])

  assert.equal(new HeroOcclusionFade().findOccluders(createHero()).has(building), true)
})
