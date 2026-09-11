const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadAIStrategy(options = {}) {
  const filename = path.join(__dirname, '../app/ai/AIStrategy.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const constants = {
    ACTION_TYPES: { attack: 'attack', train: 'train' },
    BUILDING_TYPES: {
      archeryRange: 'ArcheryRange',
      barracks: 'Barracks',
      chest: 'Chest',
      farm: 'Farm',
      granary: 'Granary',
      house: 'House',
      market: 'Market',
      stable: 'Stable',
      storagePit: 'StoragePit',
      townCenter: 'TownCenter',
      watchTower: 'WatchTower',
    },
    RESOURCE_NAMES: ['wood', 'food', 'stone', 'gold', 'copper', 'iron'],
    RESOURCE_STORAGE_NAMES: ['wood', 'berry', 'meat', 'wheat', 'stone', 'gold', 'copper', 'iron'],
    DAILY_CONSUMPTION_PER_VILLAGER: { food: 4 },
    UNIT_TYPES: {
      chief: 'Chief',
      villager: 'Villager',
    },
    VILLAGER_ARRIVAL_CONFIG: {
      currentPopulationReserveDays: 3,
      growthRate: 0.12,
      maxArrivalsPerDay: 5,
      newVillagerReserveDays: 5,
    },
    WORK_TYPES: {},
    ...options.constants,
  }
  const mocks = {
    '../constants': constants,
    '../../constants': constants,
  }
  const module = { exports: {} }
  function loadTsFile(tsFilename) {
    const tsSource = fs.readFileSync(tsFilename, 'utf8')
    const { code: tsCode } = babel.transformSync(tsSource, {
      filename: tsFilename,
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        '@babel/preset-typescript',
      ],
    })
    const tsModule = { exports: {} }
    new Function('module', 'exports', 'require', tsCode)(tsModule, tsModule.exports, localRequire)
    return tsModule.exports
  }
  const localRequire = request => {
    if (request === '../constants') return constants
    if (request === '../lib') {
      return {
        canAfford: () => true,
        canPlaceBuildingAt: () => false,
        getClosestInstance: () => null,
        getBuildingPlacementSearchSize: size => size + 1,
        getPositionInGridAroundInstance: () => null,
        instancesDistance: (a, b) => Math.abs(a.i - b.i) + Math.abs(a.j - b.j),
        ...options.lib,
      }
    }
    if (request === '../lib/buildings/passageCells') {
      return {
        createReservedPassageCellLookup: () => ({
          has: cell => Boolean(cell?.reservedPassage),
          size: 0,
        }),
      }
    }
    if (request === '../lib/chief') {
      return {
        hasLivingChief: player =>
          Boolean(player?.units?.some(unit => (unit.isChief || unit.type === 'Chief') && !unit.isDead)),
      }
    }
    if (request === './AIMilitary') return { AIMilitary: class {} }
    if (['./AIStrategyEconomy', './AIStrategyTraining', './AIStrategyResources'].includes(request))
      return loadTsFile(path.join(__dirname, '../app/ai', request.slice(2) + '.ts'))
    if (request === './AIStrategyBuilding') return loadTsFile(path.join(__dirname, '../app/ai/AIStrategyBuilding.ts'))
    if (request === './AIStrategyProduction')
      return loadTsFile(path.join(__dirname, '../app/ai/AIStrategyProduction.ts'))
    if (request === './AIStrategyTech') return loadTsFile(path.join(__dirname, '../app/ai/AIStrategyTech.ts'))
    if (request === './AIStrategyTechnologyActions')
      return loadTsFile(path.join(__dirname, '../app/ai/AIStrategyTechnologyActions.ts'))
    if (request === './config') {
      return {
        AI_BUILDING_TRAINING_CAPACITY: 5,
        AGE_UP_BUFFERS: {},
        AGE_UP_COSTS: {},
        AI_DIFFICULTIES: { medium: {} },
        CHIEF_TECH_PRIORITY: [],
        MAX_ARCHER_BY_AGE: {},
        MAX_BUILDING_BY_AGE: {},
        MAX_BUILDING_BY_AGE_FROZEN: {},
        MAX_CAVALRY_BY_AGE: {},
        MAX_INFANTRY_BY_AGE: {},
        MAX_VILLAGER_PER_AGE: {},
        NEXT_AGE: {},
        TECH_PRIORITY_BY_BUILDING: {},
        VILLAGE_TARGET_PERCENTAGE_BY_AGE: {},
        ...options.config,
      }
    }
    if (request === './unitGroups') {
      return {
        ARCHER_TECH_UPGRADES: {},
        INFANTRY_TECH_UPGRADES: {},
        getBestUnitFromTechs: () => null,
      }
    }
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.AIStrategy
}

