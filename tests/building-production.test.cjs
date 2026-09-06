const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

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
    if (request === './BuildingTraineeTraining') {
      return loadModule('app/classes/building/BuildingTraineeTraining.ts', mocks)
    }
    if (request === './BuildingProductionPlacement') {
      return loadModule('app/classes/building/BuildingProductionPlacement.ts', mocks)
    }
    if (request === './BuildingTechnologyProduction') {
      return loadModule('app/classes/building/BuildingTechnologyProduction.ts', mocks)
    }
    if (request === '../../lib/chief') {
      return {
        hasLivingChief: () => true,
        playerNeedsChiefForCommand: () => false,
      }
    }
    if (request === '../../lib/horses/stableHorses') {
      return {
        getStableHorseAmount: building => building.stableHorses?.length ?? 0,
        consumeStableHorse: building => building.stableHorses?.shift?.() ?? null,
        returnStableHorse: (building, horse) => {
          if (!horse) return
          building.stableHorses = building.stableHorses ?? []
          building.stableHorses.unshift(horse)
        },
      }
    }
    if (request === '../../lib/entities/entityFade') {
      return {
        fadeOut: (entity, _duration, onComplete) => {
          entity.alpha = 0
          onComplete?.()
        },
      }
    }
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const buildingTrainingMock = {
  getBuildingTrainingLoad: building => {
    const active = building.loading != null || building.trainingUnit ? 1 : 0
    const queued = Math.max(0, (building.queue?.length ?? 0) - active)
    const incoming =
      building.owner?.units?.filter(
        unit => unit.dest === building && Boolean(unit.trainingTargetType) && !unit.isDead && !unit.isDestroyed
      ).length ?? 0
    return active + queued + incoming
  },
  hasBuildingTrainingCapacity: (building, { excludeUnit = null } = {}) => {
    const active = building.loading != null || building.trainingUnit ? 1 : 0
    const queued = Math.max(0, (building.queue?.length ?? 0) - active)
    const incoming =
      building.owner?.units?.filter(
        unit =>
          unit !== excludeUnit &&
          unit.dest === building &&
          Boolean(unit.trainingTargetType) &&
          !unit.isDead &&
          !unit.isDestroyed
      ).length ?? 0
    return active + queued + incoming < 5
  },
  canUnitTrainInto: () => true,
  getMissingResourceNames: (owner, cost = {}) =>
    Object.keys(cost).filter(resource => owner[resource] < (cost[resource] ?? 0)),
  isTraineeTrainingType: (_building, type) => type !== 'Villager',
}

test('rally point on a resource just moves the spawned unit to the cell', () => {
  const spawnCell = { i: 1, j: 1, category: 'Land', solid: false }
  const tree = { family: 'resource', category: 'Tree', type: 'Tree', isDestroyed: false }
  const rallyCell = { i: 2, j: 2, category: 'Land', solid: false, has: tree }
  const calls = []
  const unit = {
    sendToTree() {
      throw new Error('did not expect the resource-specific command to be used')
    },
    sendTo(target) {
      calls.push([this, target])
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
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })

  assert.equal(new BuildingProduction(building).placeUnit('Villager'), true)

  assert.equal(calls[0][0], 'created')
  assert.deepEqual(calls[0][1], { i: 1, j: 1, type: 'Villager' })
  assert.deepEqual(calls[1], [unit, rallyCell])
})

test('produced units do not spawn on reserved passage cells', () => {
  const passageCell = { i: 1, j: 0, category: 'Land', solid: false, reservedPassage: true }
  const spawnCell = { i: 0, j: 1, category: 'Land', solid: false }
  const calls = []
  const building = {
    i: 0,
    j: 0,
    size: 1,
    rallyPoint: null,
    context: {
      map: {
        grid: [
          [null, spawnCell],
          [passageCell, null],
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
        calls.push(options)
        return { sendTo() {} }
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
      getFreeLandCellAroundInstance: (_instance, _grid, pickRandomItem, extraCondition) => {
        const candidates = [passageCell, spawnCell].filter(cell => !extraCondition || extraCondition(cell))
        return pickRandomItem(candidates)
      },
      getTexture: () => null,
      payCost: () => {},
      refundCost: () => {},
    },
    '../../lib/buildings/passageCells': {
      createNonReservedPassageCellCondition: () => cell => !cell?.reservedPassage,
      createReservedPassageCellLookup: () => ({
        has: cell => Boolean(cell?.reservedPassage),
        size: 1,
      }),
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })

  assert.equal(new BuildingProduction(building).placeUnit('Villager'), true)
  assert.deepEqual(calls, [{ i: 0, j: 1, type: 'Villager' }])
})

test('military unit purchase from a building no longer auto-picks a trainee', () => {
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
          Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingDays: 27 },
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
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })

  assert.equal(new BuildingProduction(building).buyUnit('Fantassin'), false)
  assert.equal(building.trainingUnit, undefined)
  assert.equal(building.trainingType, undefined)
  assert.equal(building.isUsedBy, undefined)
  assert.equal(villager.trainingTargetType, undefined)
  assert.equal(building.owner.food, 50)
  assert.deepEqual(
    calls.filter(call => call[0] === 'created'),
    []
  )
  assert.equal(
    calls.find(call => call[0] === 'sendToEvt'),
    undefined
  )
})

