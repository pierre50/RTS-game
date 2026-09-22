const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const gameplay = loadTsModule('app/config/gameplay.ts')
// These clock-boundary scenarios begin at 08:00 independently of the new-game start time.
const { simulateOfflineWorld } = loadTsModule('app/services/world/OfflineWorldSimulation.ts', {
  mocks: { '../../config/gameplay': { ...gameplay, DAY_NIGHT_CONFIG: { ...gameplay.DAY_NIGHT_CONFIG, startHour: 8 } } },
})

const HOUR = 60000
const DAY = 24 * HOUR
const villager = (extra = {}) => ({ type: 'Villager', label: 'worker', i: 10, j: 10, ...extra })
const node = (type, extra = {}) => ({ type, label: 'node', i: 10, j: 12, quantity: 100, totalQuantity: 100, ...extra })

function fixture() {
  const state = {
    camera: { x: 0, y: 0 },
    world: { mapType: 'world-region', size: 30 },
    runtime: { dayNightElapsedMs: 0, elapsedMs: 100 },
    resources: [],
    animals: [],
    players: [
      {
        type: 'Human',
        label: 'human',
        population: 1,
        populationMax: 1,
        units: [villager()],
        buildings: [
          { type: 'TownCenter', i: 6, j: 6, label: 'center', isBuilt: true, inventory: { resources: { wheat: 100 } } },
        ],
      },
    ],
  }
  const options = {
    fromElapsedMs: 0,
    toElapsedMs: DAY,
    terrain: Array.from({ length: 31 }, () => Array.from({ length: 31 }, () => ({ category: 'Grass' }))),
    unitConfig: () => ({ speed: 1.5, totalHitPoints: 18, gatherAmount: { woodcutter: 1, farmer: 1 } }),
    buildingConfig: () => ({ size: 2, constructionTime: 48, totalHitPoints: 96 }),
    buildingCapacity: (_index, type) => (type === 'House' ? 5 : 0),
    cycleMs: () => 1000,
    wheatMatureFrame: 5,
  }
  return { state, options, player: state.players[0] }
}

test('offline harvest preserves natural and planted wheat through repeated growth and harvest cycles', () => {
  for (const isNaturalResource of [true, false]) {
    const { state, options, player } = fixture()
    player.units[0].autonomousJob = 'food'
    const crop = node('Wheat', { quantity: 3, totalQuantity: 3, currentFrame: 5, isNaturalResource })
    state.resources = [crop]
    const first = simulateOfflineWorld(state, { ...options, toElapsedMs: HOUR })
    assert.equal(first.gathered.wheat, 3)
    assert.equal(state.resources[0], crop)
    assert.equal(crop.currentFrame, 0)
    assert.equal(crop.quantity, 3)
    assert.equal(state.naturalResourceRespawnSlots?.length ?? 0, 0)
    const workers = player.units
    player.units = []
    let from = HOUR
    for (let day = 1; day <= 5; day++) {
      const restored = structuredClone(state)
      const report = simulateOfflineWorld(restored, { ...options, fromElapsedMs: from, toElapsedMs: day * DAY })
      assert.equal(report.gathered.wheat ?? 0, 0)
      Object.assign(state, restored)
      assert.equal(state.resources[0].currentFrame, day)
      assert.deepEqual([state.resources[0].i, state.resources[0].j], [10, 12])
      from = day * DAY
    }
    state.players[0].units = workers
    const second = simulateOfflineWorld(state, { ...options, fromElapsedMs: 5 * DAY, toElapsedMs: 5 * DAY + HOUR })
    assert.equal(second.gathered.wheat, 3)
    assert.equal(state.resources[0].currentFrame, 0)
    assert.equal(state.resources.length, 1)
  }
})

