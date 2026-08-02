const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadAIEconomy() {
  const filename = path.join(__dirname, '../app/ai/AIEconomy.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const constants = {
    ACTION_TYPES: {
      attack: 'attack',
      build: 'build',
      delivery: 'delivery',
      fishing: 'fishing',
      hunt: 'hunt',
      takemeat: 'takemeat',
    },
    BUILDING_TYPES: {
      archeryRange: 'ArcheryRange',
      barracks: 'Barracks',
      granary: 'Granary',
      stable: 'Stable',
      storagePit: 'StoragePit',
      townCenter: 'TownCenter',
    },
    FAMILY_TYPES: { building: 'building' },
    UNIT_TYPES: { scout: 'Scout', villager: 'Villager' },
    WORK_TYPES: {
      builder: 'builder',
      farmer: 'farmer',
      fisher: 'fisher',
      forager: 'forager',
      goldminer: 'goldminer',
      hunter: 'hunter',
      stoneminer: 'stoneminer',
      woodcutter: 'woodcutter',
    },
  }
  const module = { exports: {} }
  const localRequire = request => {
    if (request === '../constants') return constants
    if (request === '../lib') {
      return {
        getCellsAroundPoint: (x, y, grid, distance, condition = () => true) => {
          const cells = []
          for (let i = x - distance; i <= x + distance; i++) {
            for (let j = y - distance; j <= y + distance; j++) {
              if (i === x && j === y) continue
              const cell = grid[i]?.[j]
              if (cell && condition(cell)) cells.push(cell)
            }
          }
          return cells
        },
        getClosestInstance: (_source, targets) => [...targets][0] || false,
        getGaiaAnimals: gaia => gaia?.animals ?? gaia?.units ?? [],
        getInstancePath: (unit, i, j) => (unit.reachableCells?.has(`${i}:${j}`) ? [{ i, j }] : []),
        instancesDistance: () => 100,
      }
    }
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return { AIEconomy: module.exports.AIEconomy, constants }
}

test('moves excess live hunters to berries when hunting occupies every food slot', () => {
  const { AIEconomy, constants } = loadAIEconomy()
  const berry = { i: 2, j: 2, quantity: 100 }
  const animal = { i: 6, j: 6, hitPoints: 8, totalHitPoints: 8, isDead: false, type: 'Deer' }
  const assignments = []
  const ai = {
    buildingsByTypes: () => [],
    foundedAnimals: new Set([animal]),
    foundedBerrybushs: new Set([berry]),
    foundedDeadAnimals: new Set(),
    foundedEnemyBuildings: new Set(),
    foundedEnemyUnits: new Set(),
    foundedFish: new Set(),
    getHomeAnchor: () => null,
  }
  const hunters = Array.from({ length: 4 }, (_, index) => {
    const villager = {
      action: constants.ACTION_TYPES.hunt,
      dest: animal,
      hitPoints: 20,
      i: index,
      inactif: false,
      j: index,
      work: constants.WORK_TYPES.hunter,
      sendToBerrybush: target => assignments.push([index, target]),
      stop: () => {
        villager.action = null
        villager.dest = null
        villager.inactif = true
      },
    }
    return villager
  })
  const economy = new AIEconomy(ai)

  economy.assignFoodSources(
    [],
    {
      villagersForaging: [],
      villagersFarming: [],
      villagersFishing: [],
      villagersHunting: hunters,
      villagersOnFood: hunters,
    },
    { maxVillagersOnFood: 4 },
    []
  )

  assert.ok(hunters.some(villager => villager.inactif))
  assert.ok(assignments.length > 0)
})

test('worker snapshots always expose farmer and fisher collections', () => {
  const { AIEconomy } = loadAIEconomy()
  const snapshot = new AIEconomy({}).getWorkerSnapshot([])

  assert.deepEqual(snapshot.villagersFarming, [])
  assert.deepEqual(snapshot.villagersFishing, [])
})

test('food scoring prefers a nearby full farm over distant depleted berries', () => {
  const { AIEconomy } = loadAIEconomy()
  const drop = { i: 0, j: 0 }
  const economy = new AIEconomy({ config: {} })
  const targets = economy.getFoodWorkerTargets(
    1,
    {
      animals: [],
      berries: [{ i: 25, j: 25, quantity: 10 }],
      carcasses: [],
      farms: [{ i: 2, j: 2, quantity: 250 }],
      fish: [],
      meatDrops: [drop],
      plantDrops: [drop],
    },
    {}
  )

  assert.deepEqual(targets, { berry: 0, carcass: 0, farm: 1, fish: 0, hunt: 0 })
})

test('food scoring prefers a nearby carcass over a distant farm', () => {
  const { AIEconomy } = loadAIEconomy()
  const drop = { i: 0, j: 0 }
  const economy = new AIEconomy({ config: {} })
  const targets = economy.getFoodWorkerTargets(
    1,
    {
      animals: [],
      berries: [],
      carcasses: [{ i: 1, j: 1, quantity: 150 }],
      farms: [{ i: 25, j: 25, quantity: 250 }],
      fish: [],
      meatDrops: [drop],
      plantDrops: [drop],
    },
    {}
  )

  assert.deepEqual(targets, { berry: 0, carcass: 1, farm: 0, fish: 0, hunt: 0 })
})

test('food scoring moves live hunters to closer berries', () => {
  const { AIEconomy } = loadAIEconomy()
  const economy = new AIEconomy({ config: {} })
  const worker = { i: 0, j: 0 }
  const targets = economy.getFoodWorkerTargets(
    1,
    {
      animals: [{ i: 40, j: 0, hitPoints: 1, quantity: 250, totalHitPoints: 4 }],
      berries: [{ i: 2, j: 0, quantity: 250 }],
      carcasses: [],
      farms: [],
      fish: [],
      meatDrops: [],
      plantDrops: [],
      workerPositions: [worker],
    },
    { berry: 0, carcass: 0, farm: 0, fish: 0, hunt: 1 }
  )

  assert.deepEqual(targets, { berry: 1, carcass: 0, farm: 0, fish: 0, hunt: 0 })
})

test('villager economy stops distant live hunts when known berries are near home', () => {
  const { AIEconomy, constants } = loadAIEconomy()
  const assignments = []
  const townCenter = {
    i: 0,
    j: 0,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    type: constants.BUILDING_TYPES.townCenter,
  }
  const berry = { i: 3, j: 0, quantity: 250 }
  const animal = { i: 48, j: 0, hitPoints: 8, totalHitPoints: 8, isDead: false, type: 'Deer' }
  const hunter = {
    action: constants.ACTION_TYPES.hunt,
    dest: animal,
    hitPoints: 20,
    i: 42,
    inactif: false,
    j: 0,
    work: constants.WORK_TYPES.hunter,
    sendToBerrybush: target => assignments.push(['berry', target]),
    stop: () => {
      hunter.action = null
      hunter.dest = null
      hunter.inactif = true
    },
  }
  const ai = {
    buildingsByTypes: types => (types.includes(constants.BUILDING_TYPES.townCenter) ? [townCenter] : []),
    config: {},
    foundedAnimals: new Set([animal]),
    foundedBerrybushs: new Set([berry]),
    foundedDeadAnimals: new Set(),
    foundedEnemyBuildings: new Set(),
    foundedEnemyUnits: new Set(),
    foundedFish: new Set(),
    getHomeAnchor: () => townCenter,
  }
  const economy = new AIEconomy(ai)

  economy.assignFoodSources(
    [],
    {
      villagersForaging: [],
      villagersFarming: [],
      villagersFishing: [],
      villagersHunting: [hunter],
      villagersOnFood: [hunter],
    },
    { maxVillagersOnFood: 1 },
    []
  )

  assert.equal(hunter.inactif, true)
  assert.deepEqual(assignments, [['berry', berry]])
})

test('villager economy still permits distant hunting when no berries are known', () => {
  const { AIEconomy, constants } = loadAIEconomy()
  const assignments = []
  const townCenter = {
    i: 0,
    j: 0,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    type: constants.BUILDING_TYPES.townCenter,
  }
  const animal = { i: 48, j: 0, hitPoints: 8, totalHitPoints: 8, isDead: false, quantity: 250, type: 'Deer' }
  const villager = {
    hitPoints: 20,
    i: 0,
    inactif: true,
    j: 0,
    sendToHunt: target => assignments.push(target),
  }
  const ai = {
    buildingsByTypes: types => (types.includes(constants.BUILDING_TYPES.townCenter) ? [townCenter] : []),
    config: {},
    foundedAnimals: new Set([animal]),
    foundedBerrybushs: new Set(),
    foundedDeadAnimals: new Set(),
    foundedEnemyBuildings: new Set(),
    foundedEnemyUnits: new Set(),
    foundedFish: new Set(),
    getHomeAnchor: () => townCenter,
  }
  const economy = new AIEconomy(ai)

  const actions = economy.assignFoodSources(
    [villager],
    {
      villagersForaging: [],
      villagersFarming: [],
      villagersFishing: [],
      villagersHunting: [],
      villagersOnFood: [],
    },
    { maxVillagersOnFood: 1 },
    []
  )

  assert.equal(actions, 1)
  assert.deepEqual(assignments, [animal])
})

function createGrid(size, waterCells = []) {
  const water = new Set(waterCells.map(([i, j]) => `${i}:${j}`))
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => ({
      border: false,
      category: water.has(`${i}:${j}`) ? 'Water' : 'Grass',
      i,
      inclined: false,
      j,
      solid: false,
    }))
  )
}

