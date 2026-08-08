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
      house: 'House',
      market: 'Market',
      townCenter: 'TownCenter',
    },
    UNIT_TYPES: {
      chief: 'Chief',
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
    if (request === '../lib/chief') {
      return {
        hasLivingChief: player =>
          Boolean(player?.units?.some(unit => (unit.isChief || unit.type === 'Chief') && !unit.isDead)),
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

test('ai production does not train villagers without a living chief', () => {
  const AIStrategy = loadAIStrategy()
  const ai = {
    config: { units: { Villager: { cost: {} }, Clubman: { cost: {} } } },
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
    infantryUnit: 'Clubman',
    archers: [],
    maxArcher: 0,
    archeryRanges: [],
    archerUnit: 'Bowman',
    academies: [],
  })

  assert.equal(requested.includes('Villager'), false)
  assert.equal(requested.includes('Clubman'), true)
})

test('ai production trains villagers again when a chief is alive', () => {
  const AIStrategy = loadAIStrategy()
  const ai = {
    config: { units: { Villager: { cost: {} }, Clubman: { cost: {} } } },
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
    infantryUnit: 'Clubman',
    archers: [],
    maxArcher: 0,
    archeryRanges: [],
    archerUnit: 'Bowman',
    academies: [],
  })

  assert.equal(requested.includes('Villager'), true)
})
