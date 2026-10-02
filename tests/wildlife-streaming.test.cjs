const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const cache = new Map()
const { setDistantOwner } = loadTsModule('app/lib/units/villageActivity.ts', { moduleCache: cache })
const { setUnitSuspension } = loadTsModule('app/lib/units/unitSuspension.ts', { moduleCache: cache })
const wildlife = loadTsModule('app/services/wildlife/WildlifeStore.ts', { moduleCache: cache })
const serialize = animal =>
  Object.fromEntries(
    Object.entries(animal).filter(
      ([key, value]) =>
        !['owner', 'context', 'parent', 'currentCell', 'destroyedDisplay'].includes(key) && typeof value !== 'function'
    )
  )
const { WildlifeSystem } = loadTsModule('app/services/wildlife/WildlifeSystem.ts', {
  moduleCache: cache,
  mocks: {
    '../constants': {
      CORPSE_TIME: 20,
      FAMILY_TYPES: { building: 'building', animal: 'animal', unit: 'unit' },
      SHEET_TYPES: { standing: 'standingSheet', corpse: 'corpseSheet' },
    },
    '../lib': { isometricToCartesian: (x, y) => [x / 32, y / 32] },
    '../../lib/maths': { cartesianToIsometric: (i, j) => [i * 32, j * 32] },
    '../serialization/SaveSerializer': { serializeWildAnimal: animal => structuredClone(serialize(animal)) },
  },
})
function fixture(states, scheduler) {
  const cells = new Map(),
    callbacks = new Map()
  let lookups = 0,
    task = 0
  const cellAt = (i, j) => {
    const key = `${i}:${j}`
    if (!cells.has(key))
      cells.set(key, { i, j, type: 'Grass', category: 'Land', corpses: new Set(), has: null, solid: false })
    return cells.get(key)
  }
  const grid = new Proxy(
    {},
    {
      get: (_, i) =>
        new Proxy(
          {},
          {
            get: (_, j) => {
              lookups++
              return cellAt(Number(i), Number(j))
            },
          }
        ),
    }
  )
  const hero = { i: 10, j: 10 }
  const context = {
    map: { grid, seed: 1, removeFromInstanceBucket() {} },
    players: [],
    controls: {
      heroUnit: hero,
      getViewportMetrics: () => ({
        visibleLeft: hero.i * 32 - 32,
        visibleTop: hero.j * 32 - 32,
        visibleWidth: 64,
        visibleHeight: 64,
      }),
    },
    scheduler: scheduler ?? {
      elapsedMs: 0,
      add(fn) {
        callbacks.set(++task, fn)
        return task
      },
      remove(id) {
        callbacks.delete(id)
      },
    },
    dayNight: { state: { day: 1 }, getElapsedMs: () => context.scheduler.elapsedMs },
  }
  context.map.gaia = {
    animals: [],
    population: 0,
    createAnimal(state) {
      const animal = {
        hitPoints: 10,
        quantity: 5,
        currentSheet: 'standingSheet',
        ...structuredClone(state),
        owner: this,
        stopInterval() {},
        stopTimeout() {},
        destroy() {
          this.destroyedDisplay = true
        },
      }
      this.animals.push(animal)
      this.population++
      const cell = cellAt(state.i, state.j)
      cell.has = animal
      cell.solid = true
      return animal
    },
  }
  const store = wildlife.installWildlifeStore(context.map, states, 'test')
  const system = new WildlifeSystem(context)
  return { context, hero, store, system, cellAt, callbacks, lookups: () => lookups }
}
test('100,000 distant records create no runtime objects or world-wide cell scans', () => {
  const f = fixture(Array.from({ length: 100000 }, (_, i) => ({ type: 'Deer', i: 1000 + i, j: 1000 })))
  assert.equal(f.context.map.gaia.animals.length, 0)
  assert.equal(f.lookups(), 0)
  f.system.destroy()
  assert.equal(f.callbacks.size, 0)
})

