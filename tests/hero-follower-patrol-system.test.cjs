const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const constants = {
  UNIT_TYPES: {
    hero: 'Hero',
    infantry: 'Fantassin',
    villager: 'Villager',
  },
}

function loadSystem(scheduleCalls) {
  return loadTsModule('app/services/HeroFollowerPatrolSystem.ts', {
    mocks: {
      '../constants': constants,
      '../lib/mapSpaces': {
        sameMapSpace: (a, b) => (a?.spaceId ?? 'outside') === (b?.spaceId ?? 'outside'),
      },
      '../lib/units/walkAround': {
        scheduleUnitWalkAround: (unit, options) => {
          scheduleCalls.push([unit.label, options])
          options.onTaskId?.(unit, 100 + scheduleCalls.length)
          return 100 + scheduleCalls.length
        },
      },
    },
  }).HeroFollowerPatrolSystem
}

function createScheduler(calls) {
  return {
    elapsedMs: 0,
    add(callback, interval, name) {
      calls.push(['add', interval, name])
      this.callback = callback
      return 1
    },
    remove(taskId) {
      calls.push(['remove', taskId])
    },
  }
}

function createUnit(label, extra = {}) {
  return {
    label,
    type: constants.UNIT_TYPES.infantry,
    i: 5,
    j: 5,
    isDead: false,
    isDestroyed: false,
    followingHero: false,
    ...extra,
  }
}

test('hero follower patrol schedules only infantry followers in the hero map space', () => {
  const calls = []
  const scheduleCalls = []
  const hero = createUnit('hero', { type: constants.UNIT_TYPES.hero })
  const infantryFollower = createUnit('infantry-follower', { followingHero: true })
  const villagerFollower = createUnit('villager-follower', {
    followingHero: true,
    type: constants.UNIT_TYPES.villager,
  })
  const idleInfantry = createUnit('idle-infantry')
  const otherSpaceFollower = createUnit('other-space-follower', { followingHero: true, spaceId: 'interior' })
  const owner = { units: [hero, infantryFollower, villagerFollower, idleInfantry, otherSpaceFollower] }
  for (const unit of owner.units) unit.owner = owner
  const context = {
    controls: { heroUnit: hero },
    players: [owner],
    scheduler: createScheduler(calls),
  }
  const HeroFollowerPatrolSystem = loadSystem(scheduleCalls)

  new HeroFollowerPatrolSystem(context)

  assert.deepEqual(
    scheduleCalls.map(call => call[0]),
    ['infantry-follower']
  )
  const options = scheduleCalls[0][1]
  assert.equal(options.delayMinMs(infantryFollower), 10000)
  assert.equal(options.delayMaxMs(infantryFollower), 22000)
  assert.equal(options.range(infantryFollower), 2)
  assert.equal(options.taskName, 'heroFollower.patrol')
  assert.equal(options.anchor(infantryFollower), hero)
  assert.equal(options.canMove(infantryFollower), true)
  infantryFollower.lookingAtHero = true
  assert.equal(options.canMove(infantryFollower), false)
  infantryFollower.lookingAtHero = false
  infantryFollower.waitingForEnergyAction = 'attack'
  assert.equal(options.canMove(infantryFollower), false)
  assert.equal(infantryFollower.heroFollowerPatrolTaskId, 101)
})

test('hero follower patrol discovers newly attached infantry and cleans scheduled tasks', () => {
  const calls = []
  const scheduleCalls = []
  const hero = createUnit('hero', { type: constants.UNIT_TYPES.hero })
  const infantry = createUnit('infantry')
  const owner = { units: [hero, infantry] }
  for (const unit of owner.units) unit.owner = owner
  const scheduler = createScheduler(calls)
  const context = {
    controls: { heroUnit: hero },
    players: [owner],
    scheduler,
  }
  const HeroFollowerPatrolSystem = loadSystem(scheduleCalls)
  const system = new HeroFollowerPatrolSystem(context)

  assert.equal(scheduleCalls.length, 0)

  infantry.followingHero = true
  scheduler.callback()

  assert.equal(scheduleCalls.length, 1)
  assert.equal(infantry.heroFollowerPatrolTaskId, 101)
  system.destroy()

  assert.deepEqual(calls.filter(call => call[0] === 'remove'), [
    ['remove', 1],
    ['remove', 101],
  ])
  assert.equal(infantry.heroFollowerPatrolTaskId, null)
})
