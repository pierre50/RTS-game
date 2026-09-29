const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture(startHour = 22) {
  const calls = []
  const { SleepSimulation } = loadTsModule('app/services/world/SleepSimulation.ts', {
    mocks: {
      '../../lib/hero/heroCampfireSleep': { hasHostileInHeroSight: hero => Boolean(hero.hostile) },
      '../../lib/units/unitEnergy': { updateUnitEnergy() {} },
      '../../lib/units/unitHealth': { notifyHeroHealthChanged() {} },
      './DistantVillageEconomy': {
        planDistantVillageBuildings: (_context, owner) => calls.push(['plan', owner.label]),
      },
      './VillageWorkSimulation': {
        advanceVillageWork: (_context, _homes, owner, _units, duration, from) =>
          calls.push(['work', owner.label, from, duration]),
      },
    },
  })
  const { ActionScheduler } = loadTsModule('app/lib/actionScheduler.ts')
  const { DayNightSystem } = loadTsModule('app/services/DayNightSystem.ts', {
    mocks: { '../lib/lang': { t: () => '' } },
  })
  const scheduler = new ActionScheduler({ ticker: { add() {}, remove() {} } }, () => false)
  scheduler.suspended = true
  const schedule = {
    bedMinute: 1320,
    wakeMinute: 360,
    workStartMinute: 420,
    workEndMinute: 1080,
    lunchStartMinute: 720,
    lunchEndMinute: 780,
  }
  const hero = {
    type: 'Hero',
    label: 'hero',
    i: 1,
    j: 1,
    hitPoints: 20,
    totalHitPoints: 100,
    sleepVisualState: 'sleeping',
  }
  const worker = {
    type: 'Villager',
    label: 'worker',
    i: 4,
    j: 4,
    hitPoints: 10,
    totalHitPoints: 20,
    dailySchedule: schedule,
    inventory: { resources: { bread: 8 } },
  }
  const owners = ['player', 'ai'].map(label => ({
    label,
    units: label === 'player' ? [hero, worker] : [],
    buildings: [],
    config: {},
    isPlayed: label === 'player',
  }))
  const context = {
    scheduler,
    players: owners,
    controls: { heroUnit: hero },
    app: { ticker: { add() {} } },
    map: { grid: [] },
    timeSkip: { simulatingSleep: true },
    unitRest: { synchronizeAfterTimeJump: () => calls.push(['wake']) },
  }
  hero.context = context
  worker.context = context
  worker.owner = owners[0]
  context.dayNight = new DayNightSystem(context, { elapsedMs: (startHour - 7.5) * 60000 })
  context.dayNight.onDayChange((day, previous) => calls.push(['day', day, previous]))
  const villages = { beginSleep: () => calls.push(['begin']), endSleep: () => calls.push(['end']) }
  const simulation = new SleepSimulation(context, villages)
  return { simulation, context, calls, hero, worker }
}

function advance(simulation, context, target) {
  for (let frames = 0; context.dayNight.getElapsedMs() < target && !simulation.interrupted; frames++) {
    assert.ok(frames < 1000, 'sleep must converge')
    simulation.step(target)
  }
}

test('night heals once, advances exact clocks and emits the morning event once', () => {
  const { simulation, context, calls, hero, worker } = fixture()
  const from = context.dayNight.getElapsedMs()
  simulation.begin()
  context.dayNight.update(100)
  assert.equal(context.dayNight.getElapsedMs(), from, 'live ticker must not advance sleep')
  const target = from + 8 * 60000
  advance(simulation, context, target)
  assert.equal(context.dayNight.getElapsedMs(), target)
  assert.equal(context.scheduler.elapsedMs, 8 * 60000)
  assert.equal(hero.hitPoints, 100)
  assert.equal(worker.hitPoints, 20)
  assert.equal(worker.lastMealAt, 1800)
  assert.equal(calls.filter(call => call[0] === 'day').length, 1)
  assert.equal(calls.filter(call => call[0] === 'work').length, 0, 'sleeping workers need no terrain simulation')
  simulation.end()
  assert.deepEqual(calls.slice(-2), [['end'], ['wake']])
})

test('daytime sleep uses shared work and keeps the clock unchanged until every owner settles', () => {
  const { simulation, context, calls } = fixture(9)
  simulation.begin()
  const from = context.dayNight.getElapsedMs()
  simulation.step(from + 60000)
  assert.equal(context.dayNight.getElapsedMs(), from)
  assert.equal(simulation.busy, true)
  assert.deepEqual(
    calls.find(call => call[0] === 'work'),
    ['work', 'player', from, 60000]
  )
  advance(simulation, context, from + 60000)
  assert.equal(simulation.busy, false)
  assert.equal(calls.filter(call => call[0] === 'work').length, 1)
  simulation.end()
})

test('scheduled danger interrupts at its deadline without running movement or raid callbacks under the overlay', () => {
  const { simulation, context } = fixture()
  let raid = 0,
    movement = 0
  context.scheduler.add(() => movement++, 40, 'animal.step')
  context.scheduler.addOneShot(() => raid++, 30000, 'raid', { interruptSleep: true })
  const from = context.dayNight.getElapsedMs()
  simulation.begin()
  advance(simulation, context, from + 8 * 60000)
  assert.equal(context.dayNight.getElapsedMs(), from + 30000)
  assert.equal(simulation.interrupted, true)
  assert.equal(raid, 0)
  assert.equal(movement, 0)
  simulation.end()
  context.scheduler.suspended = false
  context.scheduler._tick(16)
  assert.equal(raid, 1)
  assert.equal(movement, 0)
})

test('nearby hostiles stop sleep before any simulation or healing', () => {
  const { simulation, context, hero } = fixture()
  hero.hostile = true
  const from = context.dayNight.getElapsedMs()
  simulation.begin()
  simulation.step(from + 60000)
  assert.equal(simulation.interrupted, true)
  assert.equal(simulation.busy, false)
  assert.equal(context.dayNight.getElapsedMs(), from)
  assert.equal(hero.hitPoints, 20)
  simulation.end()
})

test('new arrivals join the next interval, never receive the preceding night retroactively', () => {
  const { simulation, context, hero } = fixture()
  const arrival = {
    type: 'Villager',
    label: 'arrival',
    i: 4,
    j: 4,
    hitPoints: 5,
    totalHitPoints: 20,
    dailySchedule: {
      bedMinute: 1320,
      wakeMinute: 380,
      workStartMinute: 440,
      workEndMinute: 1080,
      lunchStartMinute: 720,
      lunchEndMinute: 780,
    },
    inventory: { resources: {} },
  }
  context.dayNight.onDayChange(() => context.players[0].units.push(arrival))
  const from = context.dayNight.getElapsedMs()
  simulation.begin()
  advance(simulation, context, from + 8 * 60000)
  assert.equal(arrival.hitPoints, 5)
  advance(simulation, context, from + (8 + 1 / 3) * 60000)
  assert.ok(Math.abs(arrival.hitPoints - (5 + 20 / 24)) < 0.00001)
  assert.equal(hero.hitPoints, 100)
  simulation.end()
})