test('fast-forward reconciles wildlife once per frame while simulation and corpse clocks catch up', () => {
  const { ActionScheduler } = loadTsModule('app/lib/actionScheduler.ts')
  let paused = false
  const scheduler = new ActionScheduler({ ticker: { add() {}, remove() {} } }, () => paused)
  const f = fixture([], scheduler)
  f.store.put({
    label: 'dead',
    type: 'Deer',
    i: 200,
    j: 200,
    isDead: true,
    quantity: 10,
    wildlife: { homeI: 200, homeJ: 200, generation: 0, renewDay: 4, lastCorpseMs: 0 },
  })
  let updates = 0
  const update = f.system.update.bind(f.system)
  f.system.update = () => {
    updates++
    update()
  }
  const calls = { movement: 0, combat: 0, production: 0 }
  for (const name of Object.keys(calls)) scheduler.add(() => calls[name]++, 40, name)
  // 100 ms of wall time at speed 8; only observation work is coalesced.
  scheduler._tick(800)
  assert.equal(updates, 1)
  assert.deepEqual(calls, { movement: 20, combat: 20, production: 20 })
  scheduler._tick(200)
  assert.equal(updates, 2)
  for (let i = 0; i < 5; i++) scheduler._tick(800)
  assert.equal(scheduler.elapsedMs, 5000)
  assert.equal(updates, 7)
  assert.equal(f.store.entries.get('dead').state.quantity, 10)
  assert.equal(f.store.entries.get('dead').state.corpseMaterialDecayRemainingMs, 15000)
  paused = true
  scheduler._tick(800)
  assert.equal(updates, 7)
  assert.equal(scheduler.elapsedMs, 5000)
  f.system.destroy()
  paused = false
  scheduler._tick(800)
  assert.equal(updates, 7)
})
test('sleep and wake preserve identity and wounds; active interactions remain resident', () => {
  const f = fixture([{ label: 'deer', type: 'Deer', i: 12, j: 12 }])
  const animal = f.context.map.gaia.animals[0]
  animal.hitPoints = 3
  animal.action = 'attack'
  f.hero.i = 500
  f.hero.j = 500
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 1)
  animal.action = null
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 0)
  assert.equal(f.cellAt(12, 12).has, null)
  assert.equal(f.store.entries.get('deer').state.hitPoints, 3)
  f.hero.i = 10
  f.hero.j = 10
  f.system.update()
  assert.equal(f.context.map.gaia.animals[0].label, 'deer')
  assert.equal(f.context.map.gaia.animals[0].hitPoints, 3)
})
test('workers do not wake wildlife; camera activation is bounded per update', () => {
  const f = fixture(
    Array.from({ length: 40 }, (_, i) => ({ type: 'Deer', i: 200 + (i % 8), j: 200 + Math.floor(i / 8) }))
  )
  f.context.players = [{ units: [{ i: 200, j: 200 }], buildings: [] }]
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 0)
  Object.assign(f.hero, { i: 200, j: 200 })
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 16)
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 32)
})
test('corpse loot stays intact asleep until expiration, replacements are delayed, distinct and never duplicated by reload', () => {
  const f = fixture([
    {
      label: 'dead-deer',
      type: 'Deer',
      i: 200,
      j: 200,
      isDead: true,
      quantity: 2,
      inventory: { resources: { meat: 2, leather: 1 } },
      currentSheet: 'corpseSheet',
      wildlife: { homeI: 200, homeJ: 200, generation: 0, renewDay: 4, lastCorpseMs: 0 },
    },
  ])
  f.context.scheduler.elapsedMs = 10000
  f.system.update()
  assert.equal(f.store.entries.get('dead-deer').state.quantity, 2)
  assert.deepEqual(f.store.entries.get('dead-deer').state.inventory.resources, { meat: 2, leather: 1 })
  assert.equal(f.store.entries.get('dead-deer').state.isDestroyed, undefined)
  f.context.scheduler.elapsedMs = 19999
  f.system.update()
  assert.equal(f.store.entries.get('dead-deer').state.isDestroyed, undefined)
  assert.equal(f.store.entries.get('dead-deer').state.quantity, 2)
  f.context.scheduler.elapsedMs = 20000
  f.system.update()
  f.system.update()
  assert.equal(f.store.entries.get('dead-deer').state.isDestroyed, true)
  f.context.dayNight.state.day = 4
  f.system.handleDailyWorldEvent({ day: 4, previousDay: 3 })
  f.system.update()
  f.system.update()
  assert.equal(f.store.entries.has('dead-deer'), false)
  assert.equal(f.store.entries.size, 1)
  const saved = structuredClone([...f.store.entries.values()].map(e => e.state))
  const reloaded = fixture(saved)
  reloaded.context.dayNight.state.day = 100
  reloaded.system.update()
  assert.equal(reloaded.store.entries.size, 1)
  assert.equal([...reloaded.store.entries.values()][0].state.label, saved[0].label)
  assert.deepEqual([...reloaded.store.entries.values()][0].state.wildlife, saved[0].wildlife)
})
test('occupied habitat renewal is deferred and pets do not contribute replacement slots', () => {
  const f = fixture([
    {
      type: 'Deer',
      label: 'gone',
      i: 100,
      j: 100,
      isDead: true,
      isDestroyed: true,
      wildlife: { homeI: 100, homeJ: 100, generation: 0, renewDay: 1 },
    },
  ])
  // Start a separate retry with the habitat occupied.
  const state = {
    type: 'Deer',
    label: 'blocked',
    i: 300,
    j: 300,
    isDead: true,
    isDestroyed: true,
    wildlife: { homeI: 300, homeJ: 300, generation: 0, renewDay: 1 },
  }
  for (let i = 292; i <= 308; i++) for (let j = 292; j <= 308; j++) f.cellAt(i, j).has = { family: 'building' }
  f.store.put(state)
  f.system.update()
  f.system.update()
  assert.equal(f.store.entries.get('blocked').state.isDestroyed, true)
  assert.equal(wildlife.isWildlife({ type: 'Horse', tamingStatus: 'tamed' }), false)
})

