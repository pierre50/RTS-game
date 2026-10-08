const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { fixture } = require('./helpers/ambientTrafficFixture.cjs')

test('distant groups progress without creating units, paths or population', () => {
  const f = fixture(24)
  f.context.controls.heroUnit.i = 2000
  f.tick(60000)
  assert.equal(f.created.length, 0)
  assert.ok(f.groups.every(g => g.progress > 70))
  assert.equal(f.owner.population, 20)
})
test('only two groups materialize, away from the camera, and outside the workforce', () => {
  const f = fixture(5)
  f.show()
  f.tick()
  assert.equal(f.created.length, 0)
  f.show(false)
  f.tick()
  assert.equal(f.created.length, 2)
  f.tick(31000)
  assert.equal(f.created.length, 4)
  f.tick(31000)
  assert.equal(f.created.length, 4)
  assert.equal(f.owner.units.length, 0)
  assert.equal(f.owner.population, 20)
})
test('moving away releases actors, saving and reloading retains their identity and injuries', () => {
  const f = fixture()
  f.tick()
  f.created[0].hitPoints = 7
  f.context.controls.heroUnit.i = 450
  f.tick()
  assert.ok(f.created.every(actor => actor.isDestroyed))
  assert.equal(f.groups[0].members[0].hitPoints, 7)
  assert.equal(f.groups[0].materialized, false)
  const saved = f.state.serializeAmbientTraffic(f.context.map)
  assert.equal(saved.groups[0].members[0].name, 'Alexios')
  f.service.destroy()
  f.state.restoreAmbientTraffic(f.context.map, saved)
  assert.deepEqual(f.state.ambientTrafficState(f.context.map), saved)
  saved.groups[0].members[0].name = 'mutated'
  assert.equal(f.state.ambientTrafficState(f.context.map).groups[0].members[0].name, 'Alexios')
})
test('dead members do not respawn and distant combat cannot be despawned', () => {
  const f = fixture()
  f.tick()
  f.created[0].isDead = true
  f.created[1].combatMode = true
  f.context.controls.heroUnit.i = 450
  f.tick()
  assert.equal(f.created[1].isDestroyed, undefined)
  f.created[1].combatMode = false
  f.tick()
  assert.equal(f.groups[0].members[0].isDead, true)
  f.context.controls.heroUnit.i = 0
  f.tick(31000)
  assert.equal(f.created.length, 3)
})
test('bandit traffic retires when its camp is cleared', () => {
  const f = fixture()
  Object.assign(f.groups[0], { kind: 'bandits', campId: 'camp', campGeneration: 0 })
  f.context.camps = [{ id: 'camp', generation: 0, clearedAtMs: 100 }]
  f.tick()
  assert.equal(f.groups[0].retired, true)
  assert.equal(f.created.length, 0)
})
test('a saved visible group restores at its saved positions instead of popping away', () => {
  const f = fixture()
  f.groups[0].materialized = true
  f.groups[0].members.forEach((m, n) => {
    m.i = 10 + n
    m.j = 10
  })
  f.show()
  f.tick()
  assert.equal(f.created.length, 2)
  assert.equal(f.created[0].i, 10)
})
test('long time skips equal incremental travel including endpoint pauses', () => {
  const f = fixture()
  const whole = structuredClone(f.groups[0]),
    split = structuredClone(whole)
  f.state.advanceTraffic(whole, 86400)
  for (let n = 0; n < 8640; n++) f.state.advanceTraffic(split, 10)
  assert.ok(Math.abs(whole.progress - split.progress) < 1e-7)
  assert.equal(whole.reverse, split.reverse)
})
test('destroy unregisters its scheduler and removes living materialized actors', () => {
  const f = fixture()
  f.tick()
  f.service.destroy()
  assert.ok(f.created.every(actor => actor.isDestroyed))
  assert.equal(f.context.map.grid[70][10].solid, false)
})