test('legacy wheat respawn returns only to its original cell as a growing crop', () => {
  const { state, options, player } = fixture()
  player.units = []
  state.naturalResourceRespawnSlots = [node('Wheat', { isDestroyed: true, depletedDay: 1 })]
  simulateOfflineWorld(state, options)
  assert.equal(state.naturalResourceRespawnSlots.length, 0)
  assert.deepEqual([state.resources[0].i, state.resources[0].j], [10, 12])
  assert.equal(state.resources[0].currentFrame, 1)
  assert.equal(state.resources[0].quantity, 100)
})

test('zero, backwards and invalid absence leave the save untouched', () => {
  for (const duration of [0, -1, NaN]) {
    const { state, options } = fixture()
    const original = structuredClone(state)
    const report = simulateOfflineWorld(state, { ...options, toElapsedMs: duration })
    assert.deepEqual(state, original)
    assert.equal(report.elapsedMs, 0)
  }
})

test('upkeep crosses 06:00 exactly once, never midnight, and draws from real food stores', () => {
  const { state, options, player } = fixture()
  player.units[0].autonomousJob = 'wood'
  simulateOfflineWorld(state, { ...options, fromElapsedMs: 15 * HOUR, toElapsedMs: 16 * HOUR })
  assert.equal(player.food, 100)
  const report = simulateOfflineWorld(state, { ...options, fromElapsedMs: 21 * HOUR, toElapsedMs: 22 * HOUR })
  assert.equal(player.food, 96)
  assert.equal(player.buildings[0].inventory.resources.wheat, 96)
  assert.equal(report.foodConsumed, 4)
})

test('night shifts produce nothing and clear stale actions without erasing assignments', () => {
  const { state, options, player } = fixture()
  Object.assign(player.units[0], { autonomousJob: 'wood', action: 'chopwood', path: [{ i: 1, j: 1 }] })
  state.resources = [node('Tree', { hitPoints: 0 })]
  const report = simulateOfflineWorld(state, { ...options, fromElapsedMs: 16 * HOUR, toElapsedMs: 20 * HOUR })
  assert.deepEqual(report.gathered, {})
  assert.equal(state.resources[0].quantity, 100)
  assert.equal(player.units[0].autonomousJob, 'wood')
  assert.equal(player.units[0].action, null)
  assert.deepEqual(player.units[0].path, [])
})

test('harvest conserves quantities across competing workers and creates dated natural respawn slots', () => {
  const { state, options, player } = fixture()
  player.units = [villager({ autonomousJob: 'stone' }), villager({ label: 'second', i: 11, autonomousJob: 'stone' })]
  state.resources = [node('Stone', { quantity: 7, totalQuantity: 100, isNaturalResource: true })]
  const report = simulateOfflineWorld(state, { ...options, toElapsedMs: 2 * HOUR })
  assert.equal(report.gathered.stone, 7)
  assert.equal(player.stone, 7)
  assert.equal(state.resources.length, 0)
  assert.equal(state.naturalResourceRespawnSlots.length, 1)
  assert.equal(state.naturalResourceRespawnSlots[0].depletedDay, 1)
})

test('distance reduces production, disconnected resources cannot be harvested', () => {
  function harvest(j, isolate = false) {
    const { state, options, player } = fixture()
    player.units[0].autonomousJob = 'stone'
    state.resources = [node('Stone', { j, quantity: 10000 })]
    if (isolate) for (const row of options.terrain) row[15] = { category: 'Water' }
    return simulateOfflineWorld(state, { ...options, toElapsedMs: HOUR }).gathered.stone ?? 0
  }
  assert.ok(harvest(12) > harvest(25))
  assert.equal(harvest(25, true), 0)
})

test('without a depot workers keep harvested materials in their bounded bag', () => {
  const { state, options, player } = fixture()
  player.units[0].autonomousJob = 'wood'
  state.resources = [node('Tree', { hitPoints: 0 })]
  player.buildings = []
  const report = simulateOfflineWorld(state, { ...options, toElapsedMs: HOUR })
  const carried = player.units[0].inventory.resources.wood
  assert.ok(carried > 0 && carried <= 30)
  assert.equal(report.gathered.wood, carried)
  assert.equal(state.resources[0].quantity + carried, 100)
  assert.notDeepEqual(
    { i: player.units[0].i, j: player.units[0].j },
    { i: state.resources[0].i, j: state.resources[0].j }
  )
})