test('explicit outside space participates in wildlife streaming', () => {
  assert.equal(wildlife.isWildlife({ type: 'Deer', spaceId: 'outside' }), true)
  assert.equal(wildlife.isWildlife({ type: 'Deer', spaceId: 'cave' }), false)
  const f = fixture([{ label: 'deer-outside', type: 'Deer', i: 200, j: 200, spaceId: 'outside' }])
  Object.assign(f.hero, { i: 200, j: 200 })
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 1)
})

test('a displaced survivor sleeps on the spot and resumes only near the camera', () => {
  const f = fixture([{ label: 'deer', type: 'Deer', i: 12, j: 12 }])
  const animal = f.context.map.gaia.animals[0]
  animal.i = 70
  Object.assign(f.hero, { i: 500, j: 500 })
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 0)
  const state = f.store.entries.get('deer').state
  assert.equal(state.i, 70)
  assert.equal(state.wildlife.homeI, 12)
  assert.equal(f.store.pending.size, 0)
  const reloaded = fixture([state])
  assert.equal(reloaded.context.map.gaia.animals.length, 0)
  Object.assign(reloaded.hero, { i: 70, j: 12 })
  reloaded.system.update()
  assert.equal(reloaded.context.map.gaia.animals[0].i, 70)
  assert.equal(reloaded.context.map.gaia.animals[0].wildlife.homeI, 12)
})

test('blocked renewal retries on the next daily event, including across a save reload', () => {
  const f = fixture([])
  const state = {
    label: 'due',
    type: 'Deer',
    i: 200,
    j: 200,
    isDead: true,
    isDestroyed: true,
    wildlife: { homeI: 200, homeJ: 200, generation: 0, renewDay: 1 },
  }
  f.store.put(state)
  f.hero.i = 200
  f.hero.j = 200
  f.hero.sight = 30
  f.system.update()
  f.system.update()
  assert.equal(f.store.entries.get('due').state.wildlife.lastRenewAttemptDay, 1)
  const reloaded = fixture(structuredClone([...f.store.entries.values()].map(e => e.state)))
  assert.equal(reloaded.store.entries.has('due'), true)
  reloaded.system.handleDailyWorldEvent({ day: 2, previousDay: 1 })
  reloaded.system.update()
  reloaded.system.update()
  assert.equal(reloaded.store.entries.has('due'), false)
  assert.equal(reloaded.store.entries.size, 1)
})

test('streaming proximity alone does not suppress renewal near village hunting grounds', () => {
  const f = fixture([])
  f.context.players = [{ units: [], buildings: [{ i: 220, j: 200, sight: 6 }] }]
  f.store.put({
    label: 'village-deer',
    type: 'Deer',
    i: 200,
    j: 200,
    isDead: true,
    isDestroyed: true,
    wildlife: { homeI: 200, homeJ: 200, generation: 0, renewDay: 1 },
  })
  f.system.update()
  f.system.update()
  assert.equal(f.store.entries.has('village-deer'), false)
  assert.equal(f.store.entries.size, 1)
})

test('population slots sharing a home keep distinct replacement identities', () => {
  const f = fixture(
    ['a', 'b'].map(label => ({
      label,
      type: 'Deer',
      i: 200,
      j: 200,
      isDead: true,
      isDestroyed: true,
      wildlife: { homeI: 200, homeJ: 200, generation: 0, renewDay: 1 },
    }))
  )
  assert.equal(f.store.entries.size, 2)
  assert.equal(
    [...f.store.entries.values()].every(e => e.state.wildlife.generation === 1),
    true
  )
})

function distantFixture() {
  const f = fixture([{ label: 'remote-deer', type: 'Deer', i: 200, j: 200 }])
  const owner = { units: [], buildings: [{ i: 210, j: 200, sight: 6 }] }
  const worker = { i: 200, j: 200, owner }
  owner.units.push(worker)
  f.context.players = [owner]
  Object.assign(f.hero, { i: 200, j: 200 })
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 1)
  Object.assign(f.hero, { i: 10, j: 10 })
  setDistantOwner(owner, () => {})
  setUnitSuspension(worker, { reason: 'distant-work', wake() {} })
  return { ...f, owner, worker }
}