test('ai production does not train villagers without a living chief', () => {
  const AIStrategy = loadAIStrategy()
  const ai = {
    config: { units: { Villager: { cost: {} }, Fantassin: { cost: {} } } },
    technologies: [],
    units: [{ type: 'Villager' }],
  }
  const strategy = new AIStrategy(ai)
  const requested = []
  strategy.getEconomicDemand = () => ({})
  strategy.trainUnits = (_current, _max, _buildings, unitType) => {
    requested.push(unitType)
    return 1
  }

  strategy.handleProductionActions({
    villagers: [],
    maxVillagers: 4,
    towncenters: [{}],
    infantry: [],
    maxInfantry: 1,
    barracks: [{}],
    infantryUnit: 'Fantassin',
    archers: [],
    maxArcher: 0,
    archeryRanges: [],
    archerUnit: 'Bowman',
    academies: [],
  })

  assert.equal(requested.includes('Villager'), false)
  assert.equal(requested.includes('Fantassin'), true)
})

test('ai building strategy plants wheat fields after farming is unlocked', () => {
  const AIStrategy = loadAIStrategy({
    lib: {
      getPositionInGridAroundInstance: () => ({ i: 12, j: 14 }),
    },
  })
  const bought = []
  const ai = {
    age: 0,
    config: { buildings: { Farm: { cost: { wood: 75 }, size: 4 } } },
    food: 0,
    gold: 0,
    phase: 'economy',
    population: 4,
    populationMax: 20,
    stone: 0,
    technologies: ['Farming'],
    units: [{ type: 'Chief', hitPoints: 10 }],
    wood: 200,
    buyBuilding: (i, j, type) => {
      bought.push([i, j, type])
      return true
    },
    hasNotReachBuildingLimit: () => true,
  }
  const strategy = new AIStrategy(ai)

  const actions = strategy.handleBuildingActions({
    map: { grid: [] },
    otherPlayers: [],
    villagers: [],
    maxVillagers: 16,
    towncenters: [{ i: 8, j: 8 }],
    infantry: [],
    maxInfantry: 0,
    barracks: [],
    infantryUnit: null,
    archers: [],
    maxArcher: 0,
    archeryRanges: [],
    archerUnit: null,
    cavalry: [],
    maxCavalry: 0,
    stables: [],
    houses: [],
    farms: [],
    granarys: [{ i: 9, j: 9, isBuilt: true }],
    storagepits: [{}],
    markets: [{}],
    watchTowers: [],
    notBuiltHouses: [],
  })

  assert.equal(actions, 1)
  assert.deepEqual(bought, [[12, 14, 'Farm']])
})

