const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { canHeroSleepAtFireCamp, getHeroCampfireSleepBlockedReason } = loadTsModule(
  'app/lib/hero/heroCampfireSleep.ts',
  {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: { fireCamp: 'FireCamp' },
        FAMILY_TYPES: { animal: 'animal' },
        ACTION_TYPES: { attack: 'attack' },
      },
      '../../services/TimeSkipSystem': {},
      '../../services/rest/UnitSleepVisuals': {},
      '../entities/overheadIndicator': {},
      '../lang': {},
      './heroActionRange': { isHeroInteractionTargetReachable: hero => hero.reachable !== false },
      '../grid/visibility': {
        findInstancesInSight: (hero, predicate) => (hero.nearby ?? []).filter(predicate),
      },
    },
  }
)

test('campfire sleep identifies each blocker without inventing a hostile', () => {
  const camp = { type: 'FireCamp', isBuilt: true }
  for (const [hero, building, reason] of [
    [null, camp, 'heroSleepUnavailable'],
    [{ actionLocked: true }, camp, 'heroSleepUnavailable'],
    [{ isDead: true }, camp, 'heroSleepUnavailable'],
    [{}, { ...camp, isDestroyed: true }, 'heroCampfireSleepUnavailable'],
    [{}, { ...camp, isBuilt: false }, 'heroCampfireSleepNotBuilt'],
    [{ reachable: false }, camp, 'heroCampfireSleepTooFar'],
  ]) {
    assert.equal(getHeroCampfireSleepBlockedReason(hero, building), reason)
    assert.equal(canHeroSleepAtFireCamp(hero, building), false)
  }
})

test('foreign ownership alone does not prevent sleep; a living hostile does', () => {
  const enemy = {}
  const hero = { owner: { isEnemy: owner => owner === enemy }, nearby: [] }
  const camp = { type: 'FireCamp', isBuilt: true, owner: enemy }
  assert.equal(getHeroCampfireSleepBlockedReason(hero, camp), null)
  assert.equal(canHeroSleepAtFireCamp(hero, camp), true)
  hero.nearby = [{ owner: enemy }]
  assert.equal(getHeroCampfireSleepBlockedReason(hero, camp), 'heroCampfireSleepBlockedDescription')
  assert.equal(canHeroSleepAtFireCamp(hero, camp), false)
  hero.nearby[0].isDead = true
  assert.equal(canHeroSleepAtFireCamp(hero, camp), true)
})

test('peaceful wildlife does not block sleep even when its owner is an enemy', () => {
  const animals = require('../public/assets/data/gameplay/animals.json')
  const wildlife = { isEnemy: () => true }
  const hero = { owner: { isEnemy: () => true }, nearby: [] }
  const camp = { type: 'FireCamp', isBuilt: true }
  for (const [type, config] of Object.entries(animals)) {
    if (config.strategy !== 'runaway') continue
    hero.nearby = [{ ...config, type, family: 'animal', owner: wildlife }]
    assert.equal(canHeroSleepAtFireCamp(hero, camp), true, type)
  }
  assert.equal(animals.BlackGrouse.strategy, 'runaway')
})

test('aggressive or attacking wildlife blocks sleep, but dead animals do not', () => {
  const hero = { owner: { isEnemy: () => false }, nearby: [] }
  const camp = { type: 'FireCamp', isBuilt: true }
  for (const behavior of [{ strategy: 'attack' }, { strategy: 'runaway', action: 'attack' }]) {
    const animal = { ...behavior, family: 'animal', owner: {} }
    hero.nearby = [animal]
    assert.equal(canHeroSleepAtFireCamp(hero, camp), false)
    animal.isDead = true
    assert.equal(canHeroSleepAtFireCamp(hero, camp), true)
  }
})

test('hero sleeps through the shared NPC wake window and synchronizes sleepers before waking', () => {
  const { VILLAGE_WAKE_COMPLETE_HOUR, getVillagerSchedule } = loadTsModule('app/lib/units/villagerSchedule.ts')
  let options
  let targetHour
  const calls = []
  const { sleepHeroAtFireCamp } = loadTsModule('app/lib/hero/heroCampfireSleep.ts', {
    mocks: {
      '../../services/TimeSkipSystem': { getHoursUntilNextMorning: (_hour, _minute, target) => {
        targetHour = target
        return target + 1
      } },
      '../../services/rest/UnitSleepVisuals': {
        playSleepingOutsideVisual: (_hero, complete) => complete(),
        playSleepingWakeVisual: (_hero, complete) => { calls.push('wake-hero'); complete() },
      },
      '../entities/overheadIndicator': { setUnitOverheadIndicator() {}, clearUnitOverheadIndicator() {} },
      '../lang': { t: key => key },
      '../grid/visibility': { findInstancesInSight: () => [] },
      './heroActionRange': { isHeroInteractionTargetReachable: () => true },
    },
  })
  const hero = { context: {
    dayNight: { state: { hour: 23, minute: 0 } },
    timeSkip: { start: (_hours, callbacks) => { options = callbacks; return { ok: true } } },
    unitRest: { synchronizeAfterTimeJump: () => calls.push('wake-npcs') },
    autosave: () => calls.push('save'),
  } }
  assert.equal(sleepHeroAtFireCamp(hero, { type: 'FireCamp', isBuilt: true }), true)
  assert.equal(targetHour, VILLAGE_WAKE_COMPLETE_HOUR)
  assert.equal(Math.round(targetHour * 60), 380)
  for (let index = 0; index < 500; index++) {
    assert.ok(getVillagerSchedule({ label: `npc-${index}` }).wakeMinute <= targetHour * 60)
  }
  options.onComplete()
  assert.deepEqual(calls, ['wake-npcs', 'save', 'wake-hero'])
  assert.equal(hero.actionLocked, false)
  calls.length = 0
  options.onCancel()
  assert.deepEqual(calls, ['wake-hero'], 'an interrupted sleep must not force the village awake')
})