test('resuming detailed village work does not wake offscreen fauna', () => {
  const f = distantFixture()
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 0)
  assert.equal(f.store.entries.size, 1)
  setDistantOwner(f.owner)
  setUnitSuspension(f.worker)
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 0)
})

test('workers, buildings, player ownership and an offscreen hero never activate wildlife', () => {
  for (const reason of ['worker', 'building', 'hero', 'player']) {
    const f = distantFixture()
    f.context.controls.getViewportMetrics = () => ({
      visibleLeft: 0,
      visibleTop: 0,
      visibleWidth: 64,
      visibleHeight: 64,
    })
    if (reason === 'worker') setUnitSuspension(f.worker)
    if (reason === 'building') setDistantOwner(f.owner)
    if (reason === 'hero') Object.assign(f.hero, { i: 200, j: 200 })
    if (reason === 'player') f.owner.isPlayed = true
    f.system.update()
    assert.equal(f.context.map.gaia.animals.length, 0, reason)
  }
})

test('camera uses the AI margin and a wider exit margin without boundary churn', () => {
  const f = fixture([{ label: 'edge', type: 'Deer', i: 20, j: 10 }])
  assert.equal(f.context.map.gaia.animals.length, 0)
  f.hero.i = 11 // 256 pixels beyond the right viewport edge
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 1)
  f.hero.i = 8 // still within the 384 pixel exit margin
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 1)
  f.hero.i = 6
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 0)
})

test('interior cameras do not activate outdoor wildlife', () => {
  const f = fixture([{ label: 'deer', type: 'Deer', i: 12, j: 12 }])
  f.context.map.activeSpaceId = 'cave'
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 0)
})

test('distant status never removes hunted, fighting, fleeing or selected animals', () => {
  for (const reason of ['target', 'previousTarget', 'attack', 'flee', 'selected']) {
    const f = distantFixture()
    const animal = f.context.map.gaia.animals[0]
    if (reason === 'target') f.worker.dest = animal
    if (reason === 'previousTarget') f.worker.previousDest = animal
    if (reason === 'attack') animal.action = 'attack'
    if (reason === 'flee') animal.isFleeing = true
    if (reason === 'selected') animal.selected = true
    f.system.update()
    assert.equal(f.context.map.gaia.animals[0], animal, reason)
  }
})

test('ending a hunt releases its offscreen target; dead hunters do not pin fauna', () => {
  for (const end of ['cleared', 'dead', 'destroyed']) {
    const f = distantFixture()
    const animal = f.context.map.gaia.animals[0]
    f.worker.dest = animal
    f.system.update()
    assert.equal(f.context.map.gaia.animals[0], animal)
    if (end === 'cleared') f.worker.dest = null
    if (end === 'dead') f.worker.isDead = true
    if (end === 'destroyed') f.worker.isDestroyed = true
    f.system.update()
    assert.equal(f.context.map.gaia.animals.length, 0, end)
  }
})

test('idle airborne wildlife also sleeps outside the camera', () => {
  const f = distantFixture()
  f.context.map.gaia.animals[0].altitude = 4
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 0)
})

test('dormant village sight still prevents replacements spawning in sight', () => {
  const f = distantFixture()
  f.system.update()
  f.owner.buildings[0].sight = 40
  f.store.remove('remote-deer')
  f.store.put({
    label: 'dead',
    type: 'Deer',
    i: 200,
    j: 200,
    isDead: true,
    isDestroyed: true,
    wildlife: { homeI: 200, homeJ: 200, generation: 0, renewDay: 1 },
  })
  f.system.update()
  assert.equal(f.store.entries.has('dead'), true)
  assert.equal(f.store.entries.size, 1)
})

test('wildlife activity reports dormant anchors and why remaining animals are active', () => {
  const f = distantFixture()
  const events = []
  f.context.performance = { markEvent: (name, details) => events.push({ name, details }) }
  f.context.scheduler.elapsedMs = 5000
  f.system.update()
  const event = events.find(event => event.name === 'wildlife.activity')
  assert.equal(event.details.active, 0)
  assert.equal(event.details.records, 1)
  assert.equal(event.details.dormantAnchors, 3)
  f.hero.i = 200
  f.hero.j = 200
  f.system.update()
  f.context.scheduler.elapsedMs = 10000
  f.system.update()
  assert.equal(events.at(-1).details.camera, 1)
})
