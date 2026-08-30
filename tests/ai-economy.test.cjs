const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

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
      captureHorse: 'captureHorse',
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
      forager: 'forager',
      goldminer: 'goldminer',
      hunter: 'hunter',
      horseCapture: 'horseCapture',
      stoneminer: 'stoneminer',
      woodcutter: 'woodcutter',
    },
  }
  const module = { exports: {} }
  const loadTsModule = modulePath => {
    const moduleFilename = path.join(__dirname, `../app/ai/${modulePath}.ts`)
    const moduleSource = fs.readFileSync(moduleFilename, 'utf8')
    const { code: moduleCode } = babel.transformSync(moduleSource, {
      filename: moduleFilename,
      presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
    })
    const tsModule = { exports: {} }
    new Function('module', 'exports', 'require', moduleCode)(tsModule, tsModule.exports, localRequire)
    return tsModule.exports
  }
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
        isWheatMature: farm => farm?.mature !== false,
      }
    }
    if (request === '../lib/horses/stableHorses') {
      return {
        canStoreStableHorse: building => (building.stableHorses?.length ?? 0) < 5,
        getStableHorseAmount: building => building.stableHorses?.length ?? 0,
        STABLE_HORSE_CAPACITY: 5,
      }
    }
    if (request === '../lib/grid/queries') {
      return {
        getClosestInstance: (_source, targets) => [...targets][0] || false,
      }
    }
    if (request === './AIEconomyFoodManager') {
      return loadTsModule('AIEconomyFoodManager')
    }
    if (request === './AIEconomyFoodScoring') return loadTsModule('AIEconomyFoodScoring')
    if (request === './AIEconomyBuilders') return loadTsModule('AIEconomyBuilders')
    if (request === './AIEconomyHorseCapture') return loadTsModule('AIEconomyHorseCapture')
    return requireFromTsFile(request, filename, {})
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
      villagersHunting: hunters,
      villagersOnFood: hunters,
    },
    { maxVillagersOnFood: 4 },
    []
  )

  assert.ok(hunters.some(villager => villager.inactif))
  assert.ok(assignments.length > 0)
})

test('worker snapshots always expose a farmer collection', () => {
  const { AIEconomy } = loadAIEconomy()
  const snapshot = new AIEconomy({}).getWorkerSnapshot([])

  assert.deepEqual(snapshot.villagersFarming, [])
})

test('AI treats granaries as meat drop sites', () => {
  const { AIEconomy, constants } = loadAIEconomy()
  const townCenter = { type: constants.BUILDING_TYPES.townCenter, isBuilt: true }
  const granary = { type: constants.BUILDING_TYPES.granary, isBuilt: true }
  const storagePit = { type: constants.BUILDING_TYPES.storagePit, isBuilt: true }
  const ai = {
    buildingsByTypes: types => [townCenter, granary, storagePit].filter(building => types.includes(building.type)),
    foundedEnemyBuildings: new Set(),
    foundedEnemyUnits: new Set(),
  }
  const economy = new AIEconomy(ai)

  assert.deepEqual(economy.getFoodDropSites('meat'), [townCenter, granary])
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
      meatDrops: [drop],
      plantDrops: [drop],
    },
    {}
  )

  assert.deepEqual(targets, { berry: 0, carcass: 0, farm: 1, hunt: 0 })
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
      meatDrops: [drop],
      plantDrops: [drop],
    },
    {}
  )

  assert.deepEqual(targets, { berry: 0, carcass: 1, farm: 0, hunt: 0 })
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
      meatDrops: [],
      plantDrops: [],
      workerPositions: [worker],
    },
    { berry: 0, carcass: 0, farm: 0, hunt: 1 }
  )

  assert.deepEqual(targets, { berry: 1, carcass: 0, farm: 0, hunt: 0 })
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
    getHomeAnchor: () => townCenter,
  }
  const economy = new AIEconomy(ai)

  economy.assignFoodSources(
    [],
    {
      villagersForaging: [],
      villagersFarming: [],
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
    getHomeAnchor: () => townCenter,
  }
  const economy = new AIEconomy(ai)

  const actions = economy.assignFoodSources(
    [villager],
    {
      villagersForaging: [],
      villagersFarming: [],
      villagersHunting: [],
      villagersOnFood: [],
    },
    { maxVillagersOnFood: 1 },
    []
  )

  assert.equal(actions, 1)
  assert.deepEqual(assignments, [animal])
})