test('traffic saves validate positions, roster bounds and route continuity', () => {
  const f = fixture()
  const { validateAmbientTraffic } = loadTsModule('app/serialization/validation/SaveAmbientTrafficValidation.ts')
  const saved = f.state.serializeAmbientTraffic(f.context.map)
  const config = { units: { Villager: {} } }
  assert.doesNotThrow(() => validateAmbientTraffic(saved, 500, config))
  for (const mutate of [
    s => {
      s.groups[0].progress = Infinity
    },
    s => {
      s.groups[0].members.push(...s.groups[0].members)
    },
    s => {
      s.groups[0].route[5].i = 499
    },
    s => {
      s.groups.push(structuredClone(s.groups[0]))
    },
    s => {
      s.groups[0].members[0].type = 'Hero'
    },
  ]) {
    const invalid = structuredClone(saved)
    mutate(invalid)
    assert.throws(() => validateAmbientTraffic(invalid, 500, config))
  }
})
test('traffic snapshot contains no live orders and retains appearance and equipment', () => {
  const f = fixture()
  const saved = f.state.snapshotTrafficActor({
    type: 'Fantassin',
    label: 'traveler',
    i: 1,
    j: 2,
    name: 'Leon',
    assetCiv: 'Hellas',
    appearanceVariants: { gender: 'male' },
    inventory: { resources: { meat: 1 } },
    equipment: ['sword'],
    action: 'attack',
    dest: { circular: true },
    owner: f.owner,
  })
  assert.equal(saved.action, undefined)
  assert.equal(saved.owner, undefined)
  assert.equal(saved.name, 'Leon')
  assert.deepEqual(saved.equipment, ['sword'])
})

test('roster favors friendly cities and does not duplicate its persistent groups', () => {
  const owner = {
    type: 'AI',
    label: 'a',
    civ: 'Hellas',
    buildings: [{ type: 'TownCenter', label: 'a-town', i: 0, j: 10, isBuilt: true }],
    isEnemy: other => other.label === 'enemy',
  }
  const enemy = {
    type: 'AI',
    label: 'enemy',
    civ: 'Hellas',
    buildings: [{ type: 'TownCenter', label: 'enemy-town', i: 100, j: 10, isBuilt: true }],
  }
  const friend = {
    type: 'AI',
    label: 'friend',
    civ: 'Hellas',
    buildings: [{ type: 'TownCenter', label: 'friend-town', i: 200, j: 10, isBuilt: true }],
  }
  const { buildTrafficRoutes } = loadTsModule('app/services/travel/ambient/AmbientTrafficRoutes.ts', {
    mocks: {
      '../../world/distantVillages/DeferredVillageStore': { deferredVillageBuildings: () => undefined },
      '../../../lib/camps/campRespawnState': { campRespawnStates: () => [] },
      '../../../lib/mapSpaces': { getEntitySpaceId: () => 'outside' },
      '../RoadRoute': {
        townArrivalCells: (_to, from) => [from],
        *planRoadRoute(from, to) {
          yield
          const step = Math.sign(to.i - from.i)
          return Array.from({ length: Math.abs(to.i - from.i) }, (_, n) => ({ i: from.i + step * (n + 1), j: 10 }))
        },
      },
    },
  })
  const context = { map: { roads: { cells: [[0, 2]] } }, players: [owner, enemy, friend] }
  const groups = []
  for (const _ of buildTrafficRoutes(context, groups)) void _
  assert.equal(groups.find(g => g.owner === 'a').to.owner, 'friend')
  assert.equal(groups.length, 4, 'two departures per 200-cell friendly connection')
  const base = groups.find(g => g.owner === 'a' && !g.id.includes(':departure:'))
  const additional = groups.find(g => g.owner === 'a' && g.id.includes(':departure:'))
  assert.equal(additional.route, base.route, 'reuse the planned route')
  assert.equal(Math.abs(additional.progress - base.progress), 100)
  const ids = groups.map(g => g.id)
  for (const _ of buildTrafficRoutes(context, groups)) void _
  assert.deepEqual(
    groups.map(g => g.id),
    ids
  )
})