test('tree felling consumes work before wood can be gathered', () => {
  const { state, options, player } = fixture()
  player.units[0].autonomousJob = 'wood'
  state.resources = [node('Tree', { hitPoints: 1000 })]
  const report = simulateOfflineWorld(state, { ...options, toElapsedMs: HOUR })
  assert.deepEqual(report.gathered, {})
  assert.ok(state.resources[0].hitPoints < 1000)
  assert.equal(state.resources[0].quantity, 100)
})

test('construction follows saved queues and grants housing once per completion', () => {
  const { state, options, player } = fixture()
  const house = { type: 'House', label: 'house', i: 15, j: 15, hitPoints: 70, isBuilt: false }
  const second = { ...house, label: 'second-house', i: 22, j: 22 }
  player.buildings.push(house, second)
  Object.assign(player.units[0], { autonomousJob: 'construction', buildQueue: ['house', 'second-house'] })
  const report = simulateOfflineWorld(state, { ...options, toElapsedMs: 2 * HOUR })
  assert.equal(report.buildingsCompleted, 2)
  assert.equal(house.hitPoints, 96)
  assert.equal(second.isBuilt, true)
  assert.equal(player.populationMax, 11)
  const again = simulateOfflineWorld(state, { ...options, fromElapsedMs: 2 * HOUR, toElapsedMs: 3 * HOUR })
  assert.equal(again.buildingsCompleted, 0)
  assert.equal(player.populationMax, 11)
})

test('arrivals require food and housing; new villagers eat on subsequent days only', () => {
  const { state, options, player } = fixture()
  player.populationMax = 3
  const report = simulateOfflineWorld(state, { ...options, toElapsedMs: 2 * DAY })
  assert.equal(report.arrivals, 2)
  assert.equal(report.foodConsumed, 12)
  assert.equal(player.population, 3)
  assert.equal(new Set(player.units.map(unit => `${unit.i}:${unit.j}`)).size, 3)
  const starving = fixture()
  starving.player.populationMax = 10
  starving.player.buildings[0].inventory.resources.wheat = 2
  const hunger = simulateOfflineWorld(starving.state, starving.options)
  assert.equal(hunger.arrivals, 0)
  assert.equal(hunger.foodConsumed, 2)
  assert.equal(hunger.foodShortage, 2)
  assert.equal(starving.player.food, 0)
})

test('travelling followers do not consume food and stale hero inventories cannot fund growth', () => {
  const { state, options, player } = fixture()
  player.units.push(villager({ label: 'follower', followingHero: true }), {
    type: 'Hero',
    i: 1,
    j: 1,
    inventory: { resources: { wheat: 10000 } },
  })
  player.populationMax = 20
  player.buildings[0].inventory.resources.wheat = 4
  const report = simulateOfflineWorld(state, options)
  assert.equal(report.foodConsumed, 4)
  assert.equal(report.arrivals, 0)
  assert.equal(player.units.at(-1).inventory.resources.wheat, 10000)
})

test('regrowth respects due days, plant maturity and deterministic relocation', () => {
  const { state, options } = fixture()
  state.resources = [node('Wheat', { currentFrame: 0 }), node('Berrybush', { label: 'berries', i: 20, quantity: 10 })]
  state.naturalResourceRespawnSlots = [
    node('Stone', { quantity: 0, depletedDay: 1, i: 25 }),
    node('Berrybush', { label: 'relocating', quantity: 0, depletedDay: 1, i: 26 }),
  ]
  const copy = structuredClone(state)
  const report = simulateOfflineWorld(state, { ...options, toElapsedMs: 3 * DAY })
  simulateOfflineWorld(copy, { ...options, toElapsedMs: 3 * DAY })
  assert.deepEqual(state, copy)
  assert.equal(report.resourcesRespawned, 1)
  assert.equal(state.naturalResourceRespawnSlots[0].type, 'Stone')
  assert.equal(state.resources[0].currentFrame, 3)
  assert.equal(state.resources[1].quantity, 40)
  const relocated = state.resources.find(resource => resource.label === 'relocating')
  assert.notDeepEqual({ i: relocated.i, j: relocated.j }, { i: 26, j: 12 })
})