test('ai building strategy can spend resources stored in chests', () => {
  const AIStrategy = loadAIStrategy({
    lib: {
      getPositionInGridAroundInstance: () => ({ i: 12, j: 14 }),
    },
  })
  const bought = []
  const ai = {
    age: 0,
    config: { buildings: { Farm: { cost: { wood: 75 }, size: 4 } } },
    food: 0,
    gold: 0,
    label: 'ai-1',
    phase: 'economy',
    population: 4,
    populationMax: 20,
    stone: 0,
    technologies: ['Farming'],
    units: [{ type: 'Chief', hitPoints: 10 }],
    wood: 0,
    buildings: [],
    buyBuilding: (i, j, type) => {
      bought.push([i, j, type])
      return true
    },
    hasNotReachBuildingLimit: () => true,
  }
  ai.buildings.push({ owner: ai, type: 'Chest', inventory: { resources: { wood: 80 } } })
  const strategy = new AIStrategy(ai)

  const actions = strategy.handleBuildingActions({
    map: { grid: [] },
    otherPlayers: [],
    villagers: [],
    maxVillagers: 16,
    towncenters: [{ i: 8, j: 8 }],
    infantry: [],
    maxInfantry: 0,
    barracks: [],
    infantryUnit: null,
    archers: [],
    maxArcher: 0,
    archeryRanges: [],
    archerUnit: null,
    cavalry: [],
    maxCavalry: 0,
    stables: [],
    houses: [],
    farms: [],
    granarys: [{ i: 9, j: 9, isBuilt: true }],
    storagepits: [{}],
    markets: [{}],
    watchTowers: [],
    notBuiltHouses: [],
  })

  assert.equal(actions, 1)
  assert.deepEqual(bought, [[12, 14, 'Farm']])
})

test('ai reserve checks can read resources stored in chests', () => {
  const AIStrategy = loadAIStrategy()
  const ai = {
    age: 0,
    config: { buildings: {}, units: {} },
    label: 'ai-1',
    population: 0,
    units: [],
    wood: 0,
    buildings: [],
  }
  ai.buildings.push({ owner: ai, type: 'Chest', inventory: { resources: { wood: 80 } } })
  const strategy = new AIStrategy(ai)

  assert.equal(strategy.canSpendWithReserve({ wood: 75 }, { wood: 5 }), true)
  assert.equal(strategy.canSpendWithReserve({ wood: 76 }, { wood: 5 }), false)
})

test('ai economic demand reserves food for automatic villager growth', () => {
  const AIStrategy = loadAIStrategy()
  const ai = {
    age: 0,
    buildings: [{ type: 'TownCenter', inventory: { resources: { wheat: 40 } } }],
    config: { buildings: {}, units: {} },
    difficultyConfig: { popCapMultiplier: 1 },
    food: 40,
    gold: 0,
    phase: 'economy',
    population: 10,
    populationMax: 20,
    stone: 0,
    technologies: [],
    units: [],
    wood: 0,
  }
  const strategy = new AIStrategy(ai)

  assert.equal(strategy.getEconomicDemand().food, 100)
})

test('ai economic demand includes stone-heavy core infrastructure', () => {
  const AIStrategy = loadAIStrategy()
  const ai = {
    age: 0,
    buildings: [{ type: 'TownCenter', inventory: { resources: { wheat: 999 } } }],
    config: {
      buildings: {
        Granary: { cost: { stone: 50, wood: 180 } },
        Market: { cost: { stone: 90, wood: 225 } },
        StoragePit: { cost: { stone: 80, wood: 180 } },
      },
      units: {},
    },
    difficultyConfig: { popCapMultiplier: 1 },
    food: 999,
    gold: 0,
    phase: 'economy',
    population: 8,
    populationMax: 20,
    stone: 0,
    technologies: [],
    units: [],
    wood: 0,
  }
  const strategy = new AIStrategy(ai)

  // A market is not reserved before its storage and granary prerequisites exist.
  assert.deepEqual(strategy.getEconomicDemand(), { food: 0, gold: 0, stone: 130, wood: 360 })
})

test('ai building strategy anticipates automatic villager waves before adding houses', () => {
  const bought = []
  const AIStrategy = loadAIStrategy({
    lib: {
      getPositionInGridAroundInstance: () => ({ i: 10, j: 11 }),
    },
  })
  const ai = {
    age: 0,
    buyBuilding: (i, j, type) => {
      bought.push([i, j, type])
      return true
    },
    config: { buildings: { House: { cost: { stone: 15, wood: 45 }, size: 2 } } },
    food: 200,
    gold: 0,
    hasNotReachBuildingLimit: () => true,
    phase: 'economy',
    population: 17,
    populationMax: 20,
    stone: 20,
    technologies: [],
    units: [{ type: 'Chief', hitPoints: 10 }],
    wood: 100,
  }
  const strategy = new AIStrategy(ai)

  const actions = strategy.handleBuildingActions({
    map: { grid: [] },
    otherPlayers: [],
    villagers: [],
    maxVillagers: 16,
    towncenters: [{ i: 8, j: 8 }],
    infantry: [],
    maxInfantry: 0,
    barracks: [],
    infantryUnit: null,
    archers: [],
    maxArcher: 0,
    archeryRanges: [],
    archerUnit: null,
    cavalry: [],
    maxCavalry: 0,
    stables: [],
    houses: [],
    farms: [],
    granarys: [],
    storagepits: [],
    markets: [],
    watchTowers: [],
    notBuiltHouses: [],
  })

  assert.equal(actions, 1)
  assert.deepEqual(bought, [[10, 11, 'House']])
})