test('villager economy rejects fish with no reachable shore cell', () => {
  const { AIEconomy } = loadAIEconomy()
  const assignments = []
  const villager = {
    hitPoints: 20,
    i: 0,
    inactif: true,
    j: 0,
    reachableCells: new Set(),
    sendToFish: target => assignments.push(target),
  }
  const ai = {
    buildingsByTypes: () => [],
    config: {},
    context: {
      map: {
        grid: createGrid(5, [
          [1, 1],
          [1, 2],
          [1, 3],
          [2, 1],
          [2, 2],
          [2, 3],
          [3, 1],
          [3, 2],
          [3, 3],
        ]),
      },
    },
    foundedAnimals: new Set(),
    foundedBerrybushs: new Set(),
    foundedDeadAnimals: new Set(),
    foundedEnemyBuildings: new Set(),
    foundedEnemyUnits: new Set(),
    foundedFish: new Set([{ i: 2, j: 2, quantity: 250 }]),
    getHomeAnchor: () => null,
  }
  const economy = new AIEconomy(ai)

  const actions = economy.assignFoodSources(
    [villager],
    {
      villagersForaging: [],
      villagersFarming: [],
      villagersFishing: [],
      villagersHunting: [],
      villagersOnFood: [],
    },
    { maxVillagersOnFood: 1 },
    []
  )

  assert.equal(actions, 0)
  assert.deepEqual(assignments, [])
})

test('villager economy assigns reachable shore fish with the validated shore cell', () => {
  const { AIEconomy } = loadAIEconomy()
  const assignments = []
  const fish = { i: 2, j: 2, quantity: 250 }
  const villager = {
    hitPoints: 20,
    i: 0,
    inactif: true,
    j: 0,
    reachableCells: new Set(['1:2']),
    sendToFish: target => assignments.push(target),
  }
  const ai = {
    buildingsByTypes: () => [],
    config: {},
    context: {
      map: {
        grid: createGrid(5, [[2, 2]]),
      },
    },
    foundedAnimals: new Set(),
    foundedBerrybushs: new Set(),
    foundedDeadAnimals: new Set(),
    foundedEnemyBuildings: new Set(),
    foundedEnemyUnits: new Set(),
    foundedFish: new Set([fish]),
    getHomeAnchor: () => null,
  }
  const economy = new AIEconomy(ai)

  const actions = economy.assignFoodSources(
    [villager],
    {
      villagersForaging: [],
      villagersFarming: [],
      villagersFishing: [],
      villagersHunting: [],
      villagersOnFood: [],
    },
    { maxVillagersOnFood: 1 },
    []
  )

  assert.equal(actions, 1)
  assert.equal(assignments[0], fish)
})