test('small absence preserves incomplete work for the next visit and stamps the processed clock', () => {
  const { state, options, player } = fixture()
  player.units[0].autonomousJob = 'stone'
  state.resources = [node('Stone')]
  const start = HOUR
  for (let index = 0; index < 100; index++)
    simulateOfflineWorld(state, {
      ...options,
      fromElapsedMs: start + index * 100,
      toElapsedMs: start + (index + 1) * 100,
    })
  assert.ok(player.stone > 0)
  assert.equal(state.runtime.dayNightElapsedMs, HOUR + 10000)
  assert.equal(state.runtime.elapsedMs, 100)
})

test('carried food is delivered once before sleeping without being counted as newly harvested', () => {
  const { state, options, player } = fixture()
  player.units[0].inventory = { resources: { wheat: 8 }, equipment: ['hammer'] }
  const report = simulateOfflineWorld(state, { ...options, fromElapsedMs: 14 * HOUR, toElapsedMs: 16 * HOUR })
  assert.equal(player.food, 108)
  assert.deepEqual(player.units[0].inventory.resources, {})
  assert.deepEqual(player.units[0].inventory.equipment, ['hammer'])
  assert.deepEqual(report.gathered, {})
})

test('food workers preserve exhausted berry bushes for daily regrowth and harvest mature wheat only', () => {
  const { state, options, player } = fixture()
  player.units[0].autonomousJob = 'food'
  state.resources = [node('Berrybush', { quantity: 1, totalQuantity: 10 }), node('Wheat', { i: 12, currentFrame: 0 })]
  simulateOfflineWorld(state, { ...options, toElapsedMs: 2 * HOUR })
  assert.equal(state.resources[0].quantity, 0)
  assert.equal(state.resources[1].quantity, 100)
  assert.equal(player.berry, 1)
  simulateOfflineWorld(state, { ...options, fromElapsedMs: 2 * HOUR, toElapsedMs: 22 * HOUR })
  assert.equal(state.resources[0].quantity, 1)
})

test('offline iron mining requires the Bronze Age and explored resources', () => {
  const { state, options, player } = fixture()
  player.units[0].autonomousJob = 'iron'
  state.resources = [node('Iron')]
  player.age = 0
  assert.deepEqual(simulateOfflineWorld(state, { ...options, toElapsedMs: HOUR }).gathered, {})
  player.age = 2
  assert.deepEqual(simulateOfflineWorld(state, { ...options, toElapsedMs: HOUR, isKnown: () => false }).gathered, {})
  assert.ok(simulateOfflineWorld(state, { ...options, toElapsedMs: HOUR }).gathered.iron > 0)
})

test('arrivals are skipped when all land cells are occupied or missing', () => {
  const { state, options, player } = fixture()
  player.populationMax = 100
  options.terrain = [[{ category: 'Water' }], [null]]
  const report = simulateOfflineWorld(state, options)
  assert.equal(report.arrivals, 0)
  assert.equal(player.units.length, 1)
})

function trainingBuilding(extra = {}) {
  return {
    type: 'Barracks',
    label: 'barracks',
    i: 20,
    j: 20,
    isBuilt: true,
    queue: ['Fantassin', 'Fantassin'],
    trainingQueue: [2, 4].map((day, index) => ({
      type: 'Fantassin',
      trainee: { type: 'Villager', label: `recruit-${index}`, i: 20, j: 19, name: `Recruit ${index}` },
      trainingStartedDay: 1,
      trainingCompleteDay: day,
      cost: { food: 35 },
      extra: { name: `Recruit ${index}`, gender: 'female', appearanceVariants: { hair: 'brown' } },
    })),
    ...extra,
  }
}

