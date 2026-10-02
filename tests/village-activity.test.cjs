const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
function setup(developmentMode) {
  const moduleCache = new Map()
  const advances = []
  const recalls = []
  const mocks = {
    './DistantVillageEconomy': {
      advanceDistantVillageEconomy() {},
      planDistantVillageBuildings() {},
    },
    './world/VillageWorkSimulation': {
      advanceVillageWork(_context, home, _owner, units, ms) {
        advances.push({ id: home.id, units, ms })
      },
    },
    './patrol/CampLeashController': {
      CampLeashController: class {
        update(unit) {
          recalls.push(unit)
        }
        recall(unit) {
          unit.action = null
          unit.dest = null
          unit.campBehavior = { phase: 'return' }
        }
      },
    },
  }
  const { VillageActivitySystem } = loadTsModule('app/services/VillageActivitySystem.ts', { mocks, moduleCache })
  const rules = {
    ...loadTsModule('app/lib/units/villageActivity.ts', { mocks, moduleCache }),
    ...loadTsModule('app/lib/units/unitSuspension.ts', { mocks, moduleCache }),
  }
  const owner = {
    label: 'ai',
    type: 'AI',
    developmentMode,
    units: [],
    buildings: [
      { label: 'a', type: 'TownCenter', i: 50, j: 50, isBuilt: true },
      { label: 'b', type: 'TownCenter', i: 300, j: 300, isBuilt: true },
    ],
    isEnemy: p => p.type === 'enemy',
  }
  const human = { isPlayed: true, units: [{ i: 500, j: 500, controlMode: 'hero' }], buildings: [] }
  const context = {
    scheduler: {
      elapsedMs: 0,
      add() {
        return 1
      },
      remove() {},
    },
    players: [owner, human],
    map: { spaces: new Map() },
  }
  function worker(i, j) {
    const unit = {
      type: 'Villager',
      i,
      j,
      label: `worker:${i}`,
      owner,
      context,
      autonomousJob: 'wood',
      action: 'chopwood',
      sprite: {
        playing: true,
        stop() {
          this.playing = false
        },
        onLoop() {},
        onFrameChange() {},
      },
      dest: { i: i + 1, j, family: 'resource' },
      path: [],
      stopInterval() {
        this.stopped = true
      },
      sendToEvt() {
        this.resumed = true
      },
      stopTimeout() {},
    }
    owner.units.push(unit)
    return unit
  }
  const first = worker(51, 50)
  const second = worker(301, 300)
  const service = new VillageActivitySystem(context)
  return { service, rules, context, owner, human, first, second, advances, recalls }
}
test('fixed settlements are suspended before the first simulation tick and wake near the camera', () => {
  const f = setup('static')
  assert.equal(f.context.scheduler.elapsedMs, 0)
  assert.equal(f.rules.isDistantOwner(f.owner), true)
  assert.equal(f.rules.isUnitSuspended(f.first), true)
  assert.equal(f.rules.isUnitSuspended(f.second), true)
  f.human.units[0] = { i: 52, j: 50, controlMode: 'hero' }
  f.context.controls = {
    getViewportMetrics: () => ({ visibleLeft: -100, visibleTop: 1500, visibleWidth: 200, visibleHeight: 200 }),
  }
  f.service.update()
  assert.equal(f.rules.isUnitSuspended(f.first), false)
  assert.equal(f.first.resumed, true)
  assert.deepEqual(f.advances, [])
})
test('homes are stable per town center, not per faction; destroyed centers reassign their residents', () => {
  const { service, first, second, owner, context } = setup()
  assert.notEqual(first.villageHome.id, second.villageHome.id)
  first.i = 290
  first.j = 300
  context.scheduler.elapsedMs = 5000
  service.update()
  assert.equal(first.villageHome.id, 'ai:a')
  owner.buildings[0].isDestroyed = true
  context.scheduler.elapsedMs = 10000
  service.update()
  assert.equal(first.villageHome.id, 'ai:b')
})
test('30 cell work radius projects interiors and exempts expeditions, scouts and player control', () => {
  const { rules, first, context } = setup()
  assert.equal(rules.withinVillageActivity(first, { i: 80, j: 50 }), true)
  assert.equal(rules.withinVillageActivity(first, { i: 81, j: 50 }), false)
  context.map.spaces.set('room', { portals: [{ targetSpaceId: 'outside', targetCell: { i: 55, j: 50 } }] })
  assert.equal(rules.withinVillageActivity(first, { i: 999, j: 999, spaceId: 'room' }), true)
  for (const field of [
    { followingHero: true },
    { factionExpedition: {} },
    { type: 'Scout' },
    { owner: { isPlayed: true } },
  ])
    assert.equal(rules.withinVillageActivity({ ...first, ...field }, { i: 999, j: 999 }), true)
})
test('detail hysteresis follows the hero, not remote player buildings; flush and wake account time once', () => {
  const { service, rules, context, human, first, advances } = setup()
  service.update()
  assert.equal(rules.isUnitSuspended(first), true)
  assert.equal(first.sprite.playing, false)
  assert.equal(first.sprite.onFrameChange, undefined)
  assert.equal(first.sprite.onLoop, undefined)
  context.scheduler.elapsedMs = 1500
  rules.flushVillageSimulation(context)
  assert.equal(advances.filter(a => a.id === 'ai:a').at(-1).ms, 1500)
  human.units[0] = { i: 140, j: 50, controlMode: 'hero' }
  service.update()
  assert.equal(rules.isUnitSuspended(first), true, '90 cells preserves distant mode')
  human.buildings.push({ i: 120, j: 50 })
  service.update()
  assert.equal(rules.isUnitSuspended(first), true, 'remote buildings do not wake a village')
  human.units[0].i = 120
  context.scheduler.elapsedMs = 2000
  service.update()
  assert.equal(rules.isUnitSuspended(first), false)
  assert.equal(first.resumed, true)
  assert.equal(
    advances.filter(a => a.id === 'ai:a').reduce((sum, a) => sum + a.ms, 0),
    2000
  )
  human.buildings = []
  human.units[0].i = 140
  service.update()
  assert.equal(rules.isUnitSuspended(first), false, '90 cells preserves detailed mode')
  service.destroy()
})
test('combat wakes immediately; unsupported activities stay live and distant orders are recalled', () => {
  const { service, rules, first, second, recalls } = setup()
  second.action = 'hunt'
  service.update()
  assert.equal(rules.isUnitSuspended(second), false)
  rules.wakeUnitSimulation(first)
  assert.equal(rules.isUnitSuspended(first), false)
  first.action = 'attack'
  service.update()
  assert.ok(recalls.includes(first))
  second.dest = { i: 400, j: 300 }
  service.update()
  assert.equal(second.campBehavior.phase, 'return')
  assert.equal(second.dest, null)
})

