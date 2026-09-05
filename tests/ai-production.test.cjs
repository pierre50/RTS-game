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
    ACTION_TYPES: {},
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
    UNIT_TYPES: {
      chief: 'Chief',
      villager: 'Villager',
    },
    WORK_TYPES: {},
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
    if (request === './AIStrategyBuilding') return loadTsFile(path.join(__dirname, '../app/ai/AIStrategyBuilding.ts'))
    if (request === './AIStrategyProduction')
      return loadTsFile(path.join(__dirname, '../app/ai/AIStrategyProduction.ts'))
    if (request === './AIStrategyTech') return loadTsFile(path.join(__dirname, '../app/ai/AIStrategyTech.ts'))
    if (request === './AIStrategyTechnologyActions')
      return loadTsFile(path.join(__dirname, '../app/ai/AIStrategyTechnologyActions.ts'))
    if (request === './config') {
      return {
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
  strategy.buyUnits = (_current, _max, _buildings, unitType) => {
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
    storagepits: [],
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
    storagepits: [],
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
    granarys: [],
    storagepits: [],
    markets: [{}],
    watchTowers: [],
    notBuiltHouses: [],
  })

  assert.deepEqual(calls, [{ size: 1, blocksPassage: true, allowsOpenCell: true }])
})

test('ai production trains villagers again when a chief is alive', () => {
  const AIStrategy = loadAIStrategy()
  const ai = {
    config: { units: { Villager: { cost: {} }, Fantassin: { cost: {} } } },
    technologies: [],
    units: [{ type: 'Chief', hitPoints: 10 }],
  }
  const strategy = new AIStrategy(ai)
  const requested = []
  strategy.getEconomicDemand = () => ({})
  strategy.buyUnits = (_current, _max, _buildings, unitType) => {
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

  assert.equal(requested.includes('Villager'), true)
})