test('offline formations finish independently at dawn and retain reserved population without paying again', () => {
  const { state, options, player } = fixture()
  const barracks = trainingBuilding()
  player.buildings.push(barracks)
  player.population = 3
  const report = simulateOfflineWorld(state, { ...options, toElapsedMs: DAY })
  assert.equal(report.trainingsCompleted, 1)
  assert.equal(player.population, 3)
  assert.equal(player.food, 96)
  assert.equal(player.units[1].label, 'recruit-0')
  assert.equal(player.units[1].type, 'Fantassin')
  assert.equal(player.units[1].gender, 'female')
  assert.deepEqual(barracks.queue, ['Fantassin'])
  assert.equal(barracks.trainingQueue[0].trainee.label, 'recruit-1')
  const next = simulateOfflineWorld(state, { ...options, fromElapsedMs: DAY, toElapsedMs: 3 * DAY })
  assert.equal(next.trainingsCompleted, 1)
  assert.equal(player.units.length, 3)
  assert.equal(player.population, 3)
  assert.deepEqual(barracks.trainingQueue, [])
  assert.equal(barracks.loading, null)
  assert.equal(barracks.trainingCompleteDay, null)
  assert.equal(
    simulateOfflineWorld(state, { ...options, fromElapsedMs: 3 * DAY, toElapsedMs: 4 * DAY }).trainingsCompleted,
    0
  )
})

test('completed recruits with blocked exits stay saved and retry next day', () => {
  const { state, options, player } = fixture()
  const barracks = trainingBuilding()
  player.buildings.push(barracks)
  for (let i = 14; i <= 26; i++)
    for (let j = 14; j <= 26; j++) {
      if (i !== 20 || j !== 20) options.terrain[i][j] = { category: 'Water' }
    }
  assert.equal(simulateOfflineWorld(state, options).trainingsCompleted, 0)
  assert.equal(barracks.trainingQueue[0].loading, 100)
  assert.equal(barracks.trainingQueue.length, 2)
  options.terrain[20][21] = { category: 'Grass' }
  options.terrain[20][22] = { category: 'Grass' }
  assert.equal(
    simulateOfflineWorld(state, { ...options, fromElapsedMs: DAY, toElapsedMs: 2 * DAY }).trainingsCompleted,
    1
  )
})

test('mounting preserves the reserved horse and soldier stats through offline completion', () => {
  const { state, options, player } = fixture()
  const stable = trainingBuilding({ type: 'Stable', stableHorses: [], queue: ['Fantassin'] })
  stable.trainingQueue = [stable.trainingQueue[0]]
  stable.trainingQueue[0].trainee.type = 'Fantassin'
  stable.trainingQueue[0].extra = {
    mountedOnHorse: true,
    horseColor: 'black',
    hitPoints: 14,
    speed: 2.4,
    experience: { attack: 20 },
  }
  player.buildings.push(stable)
  simulateOfflineWorld(state, options)
  const soldier = player.units.find(unit => unit.label === 'recruit-0')
  assert.equal(soldier.mountedOnHorse, true)
  assert.equal(soldier.horseColor, 'black')
  assert.equal(soldier.hitPoints, 14)
  assert.equal(soldier.speed, 2.4)
  assert.deepEqual(soldier.experience, { attack: 20 })
  assert.deepEqual(stable.stableHorses, [])
})

test('incoming recruits preserve their orders and do not secretly harvest while awaiting entry', () => {
  const { state, options, player } = fixture()
  Object.assign(player.units[0], {
    trainingTargetType: 'Fantassin',
    action: 'train',
    dest: 'barracks',
    autonomousJob: 'stone',
  })
  state.resources = [node('Stone')]
  const report = simulateOfflineWorld(state, options)
  assert.deepEqual(report.gathered, {})
  assert.equal(player.units[0].dest, 'barracks')
  assert.equal(player.units[0].trainingTargetType, 'Fantassin')
})

