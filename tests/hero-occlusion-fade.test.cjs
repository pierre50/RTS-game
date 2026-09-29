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
      '../lib/mapSpaces': { sameMapSpace: (a, b) => (a.spaceId ?? 'outside') === (b.spaceId ?? 'outside') },
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

test('hero occlusion fade ignores wildgrass plant resources', () => {
  const herb = {
    family: constants.FAMILY_TYPES.resource,
    isCutOrFallenTree: () => false,
    occlusionFade: false,
    sprite: {},
    type: 'MedicinalHerb',
    zIndex: 2,
  }
  const { HeroOcclusionFade } = loadHeroOcclusionFade([herb])

  assert.equal(new HeroOcclusionFade().findOccluders(createHero()).has(herb), false)
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

test('followers reveal obstacles even when the hero is in front, until the last member leaves', () => {
  const building = { family: 'building', isBuilt: true, sprite: {}, zIndex: 2, alpha: 1 }
  const { HeroOcclusionFade } = loadHeroOcclusionFade([building])
  const fade = new HeroOcclusionFade()
  const hero = createHero()
  const follower = { ...createHero(), followingHero: true }
  hero.owner = { units: [hero, follower] }

  fade.update(hero, 15)
  assert.equal(building.alpha, 0.9, 'a shared obstacle fades only once per update')
  hero.zIndex = 3
  fade.update(hero, 15)
  assert.equal(building.alpha, 0.8, 'the follower keeps the obstacle transparent')
  follower.zIndex = 3
  fade.update(hero, 30)
  assert.equal(building.alpha, 1)
})

test('unavailable team units do not reveal obstacles', () => {
  const building = { family: 'building', isBuilt: true, sprite: {}, zIndex: 2 }
  const { HeroOcclusionFade } = loadHeroOcclusionFade([building])
  const hero = { ...createHero(), zIndex: 3 }
  const follower = { ...createHero(), followingHero: true }
  hero.owner = { units: [follower] }
  const fade = new HeroOcclusionFade()
  for (const excluded of [
    { isDead: true },
    { isDestroyed: true },
    { visible: false },
    { sprite: null },
    { spaceId: 'interior' },
  ]) {
    hero.owner.units = [{ ...follower, ...excluded }]
    assert.equal(fade.findOccluders(hero).size, 0, JSON.stringify(excluded))
  }
  hero.owner.units = [follower]
  fade.update(hero, 15)
  hero.owner.units = []
  fade.update(hero, 15)
  assert.equal(building.alpha, 1, 'leaving the team restores opacity')
})

test('trees fade for own and same-team NPCs without a follow order, but not other teams', () => {
  const tree = { family: 'resource', sprite: {}, zIndex: 2 }
  const { HeroOcclusionFade } = loadHeroOcclusionFade([tree])
  const hero = { ...createHero(), zIndex: 3 }
  const npc = { ...createHero(), followingHero: false }
  hero.owner = { label: 'human', team: 1, units: [npc] }
  const fade = new HeroOcclusionFade()
  assert.equal(fade.findOccluders(hero).has(tree), true, 'own NPC without follow order')
  hero.owner.units = []
  const ally = { label: 'ally', team: 1, units: [npc] }
  hero.context.players = [hero.owner, ally]
  assert.equal(fade.findOccluders(hero).has(tree), true, 'another player on the same team')
  ally.team = 2
  assert.equal(fade.findOccluders(hero).size, 0, 'another team')
  hero.owner.team = null
  ally.team = null
  assert.equal(fade.findOccluders(hero).size, 0, 'unassigned teams are not shared teams')
})
