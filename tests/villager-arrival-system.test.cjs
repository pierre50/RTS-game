const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadVillagerArrivalSystem() {
  const filename = path.join(__dirname, '../app/services/world/VillagerArrivalSystem.ts')
  return requireFromTsFile(filename, filename, {
    '../../constants': {
      BUILDING_TYPES: { townCenter: 'TownCenter' },
      DAILY_CONSUMPTION_PER_VILLAGER: { food: 4 },
      PLAYER_TYPES: { human: 'Human', ai: 'AI' },
      UNIT_TYPES: { villager: 'Villager' },
      VILLAGER_ARRIVAL_CONFIG: {
        growthRate: 0.12,
        currentPopulationReserveDays: 3,
        newVillagerReserveDays: 5,
        maxArrivalsPerDay: 5,
      },
    },
    '../../lib/lang': {
      t: (key, vars) => (vars?.count == null ? key : `${key}:${vars.count}`),
    },
    '../../lib/resources/playerResourceTotals': {
      getPlayerResourceTotals: player => ({ food: player.foodAvailable ?? 0 }),
    },
  })
}

test('villager arrival growth is capped by population demand, housing and daily cap', () => {
  const { VillagerArrivalSystem } = loadVillagerArrivalSystem()
  const run = ({ foodAvailable, population, populationMax }) => {
    let arrivals = 0
    const player = {
      type: 'Human',
      foodAvailable,
      population,
      populationMax,
      buildings: [
        {
          type: 'TownCenter',
          isBuilt: true,
          placeUnit() {
            arrivals++
            return true
          },
        },
      ],
    }
    new VillagerArrivalSystem({
      map: { random: () => 0.25 },
      players: [player],
    }).handleDailyWorldEvent({ day: 2, previousDay: 1 })
    return arrivals
  }

  assert.equal(run({ foodAvailable: 5000, population: 40, populationMax: 100 }), 4)
  assert.equal(run({ foodAvailable: 5000, population: 80, populationMax: 100 }), 5)
  assert.equal(run({ foodAvailable: 5000, population: 40, populationMax: 42 }), 2)
  assert.equal(run({ foodAvailable: 500, population: 40, populationMax: 100 }), 4)
})

test('villager arrival requires free housing but no food reserve', () => {
  const { VillagerArrivalSystem } = loadVillagerArrivalSystem()
  const run = ({ foodAvailable, population, populationMax }) => {
    let arrivals = 0
    const player = {
      type: 'Human',
      foodAvailable,
      population,
      populationMax,
      buildings: [
        {
          type: 'TownCenter',
          isBuilt: true,
          placeUnit() {
            arrivals++
            return true
          },
        },
      ],
    }
    new VillagerArrivalSystem({
      map: { random: () => 0.25 },
      players: [player],
    }).handleDailyWorldEvent({ day: 2, previousDay: 1 })
    return arrivals
  }

  assert.equal(run({ foodAvailable: 0, population: 6, populationMax: 20 }), 1)
  assert.equal(run({ foodAvailable: 92, population: 6, populationMax: 20 }), 1)
  assert.equal(run({ foodAvailable: 0, population: 6, populationMax: 6 }), 0)
  assert.equal(run({ foodAvailable: 0, population: 0, populationMax: 20 }), 0)
})

test('daily villager arrival places villagers for a played village and reports the result', () => {
  const { VillagerArrivalSystem } = loadVillagerArrivalSystem()
  const calls = []
  const reportEntries = []
  const townCenter = {
    type: 'TownCenter',
    isBuilt: true,
    placeUnit(type, extra, options) {
      calls.push(['placeUnit', type, extra.gender, options.consumePopulationSlot])
      player.population++
      return true
    },
  }
  const player = {
    type: 'Human',
    isPlayed: true,
    foodAvailable: 5000,
    population: 40,
    populationMax: 100,
    buildings: [townCenter],
  }
  const messages = []
  const context = {
    map: { random: () => 0.25 },
    menu: {
      showMessage: (...args) => messages.push(args),
      updateTopbar: () => calls.push(['updateTopbar']),
    },
    players: [player],
  }

  new VillagerArrivalSystem(context).handleDailyWorldEvent({
    day: 2,
    previousDay: 1,
    report: { add: entry => reportEntries.push(entry) },
  })

  assert.equal(calls.filter(call => call[0] === 'placeUnit').length, 4)
  assert.deepEqual(messages, [])
  assert.ok(calls.some(call => call[0] === 'updateTopbar'))
  assert.deepEqual(
    reportEntries.map(entry => [entry.type, entry.count, entry.player]),
    [['villager-arrival', 4, player]]
  )
})

test('daily villager arrival uses the same growth rules for AI without showing player alert', () => {
  const { VillagerArrivalSystem } = loadVillagerArrivalSystem()
  let arrivals = 0
  const player = {
    type: 'AI',
    isPlayed: false,
    foodAvailable: 0,
    population: 20,
    populationMax: 40,
    buildings: [
      {
        type: 'TownCenter',
        isBuilt: true,
        placeUnit() {
          arrivals++
          player.population++
          return true
        },
      },
    ],
  }
  const messages = []
  const context = {
    map: { random: () => 0.75 },
    menu: {
      showMessage: (...args) => messages.push(args),
      updateTopbar: () => messages.push(['topbar']),
    },
    players: [player],
  }

  new VillagerArrivalSystem(context).handleDailyWorldEvent({ day: 2, previousDay: 1 })

  assert.equal(arrivals, 2)
  assert.deepEqual(messages, [])
})

test('houses supply housing while the town center remains the arrival point', () => {
  const { loadTsModule } = require('./helpers/loadTsModule.cjs')
  const { getBuildingShelterCapacity } = loadTsModule('app/lib/buildings/buildingOccupancy.ts')
  const { VillagerArrivalSystem } = loadVillagerArrivalSystem()
  let arrivals = 0
  const center = { type: 'TownCenter', isBuilt: true,
    placeUnit() { arrivals++; return true } }
  const house = { type: 'House', isBuilt: true, placeUnit() { throw new Error('House must not spawn arrivals') } }
  const player = { type: 'Human', population: 2, buildings: [center], populationMax: 0 }
  const system = new VillagerArrivalSystem({ map: { random: () => 0.25 }, players: [player] })
  const update = () => {
    player.populationMax = player.buildings.reduce((sum, building) => sum + getBuildingShelterCapacity(building), 0)
    system.handleDailyWorldEvent({ day: 2, previousDay: 1 })
  }
  update()
  assert.equal(arrivals, 0)
  player.buildings.push(house)
  update()
  assert.equal(arrivals, 1)
  player.buildings = [house]
  update()
  assert.equal(arrivals, 1)
})