test('markets use the existing three-day restock and civilization equipment rules', () => {
  const { state, options, player } = fixture()
  const market = { type: 'Market', label: 'market', i: 20, j: 20, isBuilt: true, marketStock: [] }
  const ruin = { ...market, label: 'ruin', i: 25, isDead: true, marketStock: [] }
  player.buildings.push(market, ruin)
  assert.equal(simulateOfflineWorld(state, options).marketsRestocked, 0)
  assert.deepEqual(market.marketStock, [])
  assert.equal(
    simulateOfflineWorld(state, { ...options, fromElapsedMs: DAY, toElapsedMs: 2 * DAY }).marketsRestocked,
    1
  )
  assert.ok(market.marketStock.length > 0)
  assert.deepEqual(ruin.marketStock, [])
  market.marketStock = []
  assert.equal(
    simulateOfflineWorld(state, { ...options, fromElapsedMs: 2 * DAY, toElapsedMs: 3 * DAY }).marketsRestocked,
    0
  )
  assert.deepEqual(market.marketStock, [])
})

test('traps fill only when unobserved, do not refill full traps and stay deterministic across visits', () => {
  const { state, options, player } = fixture()
  const trap = { type: 'Trap', label: 'trap', i: 25, j: 25, isBuilt: true }
  const watched = { ...trap, label: 'watched', i: 10, j: 11 }
  player.buildings.push(trap, watched)
  const copy = structuredClone(state)
  options.unitConfig = () => ({ sight: 4 })
  const report = simulateOfflineWorld(state, options)
  simulateOfflineWorld(copy, options)
  assert.equal(report.trapsFilled, 1)
  assert.deepEqual(state, copy)
  assert.ok(['Hare', 'Fox', 'BlackGrouse'].includes(trap.containedAnimalType))
  assert.equal(watched.containedAnimalType, undefined)
  assert.equal(simulateOfflineWorld(state, { ...options, fromElapsedMs: DAY, toElapsedMs: 2 * DAY }).trapsFilled, 0)
})

test('wildlife renews dead and depleted slots but not trapped prey or occupied cells', () => {
  const { state, options } = fixture()
  state.animals = [
    { type: 'Hare', label: 'corpse', i: 25, j: 25, isDead: true, hitPoints: 0, totalHitPoints: 8, totalQuantity: 12,
      inventory: { resources: { leather: 2 } }, corpseMaterialDecayRemainingMs: 15000 },
    { type: 'Hare', label: 'slot', i: 28, j: 28, isDead: true, isDestroyed: true },
    { type: 'Hare', label: 'trap-prey', i: 25, j: 26, isDead: true, trapPrey: true },
    { type: 'Hare', label: 'blocked', i: 6, j: 6, isDead: true, isDestroyed: true },
  ]
  options.animalConfig = () => ({ totalHitPoints: 8, totalQuantity: 12, ambientMovement: true })
  assert.equal(simulateOfflineWorld(state, options).animalsRevived, 2)
  assert.equal(state.animals[0].hitPoints, 8)
  assert.equal(state.animals[0].inventory, undefined)
  assert.equal(state.animals[0].corpseMaterialDecayRemainingMs, undefined)
  assert.equal(state.animals[1].quantity, 12)
  assert.equal(state.animals[1].isDestroyed, false)
  assert.equal(state.animals[2].isDead, true)
  assert.equal(state.animals[3].isDestroyed, true)
})

