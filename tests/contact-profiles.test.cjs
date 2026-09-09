const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const profiles = loadTsModule('app/lib/contact/contactProfiles.ts')
const { startContactApproach } = loadTsModule('app/lib/contact/contactApproach.ts')

test('exact equipment profiles keep unknown tools at hand reach and accept equipment overrides', () => {
  const actor = { family: 'unit' }
  const hand = profiles.resolveContactActionProfile(actor)
  assert.deepEqual(profiles.resolveContactActionProfile(actor, 'sword_unknown'), hand)
  assert.ok(profiles.resolveContactActionProfile(actor, 'spear_iron').reach > hand.reach)
  actor.owner = { config: { equipment: { customTool: { contact: { reach: 55, width: 9 } } } } }
  assert.equal(profiles.resolveContactActionProfile(actor, 'customTool').reach, 55)
  assert.equal(profiles.resolveContactActionProfile(actor, 'customTool').width, 9)
})

test('species/body overrides are independent of tool profiles and sanitize invalid dimensions', () => {
  const animal = { family: 'animal', type: 'wolf', contact: { action: { reach: 35 }, body: { radius: 20 } } }
  assert.equal(profiles.resolveContactActionProfile(animal).reach, 35)
  assert.equal(profiles.resolveContactBodyProfile(animal).radius, 20)
  assert.equal(profiles.resolveContactActionProfile(animal, 'sword_iron').reach, 38)
  animal.contact = {
    action: { reach: -2, width: NaN, halfAngle: Infinity, handOffset: -1 },
    body: { radius: 0, verticalScale: -2 },
  }
  assert.deepEqual(
    profiles.resolveContactActionProfile(animal),
    profiles.resolveContactActionProfile({ family: 'animal' })
  )
  assert.deepEqual(profiles.resolveContactBodyProfile(animal), { radius: 16, verticalScale: 0.5 })
  assert.equal(profiles.getContactScale({ spriteScale: NaN }), 1)
})

function approachHarness() {
  let callback
  let moves = 0
  let retries = 0
  let arrivals = 0
  let valid = true
  let blocked = false
  const adapter = {
    actor: {},
    isTargetValid: () => valid,
    isCurrent: () => true,
    sample: () => ({ distance: 50, point: { x: 50, y: 0 }, degree: 180, reachable: false }),
    move: () => {
      moves++
      return !blocked
    },
    begin: () => {},
    arrive: () => arrivals++,
    schedule: cb => {
      callback = cb
    },
    stop: () => {},
    retry: () => {
      retries++
      assert.equal(startContactApproach(adapter), false)
    },
  }
  return {
    adapter,
    tick: () => callback(),
    callback: () => callback,
    counts: () => ({ moves, retries, arrivals }),
    invalidate: () => {
      valid = false
    },
    block: () => {
      blocked = true
    },
  }
}

test('shared approach bounds stalled movement and prevents recursive routing retries', () => {
  const h = approachHarness()
  assert.equal(startContactApproach(h.adapter), true)
  for (let i = 0; i < 140; i++) h.tick()
  assert.deepEqual(h.counts(), { moves: 120, retries: 1, arrivals: 0 })
})

test('shared approach revalidates the target and stops on newly blocked movement', () => {
  for (const change of ['invalidate', 'block']) {
    const h = approachHarness()
    assert.equal(startContactApproach(h.adapter), true)
    h[change]()
    h.tick()
    assert.equal(h.counts().retries, 1)
    assert.equal(h.counts().arrivals, 0)
  }
})

test('replaced approach ignores stale callbacks without stopping the new approach', () => {
  const h = approachHarness()
  startContactApproach(h.adapter)
  const stale = h.callback()
  startContactApproach(h.adapter)
  const moves = h.counts().moves
  stale()
  assert.equal(h.counts().moves, moves)
  h.tick()
  assert.equal(h.counts().moves, moves + 1)
})

test('an approach sample builds the footprint once; a strike shares its shape but refreshes targets', () => {
  let footprints = 0
  let profileReads = 0
  const geometry = loadTsModule('app/lib/contact/contactGeometry.ts', {
    mocks: {
      '../mapSpaces': { sameMapSpace: () => true, getEntitySpaceGrid: () => undefined },
      '../graphics/selection': {
        getRoundedIsoFootprintPoints: target => {
          footprints++
          return [
            { x: target.x - 10, y: -10 },
            { x: target.x + 10, y: -10 },
            { x: target.x + 10, y: 10 },
            { x: target.x - 10, y: 10 },
          ]
        },
      },
    },
  })
  const actor = {
    x: 0,
    y: 0,
    family: 'unit',
    degree: 180,
    get contact() {
      profileReads++
      return undefined
    },
  }
  const target = { x: 25, y: 0, family: 'building' }
  assert.equal(geometry.sampleContactApproach(actor, target).reachable, true)
  assert.equal(footprints, 1)
  const strike = geometry.createContactStrike(actor)
  const reads = profileReads
  assert.equal(strike.touches(target), true)
  target.x = 100
  assert.equal(strike.touches(target), false)
  assert.equal(profileReads, reads)
  assert.equal(footprints, 3)
})
