const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const candidates = []
  const moduleCache = new Map()
  const mocks = {
    '../grid/visibility': {
      findInstancesInSight: (_hero, matches) => candidates.filter(matches),
    },
  }
  const targeting = loadTsModule('app/lib/hero/heroTargeting.ts', { moduleCache, mocks })
  const range = loadTsModule('app/lib/hero/heroActionRange.ts', { moduleCache, mocks })
  const hero = { x: 0, y: 0, i: 0, j: 0, degree: 180, type: 'Villager', controlMode: 'hero' }
  const building = (x, extra = {}) => ({ x, y: 0, i: 0, j: 0, family: 'building', size: 1, ...extra })
  return { candidates, hero, building, ...targeting, ...range }
}

test('the pointed reachable building wins over a nearer building and the old facing direction', () => {
  const f = fixture()
  const front = f.building(35)
  const pointed = f.building(-45)
  f.candidates.push(front, pointed)
  f.hero.context = { controls: { getWorldPointUnderCursor: () => pointed } }
  assert.equal(
    f.findFacingEntity(f.hero, target => f.isHeroInteractionTargetReachable(f.hero, null, target)),
    pointed
  )
})

test('standing on a bed keeps it selectable for every facing direction, without a cursor', () => {
  const f = fixture()
  const bed = f.building(0, { type: 'CampBedroll' })
  for (const degree of [0, 45, 90, 135, 180, 225, 270, 315]) {
    f.hero.degree = degree
    assert.equal(f.getDirectionalTargets(f.hero, [bed], undefined, null)[0], bed)
  }
})

test('the cursor cannot make an out-of-reach or different-space building interactable', () => {
  const f = fixture()
  const far = f.building(500, { i: 10, j: -10 })
  const indoors = f.building(0, { spaceId: 'house-inside' })
  f.candidates.push(far, indoors)
  f.hero.context = { controls: { getWorldPointUnderCursor: () => far } }
  assert.equal(
    f.findFacingEntity(f.hero, target => f.isHeroInteractionTargetReachable(f.hero, null, target)),
    null
  )
})

test('cursor direction offers a tolerant fallback when it points beyond a nearby target', () => {
  const f = fixture()
  const target = f.building(-35)
  assert.equal(f.getDirectionalTargets(f.hero, [target], undefined, { x: -300, y: 20 })[0], target)
  assert.deepEqual(f.getDirectionalTargets(f.hero, [target], undefined, { x: 300, y: 0 }), [])
})

test('construction uses the pointed site and turns toward its reachable edge', () => {
  const f = fixture()
  const pointed = f.building(-35, { type: 'House', isBuilt: false })
  const front = f.building(35, { type: 'House', isBuilt: false })
  f.candidates.push(front, pointed)
  const hero = f.hero
  const actions = []
  hero.setDest = target => {
    hero.dest = target
  }
  hero.getAction = action => actions.push(action)
  const { performContextActionAt } = loadTsModule('app/lib/hero/heroContextActions.ts', {
    mocks: {
      'pixi.js': { Assets: { cache: { get: () => null } } },
      '../grid/visibility': { findInstancesInSight: (_hero, matches) => f.candidates.filter(matches) },
      '../combat': { getActionCondition: () => true },
      '../units/unitEnergy': { hasEnergyForAction: () => true },
      '../../classes/unit/UnitResourceDeliveryCommands': { applyWorkForAction: () => {} },
    },
  })
  assert.equal(performContextActionAt(hero, pointed), 'triggered')
  assert.equal(hero.dest, pointed)
  assert.deepEqual(actions, ['build'])
  assert.equal(hero.degree % 360, 0)
  pointed.x = -500
  f.candidates.splice(0, 1)
  assert.equal(performContextActionAt(hero, pointed), 'miss')
})

test('pointing at the raised scaffold selects its reachable building, not just its ground footprint', () => {
  const f = fixture()
  const site = f.building(-35, {
    sprite: { x: 0, y: 0, width: 80, height: 100, anchor: { x: 0.5, y: 1 } },
  })
  const cursor = { x: -10, y: -80 }
  // The nearest edge is to the left, well outside the cone toward this high part of the sprite.
  assert.equal(f.getDirectionalTargets(f.hero, [site], undefined, cursor)[0], site)
})
