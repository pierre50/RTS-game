const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const beds = count => Array.from({ length: count }, (_, i) => ({ type: 'CampBedroll', isBuilt: true, label: `bed-${i}` }))
const houses = count => beds(count).map((bed, i) => ({ type: 'House', label: `house-${i}`, isBuilt: true, interiorBuildings: [bed] }))
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
        ...houses(populationMax),
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
        ...houses(populationMax),
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
    buildings: [townCenter, ...houses(100)],
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
      ...houses(40),
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

test('only beds add capacity; occupied beds count and the town center remains the arrival point', () => {
  const { VillagerArrivalSystem } = loadVillagerArrivalSystem()
  let arrivals = 0
  const center = { type: 'TownCenter', isBuilt: true, placeUnit() { arrivals++; return true } }
  const house = { type: 'House', label: 'house', isBuilt: true, interiorBuildings: [] }
  const player = { type: 'Human', population: 2, buildings: [center, house], populationMax: 999 }
  const system = new VillagerArrivalSystem({ map: { random: () => 0.25 }, players: [player] })
  const update = () => system.handleDailyWorldEvent({ day: 2, previousDay: 1 })
  update()
  assert.equal(arrivals, 0)
  assert.equal(player.populationMax, 0, 'stale house capacity must be discarded')
  house.interiorBuildings = beds(3)
  player.units = [{ shelterState: { restTarget: house.interiorBuildings[0], status: 'outside' } }]
  update()
  assert.equal(arrivals, 1)
  assert.equal(player.populationMax, 3)
  house.buildingUpgrade = { targetLevel: 1 }
  update()
  assert.equal(arrivals, 1)
  assert.equal(player.population, 2, 'losing capacity never evicts inhabitants')
  delete house.buildingUpgrade
  player.buildings = [house]
  update()
  assert.equal(arrivals, 1, 'beds cannot replace the arrival point')
})


test('a daily arrival receives its own home; spare beds in occupied homes do not attract arrivals', () => {
  const { VillagerArrivalSystem } = loadVillagerArrivalSystem()
  const player = { label: 'player', type: 'Human', population: 1, units: [{ type: 'Villager', label: 'first' }], buildings: houses(2) }
  player.buildings[0].interiorBuildings.push({ type: 'CampBedroll', label: 'spare-bed', isBuilt: true })
  player.buildings.push({ type: 'TownCenter', isBuilt: true, placeUnit(type, extra) {
    player.units.push({ type, ...extra, label: `arrival-${player.units.length}` })
    player.population++
    return true
  } })
  const system = new VillagerArrivalSystem({ map: { random: () => 0.25 }, players: [player] })
  system.handleDailyWorldEvent({ day: 2, previousDay: 1 })
  assert.equal(player.units.length, 2)
  assert.equal(player.units[0].homeHouseLabel, 'house-0')
  assert.equal(player.units[1].homeHouseLabel, 'house-1')
  assert.equal(player.units[1].homeBedLabel, 'bed-1')
  system.handleDailyWorldEvent({ day: 3, previousDay: 2 })
  assert.equal(player.units.length, 2)
  assert.equal(player.populationMax, 3)
})