test('wildlife walks are deterministic across split absences and leave tamed or fighting animals alone', () => {
  const { state, options, player } = fixture()
  player.units = []
  player.population = 0
  player.populationMax = 0
  state.animals = [
    { type: 'Hare', label: 'walker', i: 25, j: 25 },
    { type: 'Horse', label: 'tamed', i: 26, j: 25, tamingStatus: 'tamed' },
    { type: 'Wolf', label: 'fighting', i: 27, j: 25, action: 'attack' },
  ]
  options.animalConfig = () => ({ ambientMovement: true, ambientWalkRange: 2 })
  const copy = structuredClone(state)
  const report = simulateOfflineWorld(state, { ...options, toElapsedMs: 3 * DAY })
  for (let day = 0; day < 3; day++)
    simulateOfflineWorld(copy, { ...options, fromElapsedMs: day * DAY, toElapsedMs: (day + 1) * DAY })
  assert.deepEqual(state, copy)
  assert.equal(report.animalsMoved, 3)
  assert.equal(state.animals[1].i, 26)
  assert.equal(state.animals[2].action, 'attack')
  assert.equal(new Set(state.animals.map(animal => `${animal.i}:${animal.j}`)).size, 3)
})

test('combined daily events and training produce the same save across one long absence or repeated visits', () => {
  const { state, options, player } = fixture()
  player.units = []
  player.population = 2
  player.populationMax = 2
  player.buildings.push(
    trainingBuilding(),
    { type: 'Market', label: 'market', i: 25, j: 5, isBuilt: true, marketStock: [] },
    { type: 'Trap', label: 'trap', i: 5, j: 25, isBuilt: true }
  )
  state.animals = [{ type: 'Hare', label: 'hare', i: 25, j: 25 }]
  options.animalConfig = () => ({ ambientMovement: true })
  const copy = structuredClone(state)
  simulateOfflineWorld(state, { ...options, toElapsedMs: 5 * DAY })
  for (let day = 0; day < 5; day++)
    simulateOfflineWorld(copy, { ...options, fromElapsedMs: day * DAY, toElapsedMs: (day + 1) * DAY })
  assert.deepEqual(state, copy)
})

test('offline wildlife cannot walk onto water, missing terrain or occupied cells', () => {
  const { state, options, player } = fixture()
  player.units = []
  player.populationMax = 0
  state.animals = [{ type: 'Hare', label: 'hare', i: 25, j: 25 }]
  options.animalConfig = () => ({ ambientMovement: true })
  for (let i = 23; i <= 27; i++)
    for (let j = 23; j <= 27; j++) {
      if (i !== 25 || j !== 25) options.terrain[i][j] = (i + j) % 2 ? null : { category: 'Water' }
    }
  const report = simulateOfflineWorld(state, options)
  assert.equal(report.animalsMoved, 0)
  assert.equal(state.animals[0].i, 25)
  assert.equal(state.animals[0].j, 25)
})

test('offline construction uses the saved building tier instead of the owners newer age', () => {
  for (const age of [0, 1]) {
    const { state, options, player } = fixture()
    player.age = 1
    const house = { type: 'House', label: 'house', i: 14, j: 14, isBuilt: false, hitPoints: 1, buildingAge: age }
    player.buildings.push(house)
    Object.assign(player.units[0], { autonomousJob: 'construction', buildQueue: ['house'] })
    options.buildingConfig = () => ({
      size: 2,
      constructionTime: 48,
      totalHitPoints: 75,
      ageStats: { 0: { totalHitPoints: 75 }, 1: { totalHitPoints: 125 } },
    })
    simulateOfflineWorld(state, options)
    assert.equal(house.isBuilt, true)
    assert.equal(house.hitPoints, age === 0 ? 75 : 125)
  }
})