test('stable unit purchase from a building no longer auto-picks a mounted trainee', () => {
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
          Bowman: { category: 'Archer', cost: { food: 40, wood: 20 }, trainingDays: 27 },
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
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })

  assert.equal(new BuildingProduction(building).buyUnit('Bowman'), false)
  assert.equal(building.trainingUnit, undefined)
  assert.equal(building.trainingType, undefined)
  assert.equal(building.isUsedBy, undefined)
  assert.equal(bowman.trainingTargetType, undefined)
  assert.equal(building.owner.food, 60)
  assert.equal(building.owner.wood, 30)
  assert.deepEqual(
    calls.filter(call => call[0] === 'created'),
    []
  )
  assert.equal(
    calls.find(call => call[0] === 'sendToEvt'),
    undefined
  )
})

test('temple priest purchase from a building no longer auto-picks a villager', () => {
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
          Priest: { category: 'Civilian', cost: { gold: 125 }, trainingDays: 50 },
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
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })

  assert.equal(new BuildingProduction(building).buyUnit('Priest'), false)
  assert.equal(building.trainingUnit, undefined)
  assert.equal(building.trainingType, undefined)
  assert.equal(building.isUsedBy, undefined)
  assert.equal(villager.trainingTargetType, undefined)
  assert.equal(building.owner.gold, 125)
  assert.equal(building.owner.population, 1)
  assert.deepEqual(
    calls.filter(call => call[0] === 'created'),
    []
  )
  assert.equal(
    calls.find(call => call[0] === 'sendToEvt'),
    undefined
  )
})

test('military training starts with the first explicitly ordered trainee to enter', () => {
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
          Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingDays: 27 },
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
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })

  const production = new BuildingProduction(building)
  villagerA.trainingTargetType = 'Fantassin'
  villagerB.trainingTargetType = 'Fantassin'
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

test('arrived trainee enters a busy training building queue instead of waiting outside', () => {
  const calls = []
  const activeTrainee = {
    type: 'Villager',
    label: 'villager-a',
    owner: null,
  }
  const queuedTrainee = {
    type: 'Villager',
    label: 'villager-b',
    context: null,
    trainingTargetType: 'Fantassin',
    owner: null,
    isDead: false,
    isDestroyed: false,
    controlMode: null,
    path: [{ i: 1, j: 1 }],
    currentCell: {
      has: null,
      solid: false,
    },
    stopInterval: () => calls.push(['stopInterval']),
    stopTimeout: () => calls.push(['stopTimeout']),
    unselect: () => calls.push(['unselect']),
    destroy: options => calls.push(['destroy', options]),
  }
  queuedTrainee.currentCell.has = queuedTrainee
  const owner = {
    food: 100,
    population: 2,
    populationMax: 10,
    selectedUnits: [],
    units: [activeTrainee, queuedTrainee],
    config: {
      units: {
        Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingDays: 27 },
      },
    },
    isPlayed: true,
  }
  activeTrainee.owner = owner
  queuedTrainee.owner = owner
  const building = {
    type: 'Barracks',
    isBuilt: true,
    isDead: false,
    queue: ['Fantassin'],
    trainingQueue: [],
    loading: 50,
    trainingUnit: activeTrainee,
    trainingType: 'Fantassin',
    technology: null,
    units: ['Fantassin'],
    context: {
      map: {
        removeFromInstanceBucket: target => calls.push(['removeFromInstanceBucket', target.label]),
        removeChild: target => calls.push(['removeChild', target.label]),
      },
      menu: {
        getHeroBuildingMenuTarget: () => building,
        refreshHeroBuildingMenu: () => calls.push(['refreshHeroBuildingMenu']),
        updateTopbar: () => calls.push(['topbar']),
        updateButtonContent: (target, value) => calls.push(['button', target, value]),
      },
    },
    owner,
    updateTrainingPreview: () => calls.push(['preview']),
  }
  queuedTrainee.context = building.context

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
      payCost: (targetOwner, cost = {}) => {
        for (const [key, amount] of Object.entries(cost)) targetOwner[key] -= amount
      },
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })

  assert.equal(new BuildingProduction(building).startTrainingWithUnit(queuedTrainee), true)
  assert.deepEqual(building.queue, ['Fantassin', 'Fantassin'])
  assert.equal(building.trainingQueue.length, 1)
  assert.equal(building.trainingQueue[0].trainee, queuedTrainee)
  assert.equal(building.trainingQueue[0].type, 'Fantassin')
  assert.equal(owner.units.includes(queuedTrainee), false)
  assert.equal(owner.food, 65)
  assert.deepEqual(
    calls.find(call => call[0] === 'button'),
    ['button', 'Fantassin', 2]
  )
  assert.deepEqual(
    calls.find(call => call[0] === 'removeFromInstanceBucket'),
    ['removeFromInstanceBucket', 'villager-b']
  )
})

