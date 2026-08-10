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
    if (request === '../../lib/chief') {
      return {
        hasLivingChief: () => true,
        playerNeedsChiefForCommand: () => false,
      }
    }
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const buildingTrainingMock = {
  canUnitTrainInto: () => true,
  getMissingResourceNames: (owner, cost = {}) =>
    Object.keys(cost).filter(resource => owner[resource] < (cost[resource] ?? 0)),
  isTraineeTrainingType: (_building, type) => type !== 'Villager',
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
      BUILDING_TYPES: { temple: 'Temple' },
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
      getFreeLandCellAroundInstance: () => spawnCell,
      getTexture: () => null,
      payCost: () => {},
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildingTraining': buildingTrainingMock,
    '../../lib/unitUpgrades': {
      canUpgradeUnitAtBuilding: () => false,
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
    units: ['Fantassin'],
    context: {
      map: { instantMode: false },
      menu: {
        updateTopbar() {
          calls.push(['topbar'])
        },
        updateActionTarget() {
          calls.push(['editorPanel'])
        },
        updateButtonContent(target, value) {
          calls.push(['buttonContent', target, value])
        },
        toggleQueuedActionCancel(target, value) {
          calls.push(['toggleCancel', target, value])
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
          Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingTime: 27 },
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
      BUILDING_TYPES: { temple: 'Temple' },
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
      getFreeLandCellAroundInstance: () => null,
      getTexture: () => null,
      payCost: (owner, cost = {}) => {
        for (const [key, amount] of Object.entries(cost)) owner[key] -= amount
      },
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildingTraining': buildingTrainingMock,
    '../../lib/unitUpgrades': {
      canUpgradeUnitAtBuilding: () => false,
    },
  })

  assert.equal(new BuildingProduction(building).buyUnit('Fantassin'), true)
  assert.equal(building.trainingUnit, undefined)
  assert.equal(building.trainingType, undefined)
  assert.equal(building.isUsedBy, undefined)
  assert.equal(villager.trainingTargetType, 'Fantassin')
  assert.equal(building.owner.food, 50)
  assert.deepEqual(
    calls.filter(call => call[0] === 'created'),
    []
  )
  assert.deepEqual(
    calls.find(call => call[0] === 'sendToEvt'),
    ['sendToEvt', 'Barracks', 'train']
  )
})

