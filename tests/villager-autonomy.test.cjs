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

const constants = {
  ACTION_TYPES: {
    chopwood: 'chopwood',
    forageberry: 'forageberry',
    minestone: 'minestone',
    minegold: 'minegold',
    build: 'build',
    farm: 'farm',
  },
  BUILDING_TYPES: {
    farm: 'Farm',
  },
  FAMILY_TYPES: {
    building: 'building',
    resource: 'resource',
  },
  RESOURCE_TYPES: {
    berrybush: 'Berrybush',
    gold: 'Gold',
    stone: 'Stone',
    tree: 'Tree',
  },
  UNIT_TYPES: {
    villager: 'Villager',
  },
  WORK_TYPES: {
    builder: 'builder',
    farmer: 'farmer',
    forager: 'forager',
    goldminer: 'goldminer',
    stoneminer: 'stoneminer',
    woodcutter: 'woodcutter',
    hunter: 'hunter',
  },
}

function loadVillagerAutonomy() {
  return loadModule('app/lib/villagerAutonomy.ts', {
    '../constants': constants,
  })
}

function createOwner(extra = {}) {
  return {
    buildings: [],
    foundedBerrybushs: new Set(),
    units: [],
    views: { isViewed: () => true },
    ...extra,
  }
}

function createVillager(owner, extra = {}) {
  const villager = {
    autonomousJob: null,
    dest: null,
    i: 0,
    isDead: false,
    isDestroyed: false,
    j: 0,
    owner,
    getActionCondition: () => true,
    type: constants.UNIT_TYPES.villager,
    sendToBerrybush(target) {
      this.dest = target
      this.work = constants.WORK_TYPES.forager
      this.action = constants.ACTION_TYPES.forageberry
    },
    sendToFarm(target) {
      this.dest = target
      this.work = constants.WORK_TYPES.farmer
      this.action = constants.ACTION_TYPES.farm
    },
    sendToBuilding(target) {
      this.dest = target
      this.work = constants.WORK_TYPES.builder
      this.action = constants.ACTION_TYPES.build
    },
    ...extra,
  }
  owner.units.push(villager)
  return villager
}

test('food autonomy treats a farm with an incoming farmer as occupied', () => {
  const { assignVillagerAutonomy } = loadVillagerAutonomy()
  const farm = {
    family: constants.FAMILY_TYPES.building,
    i: 1,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    isUsedBy: null,
    j: 1,
    label: 'farm-1',
    quantity: 250,
    type: constants.BUILDING_TYPES.farm,
  }
  const berry = {
    family: constants.FAMILY_TYPES.resource,
    i: 4,
    isDestroyed: false,
    j: 4,
    label: 'berry-1',
    quantity: 250,
    type: constants.RESOURCE_TYPES.berrybush,
  }
  const owner = createOwner({ buildings: [farm], foundedBerrybushs: new Set([berry]) })
  const first = createVillager(owner)
  const second = createVillager(owner)

  assert.equal(assignVillagerAutonomy(first, 'food'), true)
  assert.equal(assignVillagerAutonomy(second, 'food'), true)

  assert.equal(first.dest, farm)
  assert.equal(second.dest, berry)
})

test('food autonomy does not recursively resume while assigning an order', () => {
  const { assignVillagerAutonomy, resumeVillagerAutonomy } = loadVillagerAutonomy()
  const berry = {
    family: constants.FAMILY_TYPES.resource,
    i: 4,
    isDestroyed: false,
    j: 4,
    label: 'berry-1',
    quantity: 250,
    type: constants.RESOURCE_TYPES.berrybush,
  }
  const owner = createOwner({ foundedBerrybushs: new Set([berry]) })
  const villager = createVillager(owner, {
    resumeAttempts: 0,
    sendToBerrybush(target) {
      this.dest = target
      this.resumeAttempts += 1
      assert.equal(resumeVillagerAutonomy(this), false)
      this.work = constants.WORK_TYPES.forager
      this.action = constants.ACTION_TYPES.forageberry
    },
  })

  assert.equal(assignVillagerAutonomy(villager, 'food'), true)
  assert.equal(villager.dest, berry)
  assert.equal(villager.resumeAttempts, 1)
  assert.equal(villager.assigningAutonomousJob, false)
})

test('construction autonomy does not explore when there is no construction target', () => {
  const { assignVillagerAutonomy, hasVillagerAutonomyTarget } = loadVillagerAutonomy()
  const owner = createOwner()
  const villager = createVillager(owner, {
    autonomousJob: 'food',
    explored: false,
    explore() {
      this.explored = true
      return true
    },
  })

  assert.equal(hasVillagerAutonomyTarget(villager, 'construction'), false)
  assert.equal(assignVillagerAutonomy(villager, 'construction'), false)
  assert.equal(villager.explored, false)
  assert.equal(villager.autonomousJob, null)
})

test('resource autonomy explores when the requested resource is unknown', () => {
  const { assignVillagerAutonomy, hasVillagerAutonomyTarget } = loadVillagerAutonomy()
  const owner = createOwner({ foundedTrees: new Set() })
  const villager = createVillager(owner, {
    explored: false,
    explore() {
      this.explored = true
      return true
    },
  })

  assert.equal(hasVillagerAutonomyTarget(villager, 'wood'), false)
  assert.equal(assignVillagerAutonomy(villager, 'wood'), true)
  assert.equal(villager.explored, true)
  assert.equal(villager.autonomousJob, 'wood')
})

test('construction autonomy only targets own unfinished buildings', () => {
  const { assignVillagerAutonomy, hasVillagerAutonomyTarget } = loadVillagerAutonomy()
  const owner = createOwner()
  const otherOwner = createOwner()
  const otherBuilding = {
    family: constants.FAMILY_TYPES.building,
    i: 1,
    isBuilt: false,
    isDead: false,
    isDestroyed: false,
    j: 1,
    label: 'other-house',
    owner: otherOwner,
    type: 'House',
  }
  const ownBuilding = {
    family: constants.FAMILY_TYPES.building,
    i: 4,
    isBuilt: false,
    isDead: false,
    isDestroyed: false,
    j: 4,
    label: 'own-house',
    owner,
    type: 'House',
  }
  owner.buildings.push(otherBuilding)
  const villager = createVillager(owner)

  assert.equal(hasVillagerAutonomyTarget(villager, 'construction'), false)
  assert.equal(assignVillagerAutonomy(villager, 'construction'), false)

  owner.buildings.push(ownBuilding)
  assert.equal(hasVillagerAutonomyTarget(villager, 'construction'), true)
  assert.equal(assignVillagerAutonomy(villager, 'construction'), true)
  assert.equal(villager.dest, ownBuilding)
})
