const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup() {
  const moduleCache = new Map()
  const spawned = []
  let blocked = false
  const options = {
    moduleCache,
    mocks: {
      '../../classes/map/BanditCampGeneration': {
        respawnBanditCamp(_map, context, camp) {
          if (blocked) return false
          spawned.push(camp.id)
          camp.generation++
          for (const type of camp.unitTypes)
            context.players[0].units.push({ type, hitPoints: 10, campPatrolAnchor: { i: camp.i, j: camp.j } })
          return true
        },
      },
    },
  }
  const state = loadTsModule('app/lib/camps/campRespawnState.ts', options)
  const { CampRespawnSystem } = loadTsModule('app/services/patrol/CampRespawnSystem.ts', options)
  const { DAY_NIGHT_CONFIG } = loadTsModule('app/config/gameplay.ts')
  const context = { map: {}, players: [{ type: 'Bandits', units: [] }], dayNight: { getElapsedMs: () => now } }
  let now = 1000
  const camps = [1, 2].map(i => ({
    id: `camp:${i}:1`,
    i,
    j: 1,
    unitTypes: ['BanditChief', 'BanditSword'],
    generation: 0,
  }))
  state.restoreCampRespawnStates(context.map, camps)
  return {
    context,
    state,
    system: new CampRespawnSystem(context),
    spawned,
    day: DAY_NIGHT_CONFIG.dayLengthMs,
    setTime: value => {
      now = value
    },
    block: value => {
      blocked = value
    },
  }
}

test('cleared camps return after three full game days with no extra sites or reinforcements', () => {
  const f = setup()
  f.context.players[0].units.push({
    hitPoints: 10,
    combatMode: 'flee',
    campPatrolAnchor: { i: 2, j: 1 },
    spaceId: 'interior:lair',
  })
  f.system.update()
  f.setTime(1000 + f.day * 3 - 1)
  f.system.update()
  assert.deepEqual(f.spawned, [])
  f.setTime(1000 + f.day * 3)
  f.system.update()
  assert.deepEqual(f.spawned, ['camp:1:1'])
  assert.equal(f.context.players[0].units.length, 3)
  f.setTime(f.day * 30)
  f.system.update()
  assert.deepEqual(f.spawned, ['camp:1:1'])
  f.context.players[0].units = []
  f.system.update()
  f.setTime(f.day * 33)
  f.system.update()
  assert.deepEqual(f.spawned, ['camp:1:1', 'camp:1:1', 'camp:2:1'])
  assert.equal(f.context.players[0].units.length, 4)
})

test('save and load retain the cooldown and initial cap without aliasing the saved snapshot', () => {
  const f = setup()
  f.system.update()
  const saved = f.state.serializeCampRespawnStates(f.context.map)
  const restored = setup()
  restored.state.restoreCampRespawnStates(restored.context.map, JSON.parse(JSON.stringify(saved)))
  restored.setTime(1000 + restored.day * 2)
  restored.system.update()
  assert.deepEqual(restored.spawned, [])
  restored.setTime(1000 + restored.day * 3)
  restored.system.update()
  assert.equal(restored.spawned.length, 2)
  assert.equal(saved[0].generation, 0)
  assert.equal(saved[0].clearedAtMs, 1000)
})

test('blocked sites retry without consuming the cooldown; pauses and editor mode do not spawn', () => {
  const f = setup()
  f.system.update()
  f.block(true)
  f.setTime(1000 + f.day * 3)
  f.system.update()
  assert.equal(f.spawned.length, 0)
  f.block(false)
  f.context.paused = true
  f.system.update()
  f.context.paused = false
  f.context.editor = true
  f.system.update()
  assert.equal(f.spawned.length, 0)
  f.context.editor = false
  f.system.update()
  assert.equal(f.spawned.length, 2)
})

test('save validation rejects invalid cooldowns, duplicate sites and oversized rosters', () => {
  const { validateRuntimeState } = loadTsModule('app/serialization/SaveRuntimeValidation.ts', {
    mocks: { './SaveEntityValidators': { validateWorldPursuers() {} } },
  })
  const camp = { id: 'camp:1:1', i: 1, j: 1, unitTypes: ['BanditSword'], generation: 0, clearedAtMs: 1000 }
  assert.doesNotThrow(() => validateRuntimeState({ banditCamps: [camp] }, 999, {}))
  for (const entries of [
    [{ ...camp, clearedAtMs: -1 }],
    [{ ...camp, generation: NaN }],
    [{ ...camp, unitTypes: Array(11).fill('BanditSword') }],
    [camp, { ...camp, id: 'other' }],
    [{ ...camp, i: 1000 }],
  ]) {
    assert.throws(() => validateRuntimeState({ banditCamps: entries }, 999, {}))
  }
})