test('per-unit cancellation no longer owns pending trainee orders', () => {
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
          Bowman: { category: 'Archer', cost: { food: 40, wood: 20 }, trainingDays: 27 },
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
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })

  assert.equal(new BuildingProduction(building).cancelUnits('Bowman'), false)
  assert.equal(building.trainingUnit, undefined)
  assert.equal(building.trainingType, undefined)
  assert.equal(bowman.trainingTargetType, 'Bowman')
  assert.equal(building.owner.food, 60)
  assert.equal(building.owner.wood, 30)
  assert.equal(
    calls.find(call => call[0] === 'affectNewDest'),
    undefined
  )
  assert.equal(
    calls.find(call => call[0] === 'toggleCancel'),
    undefined
  )
})

test('cancelling stable mount training restores the original unmounted soldier', () => {
  const calls = []
  const spawnCell = { i: 4, j: 5, category: 'Land', solid: false }
  const trainee = {
    type: 'Fantassin',
    name: 'Aias',
    gender: 'male',
    mountedOnHorse: false,
    speed: 1,
    experience: { attack: 3 },
  }
  const owner = {
    food: 10,
    population: 1,
    populationMax: 10,
    units: [],
    config: {
      units: {
        Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingDays: 2 },
      },
    },
    createUnit: options => {
      calls.push(['createUnit', options])
      return options
    },
    getUnitExtraOptions: () => ({ appearanceVariants: { body: 'default' } }),
    isPlayed: true,
  }
  const building = {
    type: 'Stable',
    i: 3,
    j: 4,
    size: 2,
    isBuilt: true,
    isDead: false,
    stableHorses: [],
    queue: ['Fantassin'],
    trainingQueue: [
      {
        type: 'Fantassin',
        trainee,
        extra: { mountedOnHorse: true, horseColor: 'dark' },
        cost: {},
        trainingDayChangeUnsubscribe: () => calls.push(['unsubscribe']),
      },
    ],
    loading: 40,
    trainingUnit: trainee,
    trainingType: 'Fantassin',
    trainingStartedDay: 1,
    trainingCompleteDay: 3,
    technology: null,
    units: ['Fantassin'],
    context: {
      map: {
        grid: [[spawnCell]],
        randomItem: items => items[0],
      },
      menu: {
        getHeroBuildingMenuTarget: () => building,
        refreshHeroBuildingMenu: () => calls.push(['refreshHeroBuildingMenu']),
        updateTopbar: () => calls.push(['topbar']),
        updateButtonContent: (target, value) => calls.push(['button', target, value]),
      },
    },
    owner,
    updateTrainingPreview: () => calls.push(['preview', building.loading]),
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
      payCost: () => {},
      refundCost: () => calls.push(['refund']),
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })

  assert.equal(new BuildingProduction(building).cancelAllUnitTraining(), true)

  assert.deepEqual(building.queue, [])
  assert.equal(building.loading, null)
  assert.equal(building.trainingUnit, null)
  assert.equal(building.trainingType, null)
  assert.deepEqual(building.stableHorses, [{ horseColor: 'dark', tamingStatus: 'tamed' }])
  assert.deepEqual(
    calls.filter(call => call[0] === 'createUnit'),
    [
      [
        'createUnit',
        {
          i: 4,
          j: 5,
          type: 'Fantassin',
          appearanceVariants: { body: 'default' },
          name: 'Aias',
          gender: 'male',
          experience: { attack: 3 },
          speed: 1,
        },
      ],
    ]
  )
  assert.equal(
    calls.some(call => call[0] === 'createUnit' && call[1].mountedOnHorse),
    false
  )
  assert.ok(calls.some(call => call[0] === 'preview' && call[1] === null))
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
        Bowman: { category: 'Archer', cost: { food: 40, wood: 20 }, trainingDays: 1 },
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
      dayNight: {
        state: { day: 1 },
        onDayChange(callback) {
          this.callback = callback
          return () => {
            this.callback = null
          }
        },
      },
      menu: {
        updateTopbar() {},
        updateButtonContent() {},
        toggleQueuedActionCancel() {},
      },
    },
    owner,
    stopInterval() {},
    updateTrainingPreview() {
      calls.push(['preview', this.loading])
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
    '../../lib/buildings/buildingTraining': {
      canUnitTrainInto: (buildingType, unitType, targetType) => true,
      getMissingResourceNames: () => [],
      hasBuildingTrainingCapacity: () => true,
      isTraineeTrainingType: () => true,
    },
  })

  assert.equal(new BuildingProduction(building).startTrainingWithUnit(bowman), true)
  assert.deepEqual(calls, [['preview', 0]])
  building.context.dayNight.state.day = 2
  building.context.dayNight.callback()
  assert.deepEqual(calls, [
    ['preview', 0],
    ['preview', null],
    ['preview', null],
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
        Bowman: { category: 'Archer', cost: { food: 40, wood: 20 }, trainingDays: 27 },
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
    '../../lib/buildings/buildingTraining': {
      canUnitTrainInto: () => true,
      getMissingResourceNames: () => ['food', 'wood'],
      hasBuildingTrainingCapacity: () => true,
      isTraineeTrainingType: () => true,
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
          Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingDays: 27 },
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
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })

  assert.equal(new BuildingProduction(building).cancelUnits('Fantassin'), false)
  assert.deepEqual(building.queue, ['Fantassin'])
  assert.equal(building.loading, 12)
  assert.equal(building.owner.food, 15)
})

