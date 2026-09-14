const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const constants = {
  BUILDING_TYPES: { townCenter: 'TownCenter' },
  WORK_TYPES: { attacker: 'attacker' },
  UNIT_TYPES: {
    hero: 'Hero',
    chief: 'Chief',
    infantry: 'Fantassin',
    villager: 'Villager',
  },
}

function loadSystem(scheduleCalls) {
  return loadTsModule('app/services/IdleUnitPatrolSystem.ts', {
    mocks: {
      '../constants': constants,
      '../lib/mapSpaces': { sameMapSpace: (a, b) => (a.spaceId ?? 'outside') === (b.spaceId ?? 'outside') },
      '../lib/units/walkAround': {
        scheduleUnitWalkAround: (unit, options) => {
          scheduleCalls.push([unit.label, options])
          options.onTaskId?.(unit, 200 + scheduleCalls.length)
          return 200 + scheduleCalls.length
        },
      },
    },
  }).IdleUnitPatrolSystem
}

test('player chief patrols around the TownCenter and yields to dialogue and scripted actions', () => {
  const scheduleCalls = []
  const center = { type: 'TownCenter', i: 10, j: 10, isBuilt: true }
  const chief = createUnit('chief', { type: 'Chief', isChief: true, work: 'attacker' })
  const owner = { isPlayed: true, buildings: [center], units: [chief] }
  chief.owner = owner
  const System = loadSystem(scheduleCalls)
  new System({ players: [owner], scheduler: createScheduler([]) })
  const options = scheduleCalls[0][1]
  assert.equal(options.anchor(chief), center)
  assert.equal(options.range(chief), 6)
  assert.equal(options.delayMinMs(chief), 6000)
  assert.equal(options.delayMaxMs(chief), 12000)
  chief.lookingAtHero = true
  assert.equal(options.canMove(chief), false)
  chief.lookingAtHero = false
  chief.actionLocked = true
  assert.equal(options.canMove(chief), false)
  chief.actionLocked = false
  chief.spaceId = 'house'
  assert.equal(options.anchor(chief), chief, 'outside coordinates are never used inside a house')
  delete chief.spaceId
  center.isDestroyed = true
  assert.equal(options.anchor(chief), chief)
})

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
    type: constants.UNIT_TYPES.villager,
    i: 5,
    j: 5,
    isDead: false,
    isDestroyed: false,
    ...extra,
  }
}

test('idle unit patrol schedules only units with no active role', () => {
  const calls = []
  const scheduleCalls = []
  const idleVillager = createUnit('idle-villager')
  const idleInfantry = createUnit('idle-infantry', { type: constants.UNIT_TYPES.infantry })
  const hero = createUnit('hero', { type: constants.UNIT_TYPES.hero })
  const heroControlled = createUnit('hero-controlled', { controlMode: 'hero' })
  const follower = createUnit('follower', { followingHero: true })
  const worker = createUnit('worker', { work: 'woodcutter' })
  const autonomousWorker = createUnit('autonomous-worker', { autonomousJob: { resourceType: 'stone' } })
  const attacker = createUnit('attacker', { combatMode: 'attack' })
  const lookingAtHero = createUnit('looking-at-hero', { lookingAtHero: true })
  const waitingForEnergy = createUnit('waiting-for-energy', { waitingForEnergyAction: 'attack' })
  const trainee = createUnit('trainee', { trainingTargetType: constants.UNIT_TYPES.villager })
  const owner = {
    units: [
      idleVillager,
      idleInfantry,
      hero,
      heroControlled,
      follower,
      worker,
      autonomousWorker,
      attacker,
      lookingAtHero,
      waitingForEnergy,
      trainee,
    ],
  }
  const context = {
    players: [owner],
    scheduler: createScheduler(calls),
  }
  const IdleUnitPatrolSystem = loadSystem(scheduleCalls)

  new IdleUnitPatrolSystem(context)

  assert.deepEqual(
    scheduleCalls.map(call => call[0]),
    ['idle-villager', 'idle-infantry']
  )

  const options = scheduleCalls[0][1]
  assert.equal(options.delayMinMs(idleVillager), 14000)
  assert.equal(options.delayMaxMs(idleVillager), 32000)
  assert.equal(options.range(idleVillager), 2)
  assert.equal(options.taskName, 'unitIdle.patrol')
  assert.equal(options.anchor(idleVillager), idleVillager)
  assert.equal(options.canMove(idleVillager), true)
  idleVillager.work = 'stonecutter'
  assert.equal(options.canMove(idleVillager), false)
  idleVillager.work = null
  idleVillager.followingHero = true
  assert.equal(options.canMove(idleVillager), false)
  idleVillager.followingHero = false
  idleVillager.combatMode = 'attack'
  assert.equal(options.canMove(idleVillager), false)
  assert.equal(idleVillager.idlePatrolTaskId, 201)
  assert.equal(idleInfantry.idlePatrolTaskId, 202)
})

test('idle unit patrol discovers newly idle units and cleans scheduled tasks', () => {
  const calls = []
  const scheduleCalls = []
  const villager = createUnit('villager', { work: 'woodcutter' })
  const owner = { units: [villager] }
  const scheduler = createScheduler(calls)
  const context = {
    players: [owner],
    scheduler,
  }
  const IdleUnitPatrolSystem = loadSystem(scheduleCalls)
  const system = new IdleUnitPatrolSystem(context)

  assert.equal(scheduleCalls.length, 0)

  villager.work = null
  scheduler.callback()

  assert.equal(scheduleCalls.length, 1)
  assert.equal(villager.idlePatrolTaskId, 201)
  system.destroy()

  assert.deepEqual(calls.filter(call => call[0] === 'remove'), [
    ['remove', 1],
    ['remove', 201],
  ])
  assert.equal(villager.idlePatrolTaskId, null)
}
)
