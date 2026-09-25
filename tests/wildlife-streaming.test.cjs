const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const cache = new Map()
const wildlife = loadTsModule('app/services/WildlifeStore.ts', { moduleCache: cache })
const serialize = animal =>
  Object.fromEntries(
    Object.entries(animal).filter(
      ([key, value]) =>
        !['owner', 'context', 'parent', 'currentCell', 'destroyedDisplay'].includes(key) && typeof value !== 'function'
    )
  )
const { WildlifeSystem } = loadTsModule('app/services/WildlifeSystem.ts', {
  moduleCache: cache,
  mocks: {
    '../constants': {
      CORPSE_TIME: 20,
      FAMILY_TYPES: { building: 'building', animal: 'animal', unit: 'unit' },
      SHEET_TYPES: { standing: 'standingSheet', corpse: 'corpseSheet' },
    },
    '../lib': { isometricToCartesian: (x, y) => [x, y] },
    '../serialization/SaveSerializer': { serializeWildAnimal: animal => structuredClone(serialize(animal)) },
  },
})
function fixture(states) {
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
    controls: { heroUnit: hero },
    scheduler: {
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
test('workers wake wildlife without the hero; activation is bounded per update', () => {
  const f = fixture(
    Array.from({ length: 40 }, (_, i) => ({ type: 'Deer', i: 200 + (i % 8), j: 200 + Math.floor(i / 8) }))
  )
  f.context.players = [{ units: [{ i: 200, j: 200 }], buildings: [] }]
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 16)
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 32)
})
test('corpses decay asleep, replacements are delayed, distinct and never duplicated by reload', () => {
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
  assert.equal(f.store.entries.get('dead-deer').state.quantity, 0)
  assert.equal(f.store.entries.get('dead-deer').state.isDestroyed, undefined)
  f.context.scheduler.elapsedMs = 40000
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
  f.context.players = [{ units: [{ i: 200, j: 200, spaceId: 'outside' }], buildings: [] }]
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 1)
})

test('a displaced survivor stays simulated until home, without creating a replacement', () => {
  const f = fixture([{ label: 'deer', type: 'Deer', i: 12, j: 12 }])
  const animal = f.context.map.gaia.animals[0]
  animal.i = 70
  f.hero.i = 500
  f.hero.j = 500
  f.context.dayNight.state.day = 10
  f.system.handleDailyWorldEvent({ day: 10, previousDay: 9 })
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 1)
  assert.equal(f.store.pending.size, 0)
  assert.equal(f.store.entries.size, 1)
  assert.equal(animal.wildlife.homeI, 12)
  animal.i = 12
  f.system.update()
  assert.equal(f.context.map.gaia.animals.length, 0)
})

test('loading an offscreen displaced animal resumes it at its actual position', () => {
  const f = fixture([
    {
      label: 'lost',
      type: 'Deer',
      i: 250,
      j: 200,
      hitPoints: 3,
      wildlife: { homeI: 200, homeJ: 200, generation: 0, returnAfterMs: 10000 },
    },
  ])
  const animal = f.context.map.gaia.animals[0]
  assert.equal(animal.i, 250)
  assert.equal(animal.hitPoints, 3)
  assert.equal(animal.wildlife.returnAfterMs, 10000)
  assert.equal(f.store.pending.size, 0)
  animal.wildlife.homeI = 205
  assert.equal(f.store.entries.get('lost').state.wildlife.homeI, 205)
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