test('global unit training cancellation clears active and queued production', () => {
  const calls = []
  const owner = {
    food: 0,
    wood: 0,
    population: 1,
    populationMax: 10,
    selectedUnits: [],
    units: [],
    config: {
      units: {
        Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingDays: 2 },
        Bowman: { category: 'Archer', cost: { food: 40, wood: 20 }, trainingDays: 2 },
      },
    },
    isPlayed: true,
  }
  const pending = {
    type: 'Villager',
    dest: null,
    trainingTargetType: 'Bowman',
    owner,
    isDead: false,
    affectNewDest() {
      calls.push(['affectNewDest'])
    },
  }
  const building = {
    type: 'Barracks',
    i: 0,
    j: 0,
    size: 1,
    isBuilt: true,
    isDead: false,
    queue: ['Fantassin', 'Bowman'],
    loading: 50,
    trainingStartedDay: 1,
    trainingCompleteDay: 3,
    trainingDayChangeUnsubscribe() {
      calls.push(['unsubscribe'])
    },
    technology: null,
    units: ['Fantassin', 'Bowman'],
    context: {
      map: { instantMode: false },
      menu: {
        getHeroBuildingMenuTarget: () => building,
        refreshHeroBuildingMenu: () => calls.push(['refreshHeroBuildingMenu']),
        updateTopbar: () => calls.push(['topbar']),
        updateButtonContent: (target, value) => calls.push(['button', target, value]),
        toggleQueuedActionCancel: (target, value) => calls.push(['toggleCancel', target, value]),
      },
    },
    owner,
    updateTrainingPreview() {
      calls.push(['preview', this.loading])
    },
  }
  pending.dest = building
  owner.units.push(pending)

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
      refundCost: (targetOwner, cost = {}) => {
        for (const [key, amount] of Object.entries(cost)) targetOwner[key] += amount
      },
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })

  assert.equal(new BuildingProduction(building).cancelAllUnitTraining(), true)
  assert.deepEqual(building.queue, [])
  assert.equal(building.loading, null)
  assert.equal(building.trainingStartedDay, null)
  assert.equal(building.trainingCompleteDay, null)
  assert.equal(pending.trainingTargetType, null)
  assert.equal(owner.food, 75)
  assert.equal(owner.wood, 20)
  assert.deepEqual(
    calls.filter(call => call[0] === 'unsubscribe'),
    [['unsubscribe']]
  )
  assert.deepEqual(
    calls.filter(call => call[0] === 'affectNewDest'),
    [['affectNewDest']]
  )
})