test('returning to a map restores only night sleep health for villagers and soldiers', () => {
  const { state, options, player } = fixture()
  player.units = [
    villager({ hitPoints: 2, totalHitPoints: 18 }),
    villager({ type: 'Soldier', label: 'soldier', hitPoints: 2, totalHitPoints: 18 }),
    villager({ label: 'dead', hitPoints: 0, totalHitPoints: 18, isDead: true }),
    villager({ label: 'hero', controlMode: 'hero', hitPoints: 2, totalHitPoints: 18 }),
  ]
  simulateOfflineWorld(state, { ...options, toElapsedMs: 4 * HOUR })
  assert.deepEqual(
    player.units.map(unit => unit.hitPoints),
    [2, 2, 0, 2]
  )
  simulateOfflineWorld(state, { ...options, fromElapsedMs: 4 * HOUR, toElapsedMs: DAY })
  assert.ok(player.units[0].hitPoints > 17)
  assert.equal(player.units[1].hitPoints, 18)
  assert.equal(player.units[2].hitPoints, 0)
  assert.equal(player.units[3].hitPoints, 2)
  const restored = structuredClone(state)
  const health = restored.players[0].units.map(unit => unit.hitPoints)
  simulateOfflineWorld(restored, { ...options, fromElapsedMs: DAY, toElapsedMs: DAY })
  assert.deepEqual(
    restored.players[0].units.map(unit => unit.hitPoints),
    health
  )
})

test('the configured world clock charges upkeep once at its actual next dawn', () => {
  const liveSimulation = loadTsModule('app/services/world/OfflineWorldSimulation.ts')
  const { state, options, player } = fixture()
  const config = gameplay.DAY_NIGHT_CONFIG
  const hourMs = config.dayLengthMs / config.hoursPerDay
  const untilDawn =
    ((config.newDayHour - config.startHour + config.hoursPerDay) % config.hoursPerDay || config.hoursPerDay) * hourMs
  const report = liveSimulation.simulateOfflineWorld(state, {
    ...options,
    fromElapsedMs: untilDawn - hourMs,
    toElapsedMs: untilDawn,
  })
  assert.equal(report.foodConsumed, 4)
  assert.equal(player.buildings[0].inventory.resources.wheat, 96)
  const repeated = liveSimulation.simulateOfflineWorld(state, {
    ...options,
    fromElapsedMs: untilDawn,
    toElapsedMs: untilDawn,
  })
  assert.equal(repeated.foodConsumed, 0)
})

test('offline center completion removes competing sites and their worker orders without converting assets', () => {
  const { advanceOfflineWorker } = loadTsModule('app/services/world/OfflineWorldWork.ts')
  const { OfflineWorldSpatial } = loadTsModule('app/services/world/OfflineWorldSpatial.ts')
  const { state, options, player } = fixture()
  const center = { type: 'TownCenter', i: 14, j: 14, label: 'winner', isBuilt: false, hitPoints: 1 }
  player.buildings = [center]
  Object.assign(player.units[0], { autonomousJob: 'construction', buildQueue: ['winner'] })
  const rivalCenter = { ...center, i: 22, j: 22, label: 'loser' }
  const house = { type: 'House', i: 24, j: 25, label: 'house', isBuilt: true }
  const rivalWorker = villager({
    label: 'rival-worker',
    i: 20,
    j: 20,
    autonomousJob: 'construction',
    action: 'build',
    dest: [22, 22, 'loser'],
    buildQueue: ['loser'],
  })
  const rival = {
    type: 'Human',
    label: 'rival',
    units: [rivalWorker],
    buildings: [rivalCenter, house],
    populationMax: 1,
  }
  state.players.push(rival)
  const spatial = new OfflineWorldSpatial(options.terrain, state, () => 2)
  const report = { buildingsCompleted: 0 }
  advanceOfflineWorker(state, player, 0, player.units[0], 120000, 1, spatial, options, report)
  advanceOfflineWorker(state, rival, 1, rivalWorker, 120000, 1, spatial, options, report)
  assert.equal(center.isBuilt, true)
  assert.equal(rivalCenter.isDead, true)
  assert.equal(rivalCenter.isBuilt, false)
  assert.deepEqual(rival.buildings, [house])
  assert.deepEqual(rivalWorker.buildQueue, [])
  assert.equal(spatial.entity('loser'), undefined)
  assert.equal(spatial.naturalCell({ i: 21, j: 22 }), true)
  assert.equal(report.buildingsCompleted, 1)
  assert.equal(rival.populationMax, 1)
})
