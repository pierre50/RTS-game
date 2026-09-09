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

function loadStableHorseInteraction(theftCalls = []) {
  return loadTsModule('app/lib/horses/stableHorseInteraction.ts', {
    mocks: {
      '../constants': { ...constants, HORSE_TAMING_STATUS: { tamed: 'tamed', wild: 'wild' } },
      '../theft/theft': {
        applyTheftConsequences: event => theftCalls.push(event),
        THEFT_SUBJECT_TYPES: { horse: 'horse' },
      },
    },
  })
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
  const { exchangeStableHorseAt } = loadHorseModules()
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

  assert.deepEqual(exchangeStableHorseAt(stable, 0, null), { horseColor: 'light', tamingStatus: 'tamed' })
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

test('stable horse theft applies only to stored horses in foreign stables', () => {
  const theftCalls = []
  const { isStoredForeignStableHorse, takeStableInteriorHorseForHero } = loadStableHorseInteraction(theftCalls)
  const heroOwner = { label: 'player' }
  const foreignOwner = { label: 'neutral-ai' }
  const hero = { owner: heroOwner, context: { map: null } }
  const ownStable = { owner: heroOwner, stableHorses: [{ horseColor: 'bay' }], type: 'Stable' }
  const foreignStable = { owner: foreignOwner, stableHorses: [{ horseColor: 'black' }], type: 'Stable' }
  const map = {
    gaia: { animals: [] },
    spaces: new Map([
      ['own-stable', { building: ownStable, id: 'own-stable', kind: 'interior' }],
      ['foreign-stable', { building: foreignStable, id: 'foreign-stable', kind: 'interior' }],
    ]),
  }
  hero.context.map = map
  const ownHorse = { label: 'own-stable:stable-horse:0', spaceId: 'own-stable', type: 'Horse' }
  const foreignHorse = { label: 'foreign-stable:stable-horse:0', spaceId: 'foreign-stable', type: 'Horse' }
  const outdoorHorse = { label: 'outdoor-horse', owner: foreignOwner, type: 'Horse' }
  map.gaia.animals.push(ownHorse, foreignHorse)

  assert.equal(isStoredForeignStableHorse(hero, ownHorse), false)
  assert.equal(isStoredForeignStableHorse(hero, foreignHorse), true)
  assert.equal(isStoredForeignStableHorse(hero, outdoorHorse), false)

  assert.deepEqual(takeStableInteriorHorseForHero(hero, ownHorse), {
    building: ownStable,
    horse: { horseColor: 'bay', tamingStatus: 'tamed' },
  })
  assert.equal(theftCalls.length, 0)

  assert.deepEqual(takeStableInteriorHorseForHero(hero, foreignHorse), {
    building: foreignStable,
    horse: { horseColor: 'black', tamingStatus: 'tamed' },
  })
  assert.equal(theftCalls.length, 1)
  assert.equal(theftCalls[0].owner, foreignOwner)
  assert.equal(theftCalls[0].subject, 'horse')
})