test('training building wakes the next waiting trainee when it becomes free', () => {
  const calls = []
  const owner = {
    food: 100,
    population: 1,
    populationMax: 10,
    units: [],
    config: {
      units: {
        Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingDays: 2 },
      },
    },
    isPlayed: false,
  }
  const waiting = {
    type: 'Villager',
    dest: null,
    trainingTargetType: 'Fantassin',
    owner,
    isDead: false,
    isDestroyed: false,
    isUnitAtDest: () => true,
    getAction: action => calls.push(['getAction', action]),
    sendToEvt: () => calls.push(['sendToEvt']),
  }
  const building = {
    type: 'Barracks',
    isBuilt: true,
    isDead: false,
    queue: [],
    loading: null,
    trainingUnit: null,
    technology: null,
    units: ['Fantassin'],
    context: {
      map: { instantMode: false },
      menu: {},
    },
    owner,
  }
  waiting.dest = building
  owner.units.push(waiting)

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
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })

  new BuildingProduction(building).wakeNextWaitingTrainee()

  assert.deepEqual(calls, [['getAction', 'train']])
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
        Fantassin: { category: 'Fantassin', cost: { food: 50 }, trainingDays: 2 },
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
    gender: 'female',
    hitPoints: 32,
    speed: 1.2,
    experience: { combat: 12 },
    appearanceVariants: { gender: 'female' },
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
    mountingDays: 1,
    isBuilt: true,
    isDead: false,
    queue: [],
    loading: null,
    technology: null,
    units: ['Fantassin'],
    stableHorses: [{ horseColor: 'dark' }],
    context: { map, menu: {} },
    owner,
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
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })

  assert.equal(new BuildingProduction(building).startTrainingWithUnit(clubman), true)
  assert.equal(owner.food, 50)
  assert.equal(owner.population, 3)
  assert.equal(
    calls.some(call => call[0] === 'intervalDelay'),
    false
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
        gender: 'female',
        appearanceVariants: { gender: 'female' },
        mountedOnHorse: true,
        horseColor: 'dark',
        hitPoints: 32,
        speed: 1.65,
        experience: { combat: 12 },
      },
    ]
  )
})

test('empty stable checks horse stock when the trainee enters, not when ordered', () => {
  const calls = []
  const owner = {
    food: 50,
    population: 3,
    populationMax: 10,
    selectedUnits: [],
    units: [],
    isPlayed: true,
    config: {
      units: {
        Bowman: { category: 'Bowman', cost: { food: 50 }, trainingDays: 27 },
      },
    },
  }
  const bowman = {
    type: 'Bowman',
    owner,
    context: {},
    sendToEvt(target, action, options) {
      calls.push(['sendToEvt', target.type, action, options])
    },
  }
  owner.units.push(bowman)
  const building = {
    type: 'Stable',
    isBuilt: true,
    isDead: false,
    queue: [],
    loading: null,
    technology: null,
    units: ['Bowman'],
    stableHorses: [],
    context: {
      menu: {
        showMessage(message, type) {
          calls.push(['message', message, type])
        },
        updateButtonContent() {},
        toggleQueuedActionCancel() {},
      },
    },
    owner,
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
      canAfford: () => true,
      changeSpriteColorDirectly: () => {},
      getActionCondition: () => false,
      getBuildingAsset: () => null,
      getFreeLandCellAroundInstance: () => null,
      getTexture: () => null,
      payCost: () => {},
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })
  const production = new BuildingProduction(building)

  bowman.trainingTargetType = 'Bowman'
  bowman.sendToEvt(building, 'train', { forceRepath: true, allowPassageStop: true })
  assert.equal(bowman.trainingTargetType, 'Bowman')
  assert.deepEqual(calls, [['sendToEvt', 'Stable', 'train', { forceRepath: true, allowPassageStop: true }]])

  assert.equal(production.startTrainingWithUnit(bowman), false)
  assert.equal(bowman.trainingTargetType, null)
  assert.deepEqual(calls.slice(1), [['message', 'stableNeedsHorse', 'warning']])
})