test('ai building strategy adds passage clearance to construction searches', () => {
  const calls = []
  const AIStrategy = loadAIStrategy({
    lib: {
      getPositionInGridAroundInstance: (_anchor, _grid, _space, size, _allowInclined, extraCondition) => {
        calls.push({
          size,
          blocksPassage: extraCondition({ i: 0, j: 0, reservedPassage: true }) === false,
          allowsOpenCell: extraCondition({ i: 0, j: 1 }) === true,
        })
        return null
      },
    },
  })
  const ai = {
    age: 0,
    config: { buildings: { House: { cost: { wood: 30 }, size: 2 } } },
    food: 0,
    gold: 0,
    phase: 'economy',
    population: 19,
    populationMax: 20,
    stone: 0,
    technologies: [],
    units: [{ type: 'Chief', hitPoints: 10 }],
    wood: 200,
    buyBuilding: () => false,
    hasNotReachBuildingLimit: () => true,
  }
  const strategy = new AIStrategy(ai)

  strategy.handleBuildingActions({
    map: { grid: [] },
    otherPlayers: [],
    villagers: [],
    maxVillagers: 16,
    towncenters: [{ i: 8, j: 8 }],
    infantry: [],
    maxInfantry: 0,
    barracks: [],
    infantryUnit: null,
    archers: [],
    maxArcher: 0,
    archeryRanges: [],
    archerUnit: null,
    cavalry: [],
    maxCavalry: 0,
    stables: [],
    houses: [],
    farms: [],
    granarys: [{}],
    storagepits: [{}],
    markets: [{}],
    watchTowers: [],
    notBuiltHouses: [],
  })

  assert.deepEqual(calls, [{ size: 1, blocksPassage: true, allowsOpenCell: true }])
})

test('ai production no longer buys villagers even when a chief is alive', () => {
  const AIStrategy = loadAIStrategy()
  const ai = {
    config: { units: { Villager: { cost: {} }, Fantassin: { cost: {} } } },
    technologies: [],
    units: [{ type: 'Chief', hitPoints: 10 }],
  }
  const strategy = new AIStrategy(ai)
  const requested = []
  strategy.getEconomicDemand = () => ({})
  strategy.trainUnits = (_current, _max, _buildings, unitType) => {
    requested.push(unitType)
    return 1
  }

  strategy.handleProductionActions({
    villagers: [],
    maxVillagers: 4,
    towncenters: [{}],
    infantry: [],
    maxInfantry: 1,
    barracks: [{}],
    infantryUnit: 'Fantassin',
    archers: [],
    maxArcher: 0,
    archeryRanges: [],
    archerUnit: 'Bowman',
    academies: [],
  })

  assert.equal(requested.includes('Villager'), false)
  assert.equal(requested.includes('Fantassin'), true)
})