test('sleep hands off old village checkpoints without replaying the night on wake', () => {
  const { service, context, advances } = setup()
  service.update()
  context.scheduler.elapsedMs = 1200
  service.beginSleep()
  const settled = advances.length
  assert.ok(settled > 0)
  context.scheduler.elapsedMs += 8 * 60000
  service.flush()
  service.update()
  assert.equal(advances.length, settled, 'live settlement must not run during sleep')
  service.endSleep()
  service.update()
  service.flush()
  assert.ok(
    advances.slice(settled).every(advance => advance.ms === 0),
    'sleep time must not be produced twice'
  )
  service.destroy()
})

test('AI supply trips outside the village stay live and are not recalled like combat pursuits', () => {
  const { service, first, context, recalls, rules } = setup()
  const tree = { family: 'resource', type: 'Tree', i: 150, j: 50, quantity: 100 }
  first.dest = tree
  service.update()
  assert.equal(rules.isUnitSuspended(first), false)
  assert.equal(first.dest, tree)
  assert.equal(recalls.includes(first), false)
  first.i = 150
  context.scheduler.elapsedMs = 500
  service.update()
  assert.equal(first.dest, tree)
  assert.equal(rules.isUnitSuspended(first), false)
  first.action = 'delivery'
  first.dest = { family: 'building', i: 51, j: 50 }
  service.update()
  assert.equal(first.action, 'delivery')
  assert.equal(recalls.includes(first), false)
})

test('AI workers missing a resource target stay live to search beyond the local snapshot', () => {
  const { service, first, rules } = setup()
  first.dest = null
  first.action = null
  first.autonomyBlockedJob = 'wood'
  service.update()
  assert.equal(rules.isUnitSuspended(first), false)
})

test('static village activation has one shared camera hysteresis for all residents', () => {
  const f = setup('static')
  f.first.i = 50
  f.first.j = 60 // Outside both camera margins, but still a resident of the observed base.
  let left = 250
  f.context.controls = {
    getViewportMetrics: () => ({ visibleLeft: left, visibleTop: 1500, visibleWidth: 100, visibleHeight: 200 }),
  }
  const update = () => {
    f.context.scheduler.elapsedMs += 3000
    f.service.update()
  }
  update()
  assert.equal(f.rules.isDistantOwner(f.owner), false)
  assert.equal(f.rules.isUnitSuspended(f.first), false, 'the active base owns activity, not each resident viewport')
  left = 350
  update()
  assert.equal(f.rules.isDistantOwner(f.owner), false, 'remain active within the outer margin')
  left = 500
  update()
  assert.equal(f.rules.isDistantOwner(f.owner), true)
  left = 350
  update()
  assert.equal(f.rules.isDistantOwner(f.owner), true, 'outer margin alone cannot wake the base')
  left = 250
  update()
  assert.equal(f.rules.isDistantOwner(f.owner), false)
})

test('an active static owner never puts a second base into legacy economic sleep', () => {
  const f = setup('static')
  f.context.controls = {
    getViewportMetrics: () => ({ visibleLeft: -100, visibleTop: 1500, visibleWidth: 200, visibleHeight: 200 }),
  }
  f.service.update()
  assert.equal(f.rules.isDistantOwner(f.owner), false)
  assert.equal(f.rules.isUnitSuspended(f.second), false)
  f.context.scheduler.elapsedMs += 600000
  f.service.flush()
  assert.deepEqual(f.advances, [])
})