test('chief requirement for trainee training is checked when the unit enters', () => {
  const calls = []
  const owner = {
    food: 50,
    population: 3,
    populationMax: 10,
    selectedUnits: [],
    units: [],
    isPlayed: true,
    config: {
      units: {
        Fantassin: { category: 'Fantassin', cost: { food: 50 }, trainingDays: 27 },
      },
    },
  }
  const trainee = {
    type: 'Fantassin',
    owner,
    context: {},
    sendToEvt(target, action, options) {
      calls.push(['sendToEvt', target.type, action, options])
    },
  }
  owner.selectedUnits.push(trainee)
  owner.units.push(trainee)
  const building = {
    type: 'Barracks',
    isBuilt: true,
    isDead: false,
    queue: [],
    loading: null,
    technology: null,
    units: ['Fantassin'],
    context: {
      menu: {
        showMessage(message, type) {
          calls.push(['message', message, type])
        },
        updateButtonContent() {},
        toggleQueuedActionCancel() {},
      },
    },
    owner,
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
      canAfford: () => true,
      changeSpriteColorDirectly: () => {},
      getActionCondition: () => false,
      getBuildingAsset: () => null,
      getFreeLandCellAroundInstance: () => null,
      getTexture: () => null,
      payCost: () => {},
      refundCost: () => {},
    },
    '../../lib/chief': {
      hasLivingChief: () => false,
      playerNeedsChiefForCommand: () => true,
    },
    '../../lib/lang': {
      t: key => key,
    },
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
  })
  const production = new BuildingProduction(building)

  trainee.trainingTargetType = 'Fantassin'
  assert.equal(trainee.trainingTargetType, 'Fantassin')

  assert.equal(production.startTrainingWithUnit(trainee), false)
  assert.equal(trainee.trainingTargetType, null)
  assert.deepEqual(calls, [['message', 'requiresChief', 'warning']])
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
        Bowman: { category: 'Archer', cost: { food: 40, wood: 20 }, trainingDays: 27 },
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
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
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
    ['created', { i: 2, j: 2, type: 'Bowman', name: 'Damon', mountedOnHorse: true, speed: 1.6, experience: {} }]
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
        Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingDays: 27 },
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
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
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
        Fantassin: { category: 'Fantassin', cost: { food: 35 }, trainingDays: 27 },
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
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
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

test('villagers cannot be bought from building production anymore', () => {
  const calls = []
  const building = {
    isBuilt: true,
    isDead: false,
    queue: [],
    loading: null,
    context: {
      dayNight: { state: { day: 1 }, onDayChange: () => () => {} },
      menu: {
        updateTopbar: () => calls.push('topbar'),
        updateButtonContent: () => calls.push('button'),
      },
    },
    owner: {
      config: {
        units: {
          Villager: { cost: { food: 50 }, trainingDays: 1 },
        },
      },
      isPlayed: true,
      population: 1,
      populationMax: 10,
    },
  }
  const { BuildingProduction } = loadModule('app/classes/building/BuildingProduction.ts', {
    'pixi.js': { Assets: {} },
    '../../constants': {
      ACTION_TYPES: { train: 'train' },
      BUILDING_TYPES: {},
      FAMILY_TYPES: {},
      POPULATION_MAX: 200,
      UNIT_TYPES: { villager: 'Villager' },
    },
    '../../lib': {
      canAfford: () => true,
      isAIControlledPlayer: () => false,
      payCost: () => calls.push('pay'),
      refundCost: () => {},
    },
    '../../lib/buildings/buildingTraining': buildingTrainingMock,
    '../../lib/lang': { t: key => key },
    '../../lib/training/unitTrainingCost': { getUnitTrainingCost: () => ({ food: 50 }) },
  })
  const production = new BuildingProduction(building)

  assert.equal(production.buyUnit('Villager'), false)
  assert.deepEqual(building.queue, [])
  assert.deepEqual(calls, [])
})