test('ai military production sends a villager to train instead of buying from the building', () => {
  const AIStrategy = loadAIStrategy()
  const calls = []
  const ai = {
    config: { units: { Fantassin: { cost: { food: 50 } } } },
    food: 100,
    technologies: [],
    units: [],
  }
  const villager = {
    type: 'Villager',
    label: 'villager-1',
    owner: ai,
    action: null,
    sendToEvt: (target, action, options) => {
      calls.push(['sendToEvt', target.type, action, options])
      return true
    },
  }
  ai.units.push(villager)
  const barracks = {
    type: 'Barracks',
    units: ['Fantassin'],
    queue: [],
    buyUnit: () => {
      throw new Error('AI should not buy directly from the building')
    },
  }
  const strategy = new AIStrategy(ai)
  strategy.getEconomicDemand = () => ({})

  const actions = strategy.trainUnits(0, 1, [barracks], 'Fantassin', [villager], {})

  assert.equal(actions, 1)
  assert.equal(villager.trainingTargetType, 'Fantassin')
  assert.deepEqual(calls, [['sendToEvt', 'Barracks', 'train', { forceRepath: true, allowPassageStop: true }]])
})

function strategyFixture(options = {}) {
  const AIStrategy = loadAIStrategy(options)
  const ai = {
    age: 0,
    buildings: [],
    units: [],
    technologies: [],
    phase: 'economy',
    population: 0,
    populationMax: 20,
    difficultyConfig: { popCapMultiplier: 1 },
    food: 500,
    wood: 500,
    gold: 500,
    stone: 500,
    foundedBerrybushs: new Set(),
    getHomeAnchor: () => null,
    config: { buildings: {}, units: { Fantassin: { cost: { food: 50 } } } },
  }
  ai.buildings.push({
    type: 'Chest',
    owner: ai,
    inventory: {
      resources: {
        get wheat() {
          return ai.food
        },
        get wood() {
          return ai.wood
        },
        get gold() {
          return ai.gold
        },
        get stone() {
          return ai.stone
        },
      },
    },
  })
  const strategy = new AIStrategy(ai)
  const barracks = { type: 'Barracks', owner: ai, units: ['Fantassin'], queue: [], isBuilt: true }
  function villager(patch = {}) {
    const unit = {
      type: 'Villager',
      sendToEvt(target) {
        this.dest = target
        return true
      },
      ...patch,
    }
    ai.units.push(unit)
    return unit
  }
  return { ai, strategy, barracks, villager }
}

test('ai training preserves the reserve and reserves each accepted order only once', () => {
  const { ai, strategy, barracks, villager } = strategyFixture()
  ai.food = 170
  const villagers = [villager(), villager(), villager()]
  const reserve = { food: 70 }
  assert.equal(strategy.trainUnits(0, 3, [barracks], 'Fantassin', villagers, reserve), 2)
  assert.equal(villagers.filter(unit => unit.trainingTargetType).length, 2)
  assert.deepEqual(reserve, { food: 70 })
  assert.equal(ai.food, 170)
  assert.equal(strategy.trainUnits(3, 3, [barracks], 'Fantassin', villagers), 0)
})

test('ai training ignores unavailable villagers and does not reserve failed movement orders', () => {
  const { ai, strategy, barracks, villager } = strategyFixture()
  ai.food = 50
  const rejected = villager({ sendToEvt: () => false })
  const accepted = villager()
  const villagers = [
    villager({ isDead: true }),
    villager({ isDestroyed: true }),
    villager({ type: 'Fantassin' }),
    villager({ action: 'attack' }),
    villager({ trainingTargetType: 'Bowman' }),
    villager({ sendToEvt: undefined }),
    rejected,
    accepted,
  ]
  assert.equal(strategy.trainUnits(0, 4, [barracks], 'Fantassin', villagers), 1)
  assert.equal(rejected.trainingTargetType, null)
  assert.equal(accepted.trainingTargetType, 'Fantassin')
})

test('ai training accounts for active, queued, concurrent and incoming trainees', () => {
  const { strategy, barracks, villager } = strategyFixture()
  barracks.loading = 0
  barracks.queue = ['Fantassin', 'Fantassin']
  barracks.trainingQueue = [{}]
  villager({ dest: barracks, trainingTargetType: 'Fantassin' })
  villager({ dest: barracks, trainingTargetType: 'Fantassin', isDead: true })
  villager({ dest: barracks, trainingTargetType: 'Fantassin', isDestroyed: true })
  const candidates = [villager(), villager()]
  assert.equal(strategy.trainUnits(0, 2, [barracks], 'Fantassin', candidates), 1)
  assert.equal(candidates[1].trainingTargetType, undefined)
  assert.equal(strategy.trainUnits(0, 1, [barracks], 'Fantassin', [candidates[1]]), 0)
})