test('following a visible group reaches its destination and starts a rest before returning', () => {
  const f = fixture()
  f.tick()
  let arrived = false
  for (let n = 0; n < 1000; n++) {
    for (const actor of f.created) {
      const target = actor.path?.[0]
      if (!target || actor.isDestroyed) continue
      const old = f.context.map.grid[actor.i][actor.j]
      if (old.has === actor) {
        old.has = null
        old.solid = false
      }
      Object.assign(actor, { i: target.i, j: target.j, path: [] })
      target.has = actor
      target.solid = true
    }
    f.context.controls.heroUnit.i = f.created[0].i
    f.tick()
    if (f.groups[0].reverse && f.groups[0].pauseMs > 0) {
      arrived = true
      break
    }
  }
  assert.equal(arrived, true)
  assert.equal(f.groups[0].progress, 400)
  f.tick(30000)
  for (let n = 0; n < 30; n++) {
    for (const actor of f.created) finishStep(f, actor)
    f.tick(250)
  }
  assert.ok(
    f.created.every(actor => actor.i < 390),
    'the group returns without crossing or blocking each other'
  )
})

test('a failed optional actor spawn cleans up the partial group and backs off', () => {
  const f = fixture()
  const create = f.owner.createUnit
  let calls = 0
  f.owner.createUnit = options => {
    if (++calls === 2) throw new Error('missing optional sprite')
    return create(options)
  }
  const warn = console.warn
  console.warn = () => {}
  try {
    assert.doesNotThrow(() => f.tick())
    assert.equal(f.created[0].isDestroyed, true)
    f.tick()
    assert.equal(calls, 2)
    assert.equal(f.groups[0].materialized, undefined)
  } finally {
    console.warn = warn
  }
})

test('leaving a visible group before a time skip preserves the elapsed journey time', () => {
  const f = fixture()
  f.tick()
  const before = f.groups[0].progress
  f.context.controls.heroUnit.i = 450
  f.tick(60000)
  assert.equal(f.groups[0].materialized, false)
  assert.ok(f.groups[0].progress > before + 20)
})

function finishStep(f, actor) {
  const target = actor.path?.[0]
  if (!target) return
  assert.equal(target.solid, false, 'travelers must not step onto an occupied cell')
  const old = f.context.map.grid[actor.i][actor.j]
  if (old.has === actor) {
    old.has = null
    old.solid = false
  }
  Object.assign(actor, { i: target.i, j: target.j, path: [] })
  target.has = actor
  target.solid = true
}

test('escorts keep to road bends and wait for a slower or stopped rear member', () => {
  const f = fixture()
  const g = f.groups[0]
  g.route = [
    ...Array.from({ length: 81 }, (_, i) => ({ i, j: 10 })),
    ...Array.from({ length: 11 }, (_, n) => ({ i: 80, j: 11 + n })),
    ...Array.from({ length: 50 }, (_, n) => ({ i: 81 + n, j: 21 })),
  ]
  g.members.push({ label: 'escort', type: 'Bowman', i: 0, j: 10 })
  f.tick()
  f.show()
  for (let tick = 0; tick < 260; tick++) {
    for (let n = 0; n < f.created.length; n++) {
      const actor = f.created[n]
      const target = actor.path?.[0]
      if (target) {
        assert.ok(g.route.some(p => p.i === target.i && p.j === target.j))
        assert.ok(Math.hypot(target.i - actor.i, target.j - actor.j) <= Math.SQRT2)
      }
      // The rear walks three times slower, then stops entirely for a while.
      if (n !== 2 || (tick % 3 === 0 && (tick < 45 || tick > 85))) finishStep(f, actor)
    }
    f.tick(250)
    const indices = f.created.map(a => g.route.findIndex(p => p.i === a.i && p.j === a.j))
    assert.ok(indices.every(i => i >= 0))
    assert.ok(indices[0] - indices[1] <= 3)
    assert.ok(indices[1] - indices[2] <= 3)
  }
  assert.ok(
    f.created.every(a => a.j === 21),
    'everyone follows both bends'
  )
})

test('an occupied road spawn uses another route cell instead of the roadside', () => {
  const f = fixture()
  f.context.map.grid[70][10].solid = true
  f.tick()
  assert.equal(f.created.length, 2)
  assert.ok(f.created.every(a => a.j === 10 && a.i !== 70))
})

