const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture({ refused = false, mirrored = false } = {}) {
  let callbacks
  let finishWake
  const cell = { i: 4, j: 3 }
  const owner = { units: [] }
  const bed = { type: 'CampBedroll', isBuilt: true, i: 4, j: 3, placementMirrored: mirrored, spaceId: 'room', owner }
  const hero = {
    owner,
    spaceId: 'room',
    context: {
      players: [owner],
      controls: {},
      map: {},
      timeSkip: {
        start: (_hours, options) => {
          callbacks = options
          return { ok: !refused }
        },
      },
    },
  }
  owner.units.push(hero)
  hero.context.controls.heroUnit = hero
  const api = loadTsModule('app/lib/hero/heroSleep.ts', {
    mocks: {
      '../../services/rest/UnitRestState': {
        stopUnitForRest: unit => {
          unit.path = []
        },
        placeUnitAtCell: (unit, target) => {
          unit.currentCell = target
          unit.i = target.i
          unit.j = target.j
        },
      },
      '../mapSpaces': {
        sameMapSpace: (a, b) => a.spaceId === b.spaceId,
        getEntitySpaceGrid: () => ({ 4: { 3: cell } }),
        getEntitySpaceMapLike: () => ({}),
      },
      '../terrain/reliefSurface': { syncEntityRelief: () => {} },
      '../../services/TimeSkipSystem': { getHoursUntilNextMorning: () => 8 },
      '../../services/rest/UnitSleepVisuals': {
        playSleepingOutsideVisual: (_unit, complete) => complete(),
        playSleepingWakeVisual: (_unit, complete) => {
          finishWake = complete
        },
      },
      '../entities/overheadIndicator': { setUnitOverheadIndicator() {}, clearUnitOverheadIndicator() {} },
      '../lang': { t: key => key },
      '../grid/visibility': { findInstancesInSight: () => [] },
      './heroActionRange': { isHeroInteractionTargetReachable: unit => unit.reachable !== false },
    },
  })
  const { isBedOccupied } = loadTsModule('app/services/rest/BedOccupancy.ts')
  return { ...api, hero, bed, cell, owner, isBedOccupied, callbacks: () => callbacks, finishWake: () => finishWake() }
}

test('bed blocks sleep when reserved by an NPC, too far away or in another room', () => {
  const f = fixture()
  const npc = { shelterState: { restTarget: f.bed, status: 'movingToRest' } }
  f.owner.units.push(npc)
  assert.equal(f.getHeroSleepBlockedReason(f.hero, f.bed), 'heroBedSleepOccupied')
  npc.shelterState.status = 'wakingUp'
  assert.equal(f.getHeroSleepBlockedReason(f.hero, f.bed), null)
  f.hero.reachable = false
  assert.equal(f.getHeroSleepBlockedReason(f.hero, f.bed), 'heroBedSleepTooFar')
  f.hero.reachable = true
  f.hero.spaceId = 'outside'
  assert.equal(f.isUsableSleepTarget(f.hero, f.bed), false)
  assert.equal(f.sleepHeroAtTarget(f.hero, f.bed), false)
})

for (const ending of ['complete', 'cancel', 'refused']) {
  test(`hero reserves the mattress until waking after ${ending}`, () => {
    const f = fixture({ refused: ending === 'refused', mirrored: ending === 'cancel' })
    const npc = { owner: f.owner, context: f.hero.context }
    assert.equal(f.sleepHeroAtTarget(f.hero, f.bed), true)
    assert.equal(f.hero.currentCell, f.cell)
    assert.equal(f.hero.x, 32 + (ending === 'cancel' ? 1 : -1))
    assert.equal(f.hero.y, 100)
    assert.equal(f.hero.shelterState, undefined, 'manual sleep must not join the NPC schedule')
    assert.equal(f.isBedOccupied(npc, f.bed), true)
    if (ending === 'complete') f.callbacks().onComplete()
    if (ending === 'cancel') f.callbacks().onCancel()
    assert.equal(f.isBedOccupied(npc, f.bed), true)
    f.finishWake()
    assert.equal(f.hero.actionLocked, false)
    assert.equal(f.isBedOccupied(npc, f.bed), false)
  })
}
