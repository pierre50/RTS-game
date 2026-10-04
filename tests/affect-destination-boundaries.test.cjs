const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
function fixture() {
  const calls = []
  const rules = {
    pursue: false,
    hero: false,
    rpg: false,
    recover: false,
    resume: false,
    rejected: false,
    candidates: [],
    closest: null,
    contact: false,
  }
  const mark =
    name =>
    (...args) =>
      calls.push([name, ...args])
  const { affectNewDest } = loadTsModule('app/classes/unit/movement/UnitAffectNewDest.ts', {
    mocks: {
      '../../../lib/economy/constructionMaterials': { constructionProgress: dest => dest.constructionProgress ?? 0 },
      '../../../config/rpgVillages': { isRpgVillager: () => rules.rpg },
      '../../../lib/units/village/villageStateEvents': { notifyVillageStateChanged: mark('notify') },
      '../../../lib/units/targetPursuit': { updateTargetPursuit: () => rules.pursue },
      '../../../lib/units/autonomy/villagerExploration': {
        scheduleVillagerExplorationResume: (unit, resume) => {
          calls.push(['schedule'])
          resume(unit)
        },
      },
      '../../../lib/units/autonomy/villagerAutonomyTargeting': { isVillagerWorkTargetRejected: () => rules.rejected },
      '../../../lib': {
        findInstancesInSight: (_u, filter) => rules.candidates.filter(filter),
        getClosestInstanceWithPath: () => rules.closest,
        getInstanceDegree: () => 90,
        instanceContactInstance: () => rules.contact,
        resumeVillagerAutonomy: () => rules.resume,
      },
      '../../../lib/units/unitControl': { isHeroControlled: () => rules.hero },
      './UnitMovementHelpers': {
        isRecoveringAttack: () => rules.recover,
        isRuntimeEntity: dest => Boolean(dest?.family),
        pauseCombatRecoveryMove: mark('pause'),
      },
    },
  })
  const unit = {
    type: 'Villager',
    action: null,
    stop: mark('stop'),
    stopInterval: mark('interval'),
    goBackToPrevious: mark('previous'),
    setDest: mark('dest'),
    setPath: mark('path'),
    getAction: mark('action'),
    getActionCondition: () => true,
  }
  return { rules, calls, unit, run: () => affectNewDest(unit) }
}
test('idle destination completion restores exploration or pauses combat recovery', () => {
  const { rules, calls, unit, run } = fixture()
  rules.pursue = true
  run()
  assert.deepEqual(calls, [])
  rules.pursue = false
  unit.exploringForAutonomy = true
  unit.dest = {}
  unit.path = [{}]
  run()
  assert.equal(unit.dest, null)
  assert.deepEqual(unit.path, [])
  assert.equal(unit.inactif, true)
  assert.ok(calls.some(([event]) => event === 'schedule'))
  rules.recover = true
  run()
  assert.equal(calls.at(-1)[0], 'pause')
  rules.recover = false
  rules.resume = true
  calls.length = 0
  run()
  assert.deepEqual(calls, [['interval']])
})
test('interrupted build queue rotates a valid site and resumes only while idle', () => {
  for (const inactif of [true, false]) {
    const { calls, unit, run } = fixture()
    const site = { family: 'building' }
    let tick
    Object.assign(unit, {
      work: 'builder',
      action: 'build',
      dest: site,
      buildQueue: [site, { label: 'next' }],
      context: {
        scheduler: {
          addOneShot: fn => {
            tick = fn
          },
        },
      },
      inactif,
      continueBuildingQueue: () => calls.push(['continue']),
    })
    run()
    assert.equal(unit.buildQueue.at(-1), site)
    tick()
    assert.equal(
      calls.some(([event]) => event === 'continue'),
      inactif
    )
    unit.buildQueue = []
    calls.length = 0
    tick()
    assert.equal(calls.length, 0)
  }
})
test('lost build targets return to previous work or choose a reachable construction site', () => {
  const { rules, calls, unit, run } = fixture()
  Object.assign(unit, { work: 'builder', action: 'build' })
  unit.previousWork = 'woodcutter'
  run()
  assert.equal(calls.at(-1)[0], 'previous')
  delete unit.previousWork
  const site = { family: 'building' }
  rules.candidates = [site]
  rules.closest = { instance: site, path: [{}] }
  run()
  assert.deepEqual(calls.at(-1), ['path', [{}]])
  rules.closest = null
  run()
  assert.equal(unit.work, null)
  assert.equal(calls.at(-1)[0], 'stop')
  unit.work = 'builder'
  rules.candidates = []
  run()
  assert.equal(unit.work, null)
})
test('replacement targets reject stale work, prefer contact actions and stop unsuccessful hunts', () => {
  const { rules, calls, unit, run } = fixture()
  unit.action = 'chopwood'
  unit.previousDest = { family: 'resource' }
  run()
  assert.equal(calls.at(-1)[0], 'previous')
  rules.rejected = true
  rules.candidates = [{ family: 'resource' }]
  rules.closest = { instance: rules.candidates[0], path: [{}] }
  run()
  assert.equal(calls.at(-1)[0], 'stop')
  unit.previousDest = null
  rules.rejected = false
  rules.contact = true
  run()
  assert.deepEqual(calls.at(-1), ['action', 'chopwood'])
  assert.equal(unit.degree, 90)
  rules.contact = false
  run()
  assert.deepEqual(calls.at(-1), ['path', [{}]])
  unit.action = 'hunt'
  unit.dest = { family: 'animal' }
  run()
  assert.equal(calls.at(-1)[0], 'stop')
  unit.handleAffectNewDestHunter = () => true
  calls.length = 0
  run()
  assert.deepEqual(calls, [['interval']])
  unit.action = 'attack'
  unit.work = 'builder'
  unit.previousWork = 'woodcutter'
  run()
  assert.equal(calls.at(-1)[0], 'previous')
})