test('ai training skips dead, destroyed and incompatible buildings', () => {
  const { strategy, barracks, villager } = strategyFixture()
  const invalid = [
    { ...barracks, isDead: true },
    { ...barracks, isDestroyed: true },
    { ...barracks, units: ['Bowman'] },
    { ...barracks, units: undefined },
  ]
  assert.equal(strategy.trainUnits(0, 1, invalid, 'Fantassin', [villager()]), 0)
  assert.equal(strategy.trainUnits(0, 1, [...invalid, barracks], 'Fantassin', [villager()]), 1)
})

test('ai barracks expansion requires military phase, an unlocked age and enough army or training load', () => {
  const { ai, strategy, barracks } = strategyFixture({ constants: { AGE_UP_ENABLED: true } })
  ai.buildings = [barracks]
  const army = { infantry: Array(8).fill({}) }
  ai.age = 2
  assert.equal(strategy.getDesiredBarracksCount(army), 0)
  ai.phase = 'military_build'
  ai.age = 1
  assert.equal(strategy.getDesiredBarracksCount(army), 1)
  ai.age = 2
  assert.equal(strategy.getDesiredBarracksCount(army), 2)
  assert.equal(strategy.getDesiredBarracksCount(), 1)
  barracks.queue = ['Fantassin']
  barracks.loading = 0
  assert.equal(strategy.getDesiredBarracksCount(), 2)
  assert.equal(
    strategy.getTrainingLoad([barracks, { ...barracks, isDead: true }, { ...barracks, isDestroyed: true }]),
    2
  )
  barracks.isBuilt = false
  assert.equal(strategy.getDesiredBarracksCount(), 1)
})

test('ai growth reserves respect housing capacity, population and the daily arrival cap', () => {
  const { ai, strategy } = strategyFixture()
  assert.equal(strategy.getVillagerGrowthFoodReserve(), 0)
  ai.population = 10
  assert.equal(strategy.getVillagerGrowthFoodReserve(), 140)
  ai.populationMax = 10
  assert.equal(strategy.getVillagerGrowthFoodReserve(), 120)
  ai.populationMax = 8
  assert.equal(strategy.getVillagerGrowthFoodReserve(), 120)
  ai.population = 100
  ai.populationMax = 200
  assert.equal(strategy.getVillagerGrowthFoodReserve(), 1300)
})

test('AI ignores legacy age costs when planning its economy', () => {
  const { ai, strategy } = strategyFixture({
    constants: { AGE_UP_ENABLED: true, DAILY_CONSUMPTION_PER_VILLAGER: { food: 0 } },
    config: { AGE_UP_COSTS: { 1: { food: 500, gold: 800 } } },
  })
  ai.population = 7
  assert.deepEqual(strategy.getEconomicDemand(), { food: 0, gold: 0, wood: 0, stone: 0 })
})

test('ai berry planning rejects destroyed, depleted and distant bushes', () => {
  const { ai, strategy } = strategyFixture()
  const bush = { i: 5, j: 5, quantity: 100 }
  ai.foundedBerrybushs = new Set([
    bush,
    { ...bush, isDestroyed: true },
    { ...bush, isDead: true },
    { ...bush, quantity: 0 },
    { ...bush, i: 50 },
  ])
  ai.getHomeAnchor = () => ({ i: 0, j: 0 })
  assert.equal(strategy.getViableBerryBushCount(), 1)
  ai.getHomeAnchor = () => null
  assert.equal(strategy.getViableBerryBushCount(), 2)
  ai.buildings = [{ type: 'Granary', isBuilt: true, i: 0, j: 0 }]
  assert.equal(strategy.getViableBerryBushCount(), 1)
  ai.buildings[0].isDestroyed = true
  assert.equal(strategy.getViableBerryBushCount(), 2)
  ai.buildings[0].isDestroyed = false
  ai.buildings[0].i = 100
  assert.equal(strategy.getViableBerryBushCount(), 0)
})
