const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadAIEconomy() {
  const filename = path.join(__dirname, '../app/ai/AIEconomy.js')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })
  const constants = {
    ACTION_TYPES: {
      attack: 'attack',
      build: 'build',
      delivery: 'delivery',
      hunt: 'hunt',
      takemeat: 'takemeat',
    },
    BUILDING_TYPES: {
      academy: 'Academy',
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
        getClosestInstance: (_source, targets) => [...targets][0] || false,
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
  const animal = { i: 6, j: 6, hitPoints: 8, totalHitPoints: 8, isDead: false, type: 'Gazelle' }
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