test('horse capture assignment spreads villagers across unreserved horses and stable slots', () => {
  const { AIEconomy, constants } = loadAIEconomy()
  const assignments = []
  const stable = {
    i: 8,
    j: 0,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    stableHorses: [{}, {}, {}],
    type: constants.BUILDING_TYPES.stable,
  }
  const horses = [
    { i: 4, j: 0, isDead: false, isDestroyed: false, label: 'horse-1', type: 'Horse' },
    { i: 5, j: 0, isDead: false, isDestroyed: false, label: 'horse-2', type: 'Horse' },
    { i: 6, j: 0, isDead: false, isDestroyed: false, label: 'horse-3', type: 'Horse' },
  ]
  const villagers = ['villager-1', 'villager-2', 'villager-3'].map(label => ({
    hitPoints: 20,
    i: 0,
    inactif: true,
    j: 0,
    label,
    sendToCaptureHorse: target => {
      assignments.push([label, target.label])
      return true
    },
  }))
  const ai = {
    buildingsByTypes: types => (types.includes(constants.BUILDING_TYPES.stable) ? [stable] : []),
    foundedAnimals: new Set(horses),
    foundedBerrybushs: new Set(),
    foundedDeadAnimals: new Set(),
    foundedEnemyBuildings: new Set(),
    foundedEnemyUnits: new Set(),
    getHomeAnchor: () => null,
  }
  const economy = new AIEconomy(ai)

  const actions = economy.assignHorseCaptures(villagers)

  assert.equal(actions, 2)
  assert.deepEqual(assignments, [
    ['villager-1', 'horse-1'],
    ['villager-2', 'horse-2'],
  ])
  assert.deepEqual(villagers.map(villager => villager.label), ['villager-3'])
})

test('horse capture assignment ignores hero companion horses', () => {
  const { AIEconomy, constants } = loadAIEconomy()
  const assignments = []
  const stable = {
    i: 8,
    j: 0,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    stableHorses: [],
    type: constants.BUILDING_TYPES.stable,
  }
  const hero = { label: 'hero-1' }
  const horses = [
    { companionOwner: hero, i: 4, j: 0, isDead: false, isDestroyed: false, label: 'horse-1', type: 'Horse' },
    { i: 5, j: 0, isDead: false, isDestroyed: false, label: 'horse-2', type: 'Horse' },
  ]
  const villagers = [
    {
      hitPoints: 20,
      i: 0,
      inactif: true,
      j: 0,
      label: 'villager-1',
      sendToCaptureHorse: target => {
        assignments.push([target.label])
        return true
      },
    },
  ]
  const ai = {
    buildingsByTypes: types => (types.includes(constants.BUILDING_TYPES.stable) ? [stable] : []),
    foundedAnimals: new Set(horses),
    foundedBerrybushs: new Set(),
    foundedDeadAnimals: new Set(),
    foundedEnemyBuildings: new Set(),
    foundedEnemyUnits: new Set(),
    getHomeAnchor: () => null,
  }
  const economy = new AIEconomy(ai)

  assert.equal(economy.assignHorseCaptures(villagers), 1)
  assert.deepEqual(assignments, [['horse-2']])
})

test('AI economy does not assign villager work during sleep time', () => {
  const { AIEconomy, constants } = loadAIEconomy()
  const tree = { i: 4, j: 4, label: 'tree-1' }
  const assignments = []
  const villager = {
    action: null,
    hitPoints: 20,
    i: 0,
    inactif: true,
    j: 0,
    label: 'villager-1',
    type: constants.UNIT_TYPES.villager,
    work: null,
    sendToTree: target => assignments.push(['wood', target.label]),
    explore: () => {
      assignments.push(['explore'])
      return true
    },
  }
  const ai = {
    age: 0,
    buildingsByTypes: () => [],
    config: { buildings: {} },
    context: {
      dayNight: { state: { hour: 23 } },
      map: { gaia: {}, grid: [] },
    },
    foundedAnimals: new Set(),
    foundedBerrybushs: new Set(),
    foundedDeadAnimals: new Set(),
    foundedEnemyBuildings: new Set(),
    foundedEnemyUnits: new Set(),
    foundedGolds: new Set(),
    foundedStones: new Set(),
    foundedTrees: new Set([tree]),
    foundedWheats: new Set(),
    getHomeAnchor: () => null,
    hasNotReachBuildingLimit: () => true,
    strategy: { getEconomicDemand: () => ({}) },
    villageTargetPercentageByAge: {
      0: { food: 50, wood: 50, gold: 0, stone: 0 },
    },
    views: {
      length: 1,
      coordinates: () => [0, 0],
      isViewed: () => false,
    },
  }
  const economy = new AIEconomy(ai)

  const actions = economy.handleVillagerActions({
    debug: false,
    farms: [],
    map: ai.context.map,
    notBuiltBuildings: [],
    storagepits: [],
    towncenters: [],
    villagers: [villager],
  })

  assert.equal(actions, 0)
  assert.deepEqual(assignments, [])
})
