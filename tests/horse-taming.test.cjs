const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const constants = {
  BUILDING_TYPES: { stable: 'Stable' },
}

function loadHorseModules() {
  const mocks = {
    '../constants': constants,
  }
  const taming = loadTsModule('app/lib/horses/horseTaming.ts', { mocks })
  const stable = loadTsModule('app/lib/horses/stableHorses.ts', { mocks })
  return { ...taming, ...stable }
}

test('horses default to wild outside a stable', () => {
  const { getHorseTamingStatus, isWildHorse } = loadHorseModules()
  const horse = { type: 'Horse' }

  assert.equal(getHorseTamingStatus(horse), 'wild')
  assert.equal(isWildHorse(horse), true)
})

test('legacy stable horses normalize to tamed', () => {
  const { getStableHorses, getStableHorseAmount } = loadHorseModules()
  const stable = {
    type: 'Stable',
    stableHorses: [{ horseColor: 'dark' }],
  }

  assert.deepEqual(getStableHorses(stable), [{ horseColor: 'dark', tamingStatus: 'tamed' }])
  assert.equal(getStableHorseAmount(stable), 1)
})

test('storing a captured horse marks the runtime horse and stable record as tamed', () => {
  const { storeStableHorse } = loadHorseModules()
  const stable = {
    type: 'Stable',
    stableHorses: [],
  }
  const horse = {
    type: 'Horse',
    horseColor: 'light',
    tamingStatus: 'wild',
  }

  assert.equal(storeStableHorse(stable, horse), true)
  assert.equal(horse.tamingStatus, 'tamed')
  assert.deepEqual(stable.stableHorses, [{ horseColor: 'light', tamingStatus: 'tamed' }])
})

test('stable horses can be consumed or exchanged by slot', () => {
  const { consumeStableHorseAt, exchangeStableHorseAt } = loadHorseModules()
  const stable = {
    horseAmount: 2,
    stableHorses: [{ horseColor: 'light' }, { horseColor: 'black' }],
    type: 'Stable',
  }

  assert.deepEqual(exchangeStableHorseAt(stable, 1, { horseColor: 'dark' }), {
    horseColor: 'black',
    tamingStatus: 'tamed',
  })
  assert.deepEqual(stable.stableHorses, [
    { horseColor: 'light', tamingStatus: 'tamed' },
    { horseColor: 'dark', tamingStatus: 'tamed' },
  ])
  assert.equal(stable.horseAmount, 2)

  assert.deepEqual(consumeStableHorseAt(stable, 0), { horseColor: 'light', tamingStatus: 'tamed' })
  assert.deepEqual(stable.stableHorses, [{ horseColor: 'dark', tamingStatus: 'tamed' }])
  assert.equal(stable.horseAmount, 1)
})

test('stable horse mutations request open interior synchronization', () => {
  const { consumeStableHorse, exchangeStableHorseAt, returnStableHorse, storeStableHorse } = loadHorseModules()
  const calls = []
  const stable = {
    context: { syncStableInteriorHorses: building => calls.push(building) },
    horseAmount: 1,
    stableHorses: [{ horseColor: 'light' }],
    type: 'Stable',
  }

  assert.equal(storeStableHorse(stable, { horseColor: 'dark', type: 'Horse' }), true)
  assert.deepEqual(calls, [stable])

  assert.deepEqual(exchangeStableHorseAt(stable, 0, { horseColor: 'brown' }), {
    horseColor: 'light',
    tamingStatus: 'tamed',
  })
  assert.deepEqual(calls, [stable, stable])

  assert.deepEqual(consumeStableHorse(stable), { horseColor: 'brown', tamingStatus: 'tamed' })
  assert.deepEqual(calls, [stable, stable, stable])

  returnStableHorse(stable, { horseColor: 'gold' })
  assert.deepEqual(calls, [stable, stable, stable, stable])
})
