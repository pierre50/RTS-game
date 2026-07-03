const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadAIStrategy() {
  const filename = path.join(__dirname, '../app/ai/AIStrategy.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const constants = {
    ACTION_TYPES: { delivery: 'delivery' },
    BUILDING_TYPES: {
      barracks: 'Barracks',
      dock: 'Dock',
      house: 'House',
      market: 'Market',
      townCenter: 'TownCenter',
    },
    UNIT_TYPES: {
      fishingBoat: 'FishingBoat',
      lightTransport: 'LightTransport',
      villager: 'Villager',
    },
    WORK_TYPES: {},
  }
  const module = { exports: {} }
  const localRequire = request => {
    if (request === '../constants') return constants
    if (request === '../lib') {
      return {
        canAfford: () => true,
        canPlaceBuildingAt: () => false,
        getClosestInstance: () => null,
        getPositionInGridAroundInstance: () => null,
        instancesDistance: (a, b) => Math.abs(a.i - b.i) + Math.abs(a.j - b.j),
      }
    }
    if (request === './AIMilitary') return { AIMilitary: class {} }
    if (request === './config') {
      return {
        AGE_UP_BUFFERS: {},
        AGE_UP_COSTS: {},
        AI_DIFFICULTIES: { medium: {} },
        MAX_ARCHER_BY_AGE: {},
        MAX_BUILDING_BY_AGE: {},
        MAX_CAVALRY_BY_AGE: {},
        MAX_HOPLITE_BY_AGE: {},
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
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.AIStrategy
}

function loadAIMilitary(libOverrides = {}) {
  const filename = path.join(__dirname, '../app/ai/AIMilitary.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const constants = {
    ACTION_TYPES: { attack: 'attack', loadTransport: 'loadTransport' },
    BUILDING_TYPES: { townCenter: 'TownCenter' },
    FAMILY_TYPES: { unit: 'unit' },
    UNIT_TYPES: { lightTransport: 'LightTransport' },
  }
  const module = { exports: {} }
  const localRequire = request => {
    if (request === '../constants') return constants
    if (request === '../lib') {
      return {
        findLoadShoreCell: () => null,
        findTransportCoastCell: () => null,
        getCellsAroundPoint: () => [],
        getInstancePath: () => [],
        getTransportLoad: () => 0,
        unloadTransport: () => 0,
        ...libOverrides,
      }
    }
    if (request === './config') return { BASE_TARGET_VALUE_BY_TYPE: {} }
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.AIMilitary
}

function createWaterGrid(width) {
  return Array.from({ length: width }, (_, i) => [
    {
      border: false,
      category: 'Water',
      i,
      j: 0,
      solid: false,
    },
  ])
}

function createWaterSquare(size) {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => ({
      border: false,
      category: 'Water',
      i,
      j,
      solid: false,
    }))
  )
}

test('fishing boats prefer fish close to a built dock over distant lake fish', () => {
  const AIStrategy = loadAIStrategy()
  const dock = { i: 2, j: 0 }
  const nearDockFish = { i: 4, j: 0, quantity: 250 }
  const farFish = { i: 90, j: 0, quantity: 250 }
  const boat = { i: 89, j: 0 }
  const ai = {
    buildingsByTypes: () => [dock],
    context: {
      map: {
        grid: createWaterGrid(100),
      },
    },
  }
  const strategy = new AIStrategy(ai)

  assert.equal(strategy.getBestFishForBoat(boat, [farFish, nearDockFish], [dock]), nearDockFish)
})

test('fishing boats are not used as naval scouts when no fish is available', () => {
  const AIStrategy = loadAIStrategy()
  const explored = []
  const dock = { i: 2, j: 0, isBuilt: true, loading: null, queue: [] }
  const boat = {
    action: null,
    explore: () => {
      explored.push('explore')
      return true
    },
    inactif: true,
  }
  const ai = {
    buildingsByTypes: () => [dock],
    config: {
      units: {
        FishingBoat: {
          cost: {},
        },
      },
    },
    economy: {
      isLocationSafe: () => true,
    },
    getLivingUnitsByType: () => [boat],
  }
  const strategy = new AIStrategy(ai)
  strategy.getNavalOpportunity = () => ({
    desiredFishingBoats: 1,
    fish: [],
  })

  const actions = strategy.handleNavalActions({})

  assert.equal(actions, 0)
  assert.deepEqual(explored, [])
})

test('fish on occupied water cells still count as naval opportunities', () => {
  const AIStrategy = loadAIStrategy()
  const grid = createWaterSquare(8)
  const fish = { i: 3, j: 3, quantity: 250 }
  grid[fish.i][fish.j].solid = true
  grid[fish.i][fish.j].has = fish
  const ai = {
    context: {
      map: {
        grid,
      },
    },
    economy: {
      isLocationSafe: () => true,
    },
    foundedFish: new Set([fish]),
  }
  const strategy = new AIStrategy(ai)

  const opportunity = strategy.getNavalOpportunity()

  assert.deepEqual(opportunity.fish, [fish])
  assert.equal(opportunity.desiredFishingBoats, 1)
})

test('naval transport is needed when the enemy island has no land path', () => {
  const AIStrategy = loadAIStrategy()
  const grid = Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) => ({
      border: false,
      category: j === 2 ? 'Water' : 'Grass',
      i,
      j,
      solid: false,
      waterBorder: false,
    }))
  )
  const ai = {
    age: 1,
    context: { map: { grid, size: 4 } },
    enemyPlayers: () => [{ buildings: [{ i: 2, j: 4, type: 'TownCenter' }] }],
    getHomeAnchor: () => ({ i: 2, j: 0 }),
  }
  const strategy = new AIStrategy(ai)

  const diagnostic = strategy.getLandAccessDiagnostic(ai.getHomeAnchor(), ai.enemyPlayers()[0].buildings[0])

  assert.equal(diagnostic.reachable, false)
  assert.equal(diagnostic.reason, 'no_land_path')
  assert.equal(strategy.needsNavalTransport(4), true)
})

test('landing cells are ignored when there is no valid land room to unload', () => {
  const AIMilitary = loadAIMilitary({
    getCellsAroundPoint: (_i, _j, _grid, _distance, condition) =>
      [
        { category: 'Water', waterBorder: false, solid: false, border: false, inclined: false },
        { category: 'Grass', waterBorder: true, solid: false, border: false, inclined: false },
      ].filter(condition),
    getInstancePath: () => [{ i: 1, j: 1 }],
  })
  const landingCandidate = {
    border: false,
    category: 'Water',
    i: 2,
    j: 2,
    solid: false,
    waterBorder: true,
  }
  const ai = {
    context: {
      map: {
        grid: Array.from({ length: 5 }, (_, i) =>
          Array.from({ length: 5 }, (_, j) =>
            i === landingCandidate.i && j === landingCandidate.j
              ? landingCandidate
              : { border: false, category: 'Water', i, j, solid: false, waterBorder: false }
          )
        ),
        size: 4,
      },
    },
    units: [],
  }
  const military = new AIMilitary(ai, {})

  assert.equal(military.findLandingCell({ i: 0, j: 0 }, { i: 2, j: 2 }), null)
})