test('distant traffic advances exactly once per update', () => {
  const f = fixture()
  f.context.controls.heroUnit.i = 2000
  const expected = structuredClone(f.groups[0])
  f.state.advanceTraffic(expected, 10)
  f.tick(10000)
  assert.equal(f.groups[0].progress, expected.progress)
})

test('nearby traffic can appear after twelve seconds, still capped at two groups', () => {
  const f = fixture(4)
  f.groups.forEach((g, n) => {
    g.progress = 30 + n * 10
  })
  f.tick(250)
  assert.equal(f.created.length, 2, 'traffic can appear 30 cells away when off camera')
  f.tick(11750)
  assert.equal(f.created.length, 2)
  f.tick(250)
  assert.equal(f.created.length, 4)
  f.tick(12000)
  assert.equal(f.created.length, 4)
})

test('night doubles eligible bandit patrols and halves other traffic between 20h and 6h', () => {
  const f = fixture(20)
  const active = f.state.trafficActiveAtHour
  for (const hour of [6, 12, 19]) assert.equal(f.groups.filter(g => active(g, hour)).length, 20)
  for (const hour of [20, 23, 0, 5]) assert.equal(f.groups.filter(g => active(g, hour)).length, 10)
  const bandit = { ...f.groups[0], kind: 'bandits', id: 'patrol' }
  const extra = { ...bandit, id: 'patrol:night' }
  assert.equal([bandit, extra].filter(g => active(g, 12)).length, 1)
  assert.equal([bandit, extra].filter(g => active(g, 22)).length, 2)
})

test('daybreak does not remove a visible night patrol, but it rests after leaving view', () => {
  const f = fixture()
  const group = f.groups[0]
  Object.assign(group, { kind: 'bandits', id: 'patrol:night', campId: 'camp', campGeneration: 0 })
  f.context.camps = [{ id: 'camp', generation: 0 }]
  f.context.dayNight = { state: { hour: 12 } }
  f.tick()
  assert.equal(f.created.length, 0)
  f.context.dayNight.state.hour = 22
  f.tick()
  assert.equal(f.created.length, 2)
  f.context.dayNight.state.hour = 6
  f.tick()
  assert.ok(f.created.every(a => !a.isDestroyed))
  f.context.controls.heroUnit.i = 450
  f.tick()
  const stoppedAt = group.progress
  f.tick(10000)
  assert.equal(group.progress, stoppedAt)
})

test('each bandit camp gets one additional persistent night patrol without another route search', () => {
  const f = fixture()
  const group = f.groups[0]
  Object.assign(group, { kind: 'bandits', campId: 'camp', campGeneration: 0 })
  f.owner.type = 'Bandits'
  f.context.map.roads = { cells: [[0, 2]] }
  const { buildTrafficRoutes } = loadTsModule('app/services/travel/ambient/AmbientTrafficRoutes.ts', {
    mocks: {
      '../../world/distantVillages/DeferredVillageStore': { deferredVillageBuildings: () => undefined },
      '../../../lib/camps/campRespawnState': { campRespawnStates: () => [] },
      '../../../lib/mapSpaces': { getEntitySpaceId: () => 'outside' },
      '../RoadRoute': {
        planRoadRoute() {
          throw new Error('unexpected route search')
        },
      },
    },
  })
  for (const _ of buildTrafficRoutes(f.context, f.groups)) void _
  assert.equal(f.groups.length, 2)
  assert.equal(f.groups[1].id, 'g0:night')
  assert.equal(f.groups[1].route, group.route)
  assert.notEqual(f.groups[1].members[0].label, group.members[0].label)
  for (const _ of buildTrafficRoutes(f.context, f.groups)) void _
  assert.equal(f.groups.length, 2, 'no duplicate night patrols')
  f.groups[1].retired = true
  for (const _ of buildTrafficRoutes(f.context, f.groups)) void _
  assert.equal(f.groups.length, 2, 'dead patrols are not replenished each night')
})
