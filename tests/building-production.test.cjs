const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('resource rally commands keep the spawned unit context', () => {
  const spawnCell = { i: 1, j: 1, category: 'Land', solid: false }
  const tree = { family: 'resource', category: 'Tree', type: 'Tree', isDestroyed: false }
  const rallyCell = { i: 2, j: 2, category: 'Land', solid: false, has: tree }
  const calls = []
  const unit = {
    sendToTree(target) {
      calls.push([this, target])
    },
    sendTo() {
      throw new Error('expected the resource-specific command')
    },
  }
  const building = {
    i: 0,
    j: 0,
    size: 1,
    rallyPoint: { i: 2, j: 2, direction: 0 },
    context: {
      map: {
        grid: [
          [null, null, null],
          [null, spawnCell, null],
          [null, null, rallyCell],
        ],
        randomItem: items => items[0],
      },
      menu: {},
    },
    owner: {
      population: 0,
      populationMax: 10,
      config: {
        units: {
          Villager: {},
        },
      },
      createUnit(options) {
        calls.push(['created', options])
        return unit
      },
      isPlayed: false,
    },
  }
  const { BuildingProduction } = loadModule('app/classes/building/BuildingProduction.ts', {
    'pixi.js': { Assets: {} },
    '../../constants': {
      ACTION_TYPES: {},
      FAMILY_TYPES: {
        animal: 'animal',
        building: 'building',
        resource: 'resource',
        unit: 'unit',
      },
      LABEL_TYPES: {},
      MENU_INFO_IDS: { populationText: 'populationText' },
      PLAYER_TYPES: {},
      POPULATION_MAX: 200,
      UNIT_TYPES: { villager: 'Villager' },
    },
    '../../lib': {
      canAfford: () => true,
      changeSpriteColorDirectly: () => {},
      getActionCondition: () => false,
      getBuildingAsset: () => null,
      getFreeCellAroundPoint: () => spawnCell,
      getTexture: () => null,
      payCost: () => {},
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
  })

  assert.equal(new BuildingProduction(building).placeUnit('Villager'), true)

  assert.equal(calls[0][0], 'created')
  assert.deepEqual(calls[0][1], { i: 1, j: 1, type: 'Villager' })
  assert.deepEqual(calls[1], [unit, tree])
})

test('military unit purchase reserves and sends an existing villager instead of spawning directly', () => {
  const calls = []
  const villager = {
    type: 'Villager',
    inactif: true,
    sendToEvt(target, action) {
      calls.push(['sendToEvt', target.type, action])
      this.dest = target
      this.action = action
    },
  }
  const building = {
    type: 'Barracks',
    i: 0,
    j: 0,
    size: 1,
    isBuilt: true,
    isDead: false,
    queue: [],
    loading: null,
    technology: null,
    units: ['Axeman'],
    context: {
      map: { instantMode: false },
      menu: {
        updateTopbar() {
          calls.push(['topbar'])
        },
        showMessage(message) {
          calls.push(['message', message])
        },
      },
    },
    owner: {
      food: 50,
      population: 1,
      populationMax: 10,
      selectedUnits: [villager],
      units: [villager],
      config: {
        units: {
          Axeman: { category: 'Infantry', cost: { food: 35 }, trainingTime: 27 },
        },
      },
      createUnit(options) {
        calls.push(['created', options])
      },
      isPlayed: true,
    },
  }
  villager.owner = building.owner

  const { BuildingProduction } = loadModule('app/classes/building/BuildingProduction.ts', {
    'pixi.js': { Assets: {} },
    '../../constants': {
      ACTION_TYPES: { train: 'train' },
      FAMILY_TYPES: {
        animal: 'animal',
        building: 'building',
        resource: 'resource',
        unit: 'unit',
      },
      LABEL_TYPES: {},
      MENU_INFO_IDS: { populationText: 'populationText' },
      PLAYER_TYPES: { ai: 'AI' },
      POPULATION_MAX: 200,
      UNIT_TYPES: { villager: 'Villager' },
    },
    '../../lib': {
      canAfford: (owner, cost = {}) => Object.entries(cost).every(([key, amount]) => owner[key] >= amount),
      changeSpriteColorDirectly: () => {},
      getActionCondition: () => false,
      getBuildingAsset: () => null,
      getFreeCellAroundPoint: () => null,
      getTexture: () => null,
      payCost: (owner, cost = {}) => {
        for (const [key, amount] of Object.entries(cost)) owner[key] -= amount
      },
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
  })

  assert.equal(new BuildingProduction(building).buyUnit('Axeman'), true)
  assert.equal(building.trainingUnit, villager)
  assert.equal(building.trainingType, 'Axeman')
  assert.equal(building.isUsedBy, villager)
  assert.equal(building.owner.food, 15)
  assert.deepEqual(
    calls.filter(call => call[0] === 'created'),
    []
  )
  assert.deepEqual(
    calls.find(call => call[0] === 'sendToEvt'),
    ['sendToEvt', 'Barracks', 'train']
  )
})

test('arrived villager is consumed and trained unit reuses the same population slot', () => {
  const spawnCell = { i: 2, j: 2, category: 'Land', solid: false }
  const calls = []
  const owner = {
    food: 15,
    population: 1,
    populationMax: 1,
    selectedUnits: [],
    units: [],
    config: {
      units: {
        Axeman: { category: 'Infantry', cost: { food: 35 }, trainingTime: 27 },
      },
    },
    createUnit(options) {
      calls.push(['created', options])
      return { ...options, owner }
    },
    isPlayed: false,
  }
  const villagerCell = { i: 1, j: 1, category: 'Land', solid: true, has: null }
  const map = {
    instantMode: true,
    grid: [
      [null, null, null],
      [null, villagerCell, null],
      [null, null, spawnCell],
    ],
    randomItem: items => items[0],
    removeFromInstanceBucket(unit) {
      calls.push(['bucketRemoved', unit.type])
    },
    removeChild(unit) {
      calls.push(['removed', unit.type])
    },
  }
  const villager = {
    type: 'Villager',
    owner,
    context: { map },
    currentCell: villagerCell,
    path: [],
    stopInterval() {},
    stopTimeout() {},
    unselect() {},
    destroy() {
      calls.push(['destroyed', this.type])
    },
  }
  villagerCell.has = villager
  owner.units.push(villager)
  const building = {
    type: 'Barracks',
    i: 0,
    j: 0,
    size: 1,
    isBuilt: true,
    isDead: false,
    queue: [],
    loading: null,
    technology: null,
    units: ['Axeman'],
    trainingUnit: villager,
    trainingType: 'Axeman',
    context: { map, menu: {} },
    owner,
    startInterval(callback) {
      callback()
    },
    stopInterval() {},
  }

  const { BuildingProduction } = loadModule('app/classes/building/BuildingProduction.ts', {
    'pixi.js': { Assets: {} },
    '../../constants': {
      ACTION_TYPES: { train: 'train' },
      FAMILY_TYPES: {
        animal: 'animal',
        building: 'building',
        resource: 'resource',
        unit: 'unit',
      },
      LABEL_TYPES: {},
      MENU_INFO_IDS: { populationText: 'populationText' },
      PLAYER_TYPES: { ai: 'AI' },
      POPULATION_MAX: 200,
      UNIT_TYPES: { villager: 'Villager' },
    },
    '../../lib': {
      canAfford: () => true,
      changeSpriteColorDirectly: () => {},
      getActionCondition: () => false,
      getBuildingAsset: () => null,
      getFreeCellAroundPoint: () => spawnCell,
      getTexture: () => null,
      payCost: () => {},
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
  })

  assert.equal(new BuildingProduction(building).startTrainingWithVillager(villager), true)
  assert.equal(owner.population, 1)
  assert.equal(owner.units.length, 0)
  assert.equal(villagerCell.has, null)
  assert.equal(villagerCell.solid, false)
  assert.equal(building.trainingUnit, null)
  assert.deepEqual(
    calls.find(call => call[0] === 'created'),
    ['created', { i: 2, j: 2, type: 'Axeman' }]
  )
})