test('military unit purchase can reserve compatible trainee training', () => {
  const calls = []
  const bowman = {
    type: 'Bowman',
    inactif: true,
    sendToEvt(target, action) {
      calls.push(['sendToEvt', target.type, action])
      this.dest = target
      this.action = action
    },
  }
  const building = {
    type: 'Stable',
    i: 0,
    j: 0,
    size: 1,
    isBuilt: true,
    isDead: false,
    queue: [],
    loading: null,
    technology: null,
    units: ['Bowman'],
    context: {
      map: { instantMode: false },
      menu: {
        updateTopbar() {
          calls.push(['topbar'])
        },
        updateActionTarget() {
          calls.push(['editorPanel'])
        },
        updateButtonContent(target, value) {
          calls.push(['buttonContent', target, value])
        },
        toggleQueuedActionCancel(target, value) {
          calls.push(['toggleCancel', target, value])
        },
        showMessage(message) {
          calls.push(['message', message])
        },
      },
    },
    owner: {
      food: 60,
      wood: 30,
      population: 1,
      populationMax: 10,
      selectedUnits: [bowman],
      units: [bowman],
      config: {
        units: {
          Bowman: { category: 'Archer', cost: { food: 40, wood: 20 }, trainingTime: 27 },
        },
      },
      createUnit(options) {
        calls.push(['created', options])
      },
      isPlayed: true,
    },
  }
  bowman.owner = building.owner

  const { BuildingProduction } = loadModule('app/classes/building/BuildingProduction.ts', {
    'pixi.js': { Assets: {} },
    '../../constants': {
      ACTION_TYPES: { train: 'train' },
      BUILDING_TYPES: { temple: 'Temple' },
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
      getFreeLandCellAroundInstance: () => null,
      getTexture: () => null,
      payCost: (owner, cost = {}) => {
        for (const [key, amount] of Object.entries(cost)) owner[key] -= amount
      },
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildingTraining': buildingTrainingMock,
    '../../lib/unitUpgrades': {
      canUpgradeUnitAtBuilding: (buildingType, unitType, targetType) =>
        buildingType === 'Stable' && unitType === 'Bowman' && targetType === 'Bowman',
    },
  })

  assert.equal(new BuildingProduction(building).buyUnit('Bowman'), true)
  assert.equal(building.trainingUnit, undefined)
  assert.equal(building.trainingType, undefined)
  assert.equal(building.isUsedBy, undefined)
  assert.equal(bowman.trainingTargetType, 'Bowman')
  assert.equal(building.owner.food, 60)
  assert.equal(building.owner.wood, 30)
  assert.deepEqual(
    calls.filter(call => call[0] === 'created'),
    []
  )
  assert.deepEqual(
    calls.find(call => call[0] === 'sendToEvt'),
    ['sendToEvt', 'Stable', 'train']
  )
})

test('temple priest training reserves and sends an existing villager instead of spawning directly', () => {
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
    type: 'Temple',
    i: 0,
    j: 0,
    size: 1,
    isBuilt: true,
    isDead: false,
    queue: [],
    loading: null,
    technology: null,
    units: ['Priest'],
    context: {
      map: { instantMode: false },
      menu: {
        updateTopbar() {
          calls.push(['topbar'])
        },
        updateActionTarget() {
          calls.push(['editorPanel'])
        },
        updateButtonContent(target, value) {
          calls.push(['buttonContent', target, value])
        },
        toggleQueuedActionCancel(target, value) {
          calls.push(['toggleCancel', target, value])
        },
        showMessage(message) {
          calls.push(['message', message])
        },
      },
    },
    owner: {
      gold: 125,
      population: 1,
      populationMax: 1,
      selectedUnits: [villager],
      units: [villager],
      config: {
        units: {
          Priest: { category: 'Civilian', cost: { gold: 125 }, trainingTime: 50 },
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
      BUILDING_TYPES: { temple: 'Temple' },
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
      UNIT_TYPES: { priest: 'Priest', villager: 'Villager' },
    },
    '../../lib': {
      canAfford: (owner, cost = {}) => Object.entries(cost).every(([key, amount]) => owner[key] >= amount),
      changeSpriteColorDirectly: () => {},
      getActionCondition: () => false,
      getBuildingAsset: () => null,
      getFreeLandCellAroundInstance: () => null,
      getTexture: () => null,
      payCost: (owner, cost = {}) => {
        for (const [key, amount] of Object.entries(cost)) owner[key] -= amount
      },
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildingTraining': buildingTrainingMock,
    '../../lib/unitUpgrades': {
      canUpgradeUnitAtBuilding: () => false,
    },
  })

  assert.equal(new BuildingProduction(building).buyUnit('Priest'), true)
  assert.equal(building.trainingUnit, undefined)
  assert.equal(building.trainingType, undefined)
  assert.equal(building.isUsedBy, undefined)
  assert.equal(villager.trainingTargetType, 'Priest')
  assert.equal(building.owner.gold, 125)
  assert.equal(building.owner.population, 1)
  assert.deepEqual(
    calls.filter(call => call[0] === 'created'),
    []
  )
  assert.deepEqual(
    calls.find(call => call[0] === 'sendToEvt'),
    ['sendToEvt', 'Temple', 'train']
  )
})

test('military training is first arrived first served', () => {
  const calls = []
  const villagerA = {
    type: 'Villager',
    inactif: true,
    sendToEvt(target, action) {
      calls.push(['sendToEvt', 'A', target.type, action])
      this.dest = target
      this.action = action
    },
  }
  const villagerB = {
    type: 'Villager',
    inactif: true,
    sendToEvt(target, action) {
      calls.push(['sendToEvt', 'B', target.type, action])
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
    units: ['Fantassin'],
    context: {
      map: { instantMode: false },
      menu: {
        updateTopbar() {},
        updateActionTarget() {},
        updateButtonContent() {},
        toggleQueuedActionCancel() {},
        showMessage(message) {
          calls.push(['message', message])
        },
      },
    },
    owner: {
      food: 70,
      population: 2,
      populationMax: 10,
      selectedUnits: [villagerA],
      units: [villagerA, villagerB],
      config: {
        units: {
          Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingTime: 27 },
        },
      },
      isPlayed: true,
    },
  }
  villagerA.owner = building.owner
  villagerB.owner = building.owner

  const { BuildingProduction } = loadModule('app/classes/building/BuildingProduction.ts', {
    'pixi.js': { Assets: {} },
    '../../constants': {
      ACTION_TYPES: { train: 'train' },
      BUILDING_TYPES: { temple: 'Temple' },
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
      getFreeLandCellAroundInstance: () => null,
      getTexture: () => null,
      payCost: (owner, cost = {}) => {
        for (const [key, amount] of Object.entries(cost)) owner[key] -= amount
      },
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildingTraining': buildingTrainingMock,
    '../../lib/unitUpgrades': {
      canUpgradeUnitAtBuilding: () => false,
    },
  })

  const production = new BuildingProduction(building)
  assert.equal(production.buyUnit('Fantassin'), true)
  building.owner.selectedUnits = [villagerB]
  assert.equal(production.buyUnit('Fantassin'), true)
  assert.equal(building.trainingUnit, undefined)
  assert.equal(villagerA.trainingTargetType, 'Fantassin')
  assert.equal(villagerB.trainingTargetType, 'Fantassin')

  building.startInterval = () => {}
  assert.equal(production.startTrainingWithUnit(villagerB), true)
  assert.equal(building.trainingUnit, villagerB)
  assert.equal(building.trainingType, 'Fantassin')
  assert.equal(building.owner.food, 35)
  assert.equal(villagerA.trainingTargetType, 'Fantassin')
})

test('military training reservation can be cancelled before the unit enters the building', () => {
  const calls = []
  const bowman = {
    type: 'Bowman',
    inactif: true,
    trainingTargetType: 'Bowman',
    affectNewDest() {
      calls.push(['affectNewDest'])
    },
  }
  const building = {
    type: 'Stable',
    i: 0,
    j: 0,
    size: 1,
    isBuilt: true,
    isDead: false,
    queue: [],
    loading: null,
    technology: null,
    units: ['Bowman'],
    context: {
      map: { instantMode: false },
      menu: {
        updateButtonContent(target, value) {
          calls.push(['buttonContent', target, value])
        },
        toggleQueuedActionCancel(target, value) {
          calls.push(['toggleCancel', target, value])
        },
        updateActionTarget() {
          calls.push(['editorPanel'])
        },
      },
    },
    owner: {
      food: 60,
      wood: 30,
      population: 1,
      populationMax: 10,
      selectedUnits: [bowman],
      units: [bowman],
      config: {
        units: {
          Bowman: { category: 'Archer', cost: { food: 40, wood: 20 }, trainingTime: 27 },
        },
      },
      isPlayed: true,
    },
  }
  bowman.owner = building.owner
  bowman.dest = building

  const { BuildingProduction } = loadModule('app/classes/building/BuildingProduction.ts', {
    'pixi.js': { Assets: {} },
    '../../constants': {
      ACTION_TYPES: { train: 'train' },
      BUILDING_TYPES: { temple: 'Temple' },
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
      getFreeLandCellAroundInstance: () => null,
      getTexture: () => null,
      payCost: () => {},
      refundCost: () => {
        throw new Error('reservation cancellation should not refund unpaid resources')
      },
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildingTraining': buildingTrainingMock,
    '../../lib/unitUpgrades': {
      canUpgradeUnitAtBuilding: (buildingType, unitType, targetType) =>
        buildingType === 'Stable' && unitType === 'Bowman' && targetType === 'Bowman',
    },
  })

  assert.equal(new BuildingProduction(building).cancelUnits('Bowman'), true)
  assert.equal(building.trainingUnit, undefined)
  assert.equal(building.trainingType, undefined)
  assert.equal(bowman.trainingTargetType, null)
  assert.equal(building.owner.food, 60)
  assert.equal(building.owner.wood, 30)
  assert.deepEqual(
    calls.find(call => call[0] === 'affectNewDest'),
    ['affectNewDest']
  )
  assert.deepEqual(
    calls.find(call => call[0] === 'toggleCancel'),
    ['toggleCancel', 'Bowman', false]
  )
})

test('trainee training updates loading even when the building is not classically selected', () => {
  const calls = []
  const owner = {
    food: 40,
    wood: 20,
    population: 1,
    populationMax: 1,
    selectedUnits: [],
    units: [],
    config: {
      units: {
        Bowman: { category: 'Archer', cost: { food: 40, wood: 20 }, trainingTime: 27 },
      },
    },
    isPlayed: true,
  }
  const bowman = {
    type: 'Bowman',
    trainingTargetType: 'Bowman',
    owner,
    context: { map: { removeFromInstanceBucket() {}, removeChild() {} } },
    path: [],
    stopInterval() {},
    stopTimeout() {},
    unselect() {},
    destroy() {},
  }
  owner.units.push(bowman)
  const building = {
    type: 'Stable',
    i: 0,
    j: 0,
    size: 1,
    isBuilt: true,
    isDead: false,
    selected: false,
    queue: [],
    loading: null,
    technology: null,
    units: ['Bowman'],
    context: {
      map: { instantMode: false },
      menu: {
        updateTopbar() {},
        updateButtonContent() {},
        toggleQueuedActionCancel() {},
      },
    },
    owner,
    startInterval(callback) {
      callback()
    },
    stopInterval() {},
    updateInterfaceLoading() {
      calls.push(['loading', this.loading])
    },
  }

  const { BuildingProduction } = loadModule('app/classes/building/BuildingProduction.ts', {
    'pixi.js': { Assets: {} },
    '../../constants': {
      ACTION_TYPES: { train: 'train' },
      BUILDING_TYPES: { temple: 'Temple' },
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
      UNIT_TYPES: { priest: 'Priest', villager: 'Villager' },
    },
    '../../lib': {
      canAfford: (owner, cost = {}) => Object.entries(cost).every(([key, amount]) => owner[key] >= amount),
      changeSpriteColorDirectly: () => {},
      getActionCondition: () => false,
      getBuildingAsset: () => null,
      getFreeLandCellAroundInstance: () => null,
      getTexture: () => null,
      payCost: (owner, cost = {}) => {
        for (const [key, amount] of Object.entries(cost)) owner[key] -= amount
      },
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildingTraining': {
      canUnitTrainInto: (buildingType, unitType, targetType) => true,
      getMissingResourceNames: () => [],
      isTraineeTrainingType: () => true,
    },
    '../../lib/unitUpgrades': {
      canUpgradeUnitAtBuilding: (buildingType, unitType, targetType) =>
        buildingType === 'Stable' && unitType === 'Bowman' && targetType === 'Bowman',
    },
  })

  assert.equal(new BuildingProduction(building).startTrainingWithUnit(bowman), true)
  assert.deepEqual(calls, [
    ['loading', 0],
    ['loading', 1],
  ])
})

test('missing resources for trainee training list the exact resources', () => {
  const calls = []
  const owner = {
    food: 10,
    wood: 0,
    population: 1,
    populationMax: 1,
    selectedUnits: [],
    units: [],
    config: {
      units: {
        Bowman: { category: 'Archer', cost: { food: 40, wood: 20 }, trainingTime: 27 },
      },
    },
    isPlayed: true,
  }
  const bowman = {
    type: 'Bowman',
    trainingTargetType: 'Bowman',
    owner,
  }
  owner.units.push(bowman)
  const building = {
    type: 'Stable',
    queue: [],
    loading: null,
    technology: null,
    units: ['Bowman'],
    context: {
      menu: {
        showMessage(message, level) {
          calls.push(['message', message, level])
        },
        updateTopbar() {
          calls.push(['topbar'])
        },
      },
    },
    owner,
  }

  const { BuildingProduction } = loadModule('app/classes/building/BuildingProduction.ts', {
    'pixi.js': { Assets: {} },
    '../../constants': {
      ACTION_TYPES: { train: 'train' },
      BUILDING_TYPES: { temple: 'Temple' },
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
      UNIT_TYPES: { priest: 'Priest', villager: 'Villager' },
    },
    '../../lib': {
      canAfford: (owner, cost = {}) => Object.entries(cost).every(([key, amount]) => owner[key] >= amount),
      changeSpriteColorDirectly: () => {},
      getActionCondition: () => false,
      getBuildingAsset: () => null,
      getFreeLandCellAroundInstance: () => null,
      getTexture: () => null,
      payCost: () => {},
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: (key, vars = {}) => (key === 'needMore' ? `needMore:${vars.resource}` : key),
    },
    '../../lib/buildingTraining': {
      canUnitTrainInto: () => true,
      getMissingResourceNames: () => ['food', 'wood'],
      isTraineeTrainingType: () => true,
    },
    '../../lib/unitUpgrades': {
      canUpgradeUnitAtBuilding: () => true,
    },
  })

  assert.equal(new BuildingProduction(building).startTrainingWithUnit(bowman), false)
  assert.deepEqual(calls[0], ['message', 'needMore:food, wood', 'warning'])
})

test('active military training cannot be cancelled after the unit entered the building', () => {
  const building = {
    type: 'Barracks',
    queue: ['Fantassin'],
    loading: 12,
    units: ['Fantassin'],
    owner: {
      food: 15,
      config: {
        units: {
          Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingTime: 27 },
        },
      },
      isPlayed: false,
    },
    context: { menu: {} },
  }

  const { BuildingProduction } = loadModule('app/classes/building/BuildingProduction.ts', {
    'pixi.js': { Assets: {} },
    '../../constants': {
      ACTION_TYPES: { train: 'train' },
      BUILDING_TYPES: { temple: 'Temple' },
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
      getFreeLandCellAroundInstance: () => null,
      getTexture: () => null,
      payCost: () => {},
      refundCost: () => {
        throw new Error('active military training should not refund a consumed trainee')
      },
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildingTraining': buildingTrainingMock,
    '../../lib/unitUpgrades': {
      canUpgradeUnitAtBuilding: () => false,
    },
  })

  assert.equal(new BuildingProduction(building).cancelUnits('Fantassin'), false)
  assert.deepEqual(building.queue, ['Fantassin'])
  assert.equal(building.loading, 12)
  assert.equal(building.owner.food, 15)
})

test('stable training remounts the same unit type without charging unit cost or population', () => {
  const calls = []
  const spawnCell = { i: 2, j: 2, category: 'Land', solid: false }
  const owner = {
    food: 50,
    population: 3,
    populationMax: 10,
    selectedUnits: [],
    units: [],
    config: {
      units: {
        Fantassin: { category: 'Fantassin', cost: { food: 50 }, trainingTime: 27 },
      },
    },
    createUnit(options) {
      calls.push(['created', options])
      return { sendTo() {} }
    },
    isPlayed: false,
  }
  const map = {
    instantMode: true,
    grid: [[spawnCell]],
    randomItem: items => items[0],
    removeFromInstanceBucket(unit) {
      calls.push(['bucketRemoved', unit.type])
    },
    removeChild(unit) {
      calls.push(['removed', unit.type])
    },
  }
  const cell = { i: 1, j: 1, category: 'Land', solid: true, has: null }
  const clubman = {
    type: 'Fantassin',
    name: 'Alexios',
    hitPoints: 32,
    speed: 1.2,
    experience: { combat: 12 },
    trainingTargetType: 'Fantassin',
    owner,
    context: { map },
    currentCell: cell,
    path: [],
    stopInterval() {},
    stopTimeout() {},
    unselect() {},
    destroy() {
      calls.push(['destroyed', this.type])
    },
  }
  cell.has = clubman
  owner.units.push(clubman)
  const building = {
    type: 'Stable',
    i: 0,
    j: 0,
    size: 1,
    mountingTime: 20,
    isBuilt: true,
    isDead: false,
    queue: [],
    loading: null,
    technology: null,
    units: ['Fantassin'],
    context: { map, menu: {} },
    owner,
    startInterval(callback, delay) {
      calls.push(['intervalDelay', delay])
      callback()
    },
    stopInterval() {
      calls.push(['stopInterval'])
    },
  }

  const { BuildingProduction } = loadModule('app/classes/building/BuildingProduction.ts', {
    'pixi.js': { Assets: {} },
    '../../constants': {
      ACTION_TYPES: { train: 'train' },
      BUILDING_TYPES: { stable: 'Stable', temple: 'Temple' },
      FAMILY_TYPES: {
        animal: 'animal',
        building: 'building',
        resource: 'resource',
        unit: 'unit',
      },
      LABEL_TYPES: {},
      MENU_INFO_IDS: { populationText: 'populationText' },
      MOUNTED_HORSE_SPEED_BONUS: 0.45,
      PLAYER_TYPES: { ai: 'AI' },
      POPULATION_MAX: 200,
      UNIT_TYPES: { villager: 'Villager' },
    },
    '../../lib': {
      canAfford: (owner, cost = {}) => Object.entries(cost).every(([key, amount]) => owner[key] >= amount),
      changeSpriteColorDirectly: () => {},
      getActionCondition: () => false,
      getBuildingAsset: () => null,
      getFreeLandCellAroundInstance: () => spawnCell,
      getTexture: () => null,
      payCost: (targetOwner, cost = {}) => {
        for (const [key, amount] of Object.entries(cost)) targetOwner[key] -= amount
      },
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildingTraining': buildingTrainingMock,
    '../../lib/unitUpgrades': {
      canUpgradeUnitAtBuilding: () => true,
    },
  })

  assert.equal(new BuildingProduction(building).startTrainingWithUnit(clubman), true)
  assert.equal(owner.food, 50)
  assert.equal(owner.population, 3)
  assert.deepEqual(
    calls.find(call => call[0] === 'intervalDelay'),
    ['intervalDelay', 20]
  )
  assert.deepEqual(
    calls.find(call => call[0] === 'created'),
    [
      'created',
      {
        i: 2,
        j: 2,
        type: 'Fantassin',
        name: 'Alexios',
        mountedOnHorse: true,
        hitPoints: 32,
        speed: 1.65,
        experience: { combat: 12 },
      },
    ]
  )
})

test('arrived trainee unit is consumed and trained unit reuses the same population slot', () => {
  const spawnCell = { i: 2, j: 2, category: 'Land', solid: false }
  const calls = []
  const owner = {
    food: 60,
    wood: 30,
    population: 1,
    populationMax: 1,
    selectedUnits: [],
    units: [],
    config: {
      units: {
        Bowman: { category: 'Archer', cost: { food: 40, wood: 20 }, trainingTime: 27 },
      },
    },
    createUnit(options) {
      calls.push(['created', options])
      return { ...options, owner }
    },
    isPlayed: false,
  }
  const bowmanCell = { i: 1, j: 1, category: 'Land', solid: true, has: null }
  const map = {
    instantMode: true,
    grid: [
      [null, null, null],
      [null, bowmanCell, null],
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
  const bowman = {
    type: 'Bowman',
    name: 'Damon',
    mountedOnHorse: true,
    speed: 1.6,
    trainingTargetType: 'Bowman',
    owner,
    context: { map },
    currentCell: bowmanCell,
    path: [],
    stopInterval() {},
    stopTimeout() {},
    unselect() {},
    destroy() {
      calls.push(['destroyed', this.type])
    },
  }
  bowmanCell.has = bowman
  owner.units.push(bowman)
  const building = {
    type: 'Stable',
    i: 0,
    j: 0,
    size: 1,
    isBuilt: true,
    isDead: false,
    queue: [],
    loading: null,
    technology: null,
    units: ['Bowman'],
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
      BUILDING_TYPES: { temple: 'Temple' },
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
      getFreeLandCellAroundInstance: () => spawnCell,
      getTexture: () => null,
      payCost: (owner, cost = {}) => {
        for (const [key, amount] of Object.entries(cost)) owner[key] -= amount
      },
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildingTraining': buildingTrainingMock,
    '../../lib/unitUpgrades': {
      canUpgradeUnitAtBuilding: (buildingType, unitType, targetType) =>
        buildingType === 'Stable' && unitType === 'Bowman' && targetType === 'Bowman',
    },
  })

  assert.equal(new BuildingProduction(building).startTrainingWithUnit(bowman), true)
  assert.equal(owner.population, 1)
  assert.equal(owner.food, 20)
  assert.equal(owner.wood, 10)
  assert.equal(owner.units.length, 0)
  assert.equal(bowmanCell.has, null)
  assert.equal(bowmanCell.solid, false)
  assert.equal(building.trainingUnit, null)
  assert.deepEqual(
    calls.find(call => call[0] === 'created'),
    [
      'created',
      { i: 2, j: 2, type: 'Bowman', name: 'Damon', mountedOnHorse: true, speed: 1.6, experience: {} },
    ]
  )
})

test('failed trainee placement clears active military training state', () => {
  const calls = []
  const owner = {
    food: 35,
    population: 1,
    populationMax: 1,
    selectedUnits: [],
    units: [],
    config: {
      units: {
        Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingTime: 27 },
      },
    },
    createUnit() {
      throw new Error('no spawn cell means no unit should be created')
    },
    isPlayed: false,
  }
  const villagerCell = { i: 1, j: 1, category: 'Land', solid: true, has: null }
  const map = {
    instantMode: true,
    grid: [[villagerCell]],
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
    name: 'Damon',
    trainingTargetType: 'Fantassin',
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
    units: ['Fantassin'],
    context: { map, menu: {} },
    owner,
    startInterval(callback) {
      callback()
    },
    stopInterval() {
      calls.push(['stopInterval'])
    },
  }

  const { BuildingProduction } = loadModule('app/classes/building/BuildingProduction.ts', {
    'pixi.js': { Assets: {} },
    '../../constants': {
      ACTION_TYPES: { train: 'train' },
      BUILDING_TYPES: { temple: 'Temple' },
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
      getFreeLandCellAroundInstance: () => null,
      getTexture: () => null,
      payCost: (owner, cost = {}) => {
        for (const [key, amount] of Object.entries(cost)) owner[key] -= amount
      },
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildingTraining': buildingTrainingMock,
    '../../lib/unitUpgrades': {
      canUpgradeUnitAtBuilding: () => false,
    },
  })

  assert.equal(new BuildingProduction(building).startTrainingWithUnit(villager), true)
  assert.equal(building.loading, null)
  assert.deepEqual(building.queue, [])
  assert.equal(building.trainingUnit, null)
  assert.equal(building.trainingType, null)
  assert.equal(building.isUsedBy, null)
  assert.equal(owner.food, 0)
})

test('arrived villager is consumed and trained unit reuses the same population slot', () => {
  const spawnCell = { i: 2, j: 2, category: 'Land', solid: false }
  const calls = []
  const owner = {
    food: 35,
    population: 1,
    populationMax: 1,
    selectedUnits: [],
    units: [],
    config: {
      units: {
        Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingTime: 27 },
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
    name: 'Damon',
    trainingTargetType: 'Fantassin',
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
    units: ['Fantassin'],
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
      BUILDING_TYPES: { temple: 'Temple' },
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
      getFreeLandCellAroundInstance: () => spawnCell,
      getTexture: () => null,
      payCost: (owner, cost = {}) => {
        for (const [key, amount] of Object.entries(cost)) owner[key] -= amount
      },
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildingTraining': buildingTrainingMock,
    '../../lib/unitUpgrades': {
      canUpgradeUnitAtBuilding: () => false,
    },
  })

  assert.equal(new BuildingProduction(building).startTrainingWithUnit(villager), true)
  assert.equal(owner.population, 1)
  assert.equal(owner.food, 0)
  assert.equal(owner.units.length, 0)
  assert.equal(villagerCell.has, null)
  assert.equal(villagerCell.solid, false)
  assert.equal(building.trainingUnit, null)
  assert.deepEqual(
    calls.find(call => call[0] === 'created'),
    ['created', { i: 2, j: 2, type: 'Fantassin', name: 'Damon', experience: {} }]
  )
})
