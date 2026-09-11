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
    return requireFromTsFile(request, filename, mocks)
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
    minecopper: 'minecopper',
    mineiron: 'mineiron',
    takemeat: 'takemeat',
    hunt: 'hunt',
    build: 'build',
    farm: 'farm',
    captureHorse: 'captureHorse',
  },
  BUILDING_TYPES: {
    granary: 'Granary',
    storagePit: 'StoragePit',
    townCenter: 'TownCenter',
  },
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    resource: 'resource',
  },
  RESOURCE_TYPES: {
    berrybush: 'Berrybush',
    gold: 'Gold',
    copper: 'Copper',
    iron: 'Iron',
    stone: 'Stone',
    tree: 'Tree',
    wheat: 'Wheat',
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
    horseCapture: 'horseCapture',
  },
}

function loadVillagerAutonomy() {
  return loadModule('app/lib/units/villagerAutonomy.ts', {
    '../playerTargetKnowledge': {
      knowsEconomicTarget: () => false,
      rememberedStaticTargets: () => [],
      playerSeesTarget: (owner, target) => owner.views.isViewed(target.i, target.j),
      knownTarget: (owner, target) =>
        owner.views.isViewed(target.i, target.j)
          ? {
              ...target,
              mature: Boolean(
                target.sprite?.textures?.length && target.sprite.currentFrame >= target.sprite.textures.length - 1
              ),
            }
          : undefined,
    },
    '../constants': constants,
    '../combat': {
      isWheatMature: target => {
        const sprite = target?.sprite
        return Boolean(sprite?.textures?.length && sprite.currentFrame >= sprite.textures.length - 1)
      },
    },
    '../playerState': {
      getGaiaAnimals: gaia => gaia?.animals ?? gaia?.units ?? [],
    },
    '../grid/movement': {
      getInstanceClosestFreeCellPath: (_unit, target) => target.path ?? [],
    },
    '../horses/horseCapture': {
      getNearestAvailableStableForUnit: unit =>
        unit.owner?.buildings?.find(
          building =>
            building.type === 'Stable' &&
            building.isBuilt &&
            !building.isDead &&
            !building.isDestroyed &&
            (building.stableHorses?.length ?? 0) < 5
        ) ?? null,
    },
  })
}

function createOwner(extra = {}) {
  return {
    buildings: [],
    foundedBerrybushs: new Set(),
    age: 2,
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
    sendToTakeMeat(target) {
      this.dest = target
      this.work = constants.WORK_TYPES.hunter
      this.action = constants.ACTION_TYPES.takemeat
    },
    sendToHunt(target) {
      this.dest = target
      this.work = constants.WORK_TYPES.hunter
      this.action = constants.ACTION_TYPES.hunt
    },
    sendToCaptureHorse(target) {
      this.dest = target
      this.work = constants.WORK_TYPES.horseCapture
      this.action = constants.ACTION_TYPES.captureHorse
      return true
    },
    sendToTree(target) {
      this.dest = target
      this.work = constants.WORK_TYPES.woodcutter
      this.action = constants.ACTION_TYPES.chopwood
    },
    sendToStone(target) {
      this.dest = target
      this.work = constants.WORK_TYPES.stoneminer
      this.action = constants.ACTION_TYPES.minestone
    },
    sendToGold(target) {
      this.dest = target
      this.work = constants.WORK_TYPES.goldminer
      this.action = constants.ACTION_TYPES.minegold
    },
    sendToCopper(target) {
      this.dest = target
      this.work = constants.WORK_TYPES.goldminer
      this.action = constants.ACTION_TYPES.minecopper
    },
    sendToIron(target) {
      this.dest = target
      this.work = constants.WORK_TYPES.goldminer
      this.action = constants.ACTION_TYPES.mineiron
    },
    ...extra,
  }
  owner.units.push(villager)
  return villager
}

test('food hunts known living game immediately and switches to meat after the kill', () => {
  const { assignVillagerAutonomy, hasVillagerAutonomyTarget } = loadVillagerAutonomy()
  const deer = { type: 'Deer', family: 'animal', label: 'deer', i: 3, j: 3, hitPoints: 12, quantity: 20 }
  const owner = createOwner({ technologies: [] })
  const unit = createVillager(owner, { context: { map: { gaia: { animals: [deer] } } } })
  assert.equal(hasVillagerAutonomyTarget(unit, 'food'), true)
  assert.equal(assignVillagerAutonomy(unit, 'food'), true)
  assert.equal(unit.action, 'hunt')
  assert.equal(unit.dest, deer)
  assert.equal(unit.autonomousJob, 'food')
  deer.isDead = true
  deer.hitPoints = 0
  assert.equal(assignVillagerAutonomy(unit, 'food'), true)
  assert.equal(unit.action, 'takemeat')
  assert.equal(unit.dest, deer)
})

test('autonomous hunting excludes horses, captured companions and unavailable or unknown game', () => {
  const { hasVillagerAutonomyTarget } = loadVillagerAutonomy()
  for (const patch of [
    { type: 'Horse' },
    { companionOwner: {} },
    { isCatchingPoleCaught: true },
    { isDestroyed: true },
    { quantity: 0 },
    { hitPoints: 0 },
  ]) {
    const animal = { type: 'Deer', family: 'animal', i: 1, j: 1, hitPoints: 10, quantity: 10, ...patch }
    const owner = createOwner({ technologies: ['BowCrafting'], foundedAnimals: new Set([animal]) })
    assert.equal(hasVillagerAutonomyTarget(createVillager(owner), 'food'), false, JSON.stringify(patch))
  }
  const owner = createOwner({ technologies: ['BowCrafting'], views: { isViewed: () => false } })
  const unit = createVillager(owner, {
    context: {
      map: {
        gaia: {
          animals: [{ type: 'Deer', family: 'animal', i: 1, j: 1, hitPoints: 10, quantity: 10, visible: false }],
        },
      },
    },
  })
  assert.equal(hasVillagerAutonomyTarget(unit, 'food'), false)
})

test('Hunter keeps berries available and tries another animal when the first hunt order fails', () => {
  const { assignVillagerAutonomy } = loadVillagerAutonomy()
  const deer = { type: 'Deer', family: 'animal', label: 'deer-1', i: 2, j: 2, hitPoints: 10, quantity: 10 }
  const second = { ...deer, label: 'deer-2', i: 4 }
  const owner = createOwner({ technologies: ['BowCrafting'], foundedAnimals: new Set([deer, second]) })
  const unit = createVillager(owner, {
    sendToHunt(target) {
      if (target === deer) return false
      this.dest = target
      this.action = 'hunt'
      this.work = 'hunter'
    },
  })
  assert.equal(assignVillagerAutonomy(unit, 'food'), true)
  assert.equal(unit.dest, second)
  const berries = { type: 'Berrybush', family: 'resource', label: 'berries', i: 0, j: 0, hitPoints: 10, quantity: 10 }
  owner.foundedBerrybushs.add(berries)
  assert.equal(assignVillagerAutonomy(unit, 'food'), true)
  assert.equal(unit.dest, berries)
})

test('copper and iron autonomy target only the requested ore and issue the matching mining action', () => {
  const { assignVillagerAutonomy } = loadVillagerAutonomy()
  const copper = {
    family: constants.FAMILY_TYPES.resource,
    i: 3,
    isDestroyed: false,
    j: 3,
    label: 'copper-1',
    quantity: 100,
    type: constants.RESOURCE_TYPES.copper,
  }
  const iron = {
    family: constants.FAMILY_TYPES.resource,
    i: 5,
    isDestroyed: false,
    j: 5,
    label: 'iron-1',
    quantity: 100,
    type: constants.RESOURCE_TYPES.iron,
  }
  const owner = createOwner({
    foundedResources: {
      [constants.RESOURCE_TYPES.copper]: new Set([copper]),
      [constants.RESOURCE_TYPES.iron]: new Set([iron]),
    },
  })
  const copperMiner = createVillager(owner)
  const ironMiner = createVillager(owner)

  assert.equal(assignVillagerAutonomy(copperMiner, 'copper'), true)
  assert.equal(copperMiner.dest, copper)
  assert.equal(copperMiner.action, constants.ACTION_TYPES.minecopper)
  assert.equal(copperMiner.autonomousJob, 'copper')

  assert.equal(assignVillagerAutonomy(ironMiner, 'iron'), true)
  assert.equal(ironMiner.dest, iron)
  assert.equal(ironMiner.action, constants.ACTION_TYPES.mineiron)
  assert.equal(ironMiner.autonomousJob, 'iron')
})

test('iron autonomy is blocked until the Bronze Age', () => {
  const { assignVillagerAutonomy, hasVillagerAutonomyTarget } = loadVillagerAutonomy()
  const iron = {
    family: constants.FAMILY_TYPES.resource,
    i: 5,
    isDestroyed: false,
    j: 5,
    label: 'iron-1',
    quantity: 100,
    type: constants.RESOURCE_TYPES.iron,
  }
  const owner = createOwner({
    age: 0,
    foundedResources: {
      [constants.RESOURCE_TYPES.iron]: new Set([iron]),
    },
  })
  const ironMiner = createVillager(owner)

  assert.equal(hasVillagerAutonomyTarget(ironMiner, 'iron'), false)
  assert.equal(assignVillagerAutonomy(ironMiner, 'iron'), false)
  assert.equal(ironMiner.dest, null)
  owner.age = 2
  assert.equal(hasVillagerAutonomyTarget(ironMiner, 'iron'), true)
  assert.equal(assignVillagerAutonomy(ironMiner, 'iron'), true)
  assert.equal(ironMiner.dest, iron)
  assert.equal(ironMiner.action, constants.ACTION_TYPES.mineiron)
})

test('food autonomy treats wheat with an incoming farmer as occupied', () => {
  const { assignVillagerAutonomy } = loadVillagerAutonomy()
  const wheat = {
    family: constants.FAMILY_TYPES.resource,
    i: 1,
    isDead: false,
    isDestroyed: false,
    isUsedBy: null,
    j: 1,
    label: 'wheat-1',
    quantity: 10,
    sprite: { currentFrame: 4, textures: [{}, {}, {}, {}, {}] },
    type: constants.RESOURCE_TYPES.wheat,
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
  const owner = createOwner({
    foundedResources: { [constants.RESOURCE_TYPES.wheat]: new Set([wheat]) },
    foundedBerrybushs: new Set([berry]),
  })
  const first = createVillager(owner)
  const second = createVillager(owner)

  assert.equal(assignVillagerAutonomy(first, 'food'), true)
  assert.equal(assignVillagerAutonomy(second, 'food'), true)

  assert.equal(first.dest, wheat)
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

test('food autonomy prefers a closer visible animal carcass with meat', () => {
  const { assignVillagerAutonomy } = loadVillagerAutonomy()
  const carcass = {
    family: constants.FAMILY_TYPES.animal,
    i: 1,
    isDead: true,
    isDestroyed: false,
    j: 1,
    label: 'deer-carcass-1',
    quantity: 100,
    type: 'Deer',
    visible: true,
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
  const owner = createOwner({ foundedBerrybushs: new Set([berry]) })
  const villager = createVillager(owner, {
    context: { map: { gaia: { animals: [carcass] } } },
  })

  assert.equal(assignVillagerAutonomy(villager, 'food'), true)

  assert.equal(villager.dest, carcass)
  assert.equal(villager.action, constants.ACTION_TYPES.takemeat)
})

test('horse capture autonomy targets a known horse when a stable has room', () => {
  const { assignVillagerAutonomy, hasVillagerAutonomyTarget } = loadVillagerAutonomy()
  const horse = {
    family: constants.FAMILY_TYPES.animal,
    i: 3,
    isDead: false,
    isDestroyed: false,
    j: 3,
    label: 'horse-1',
    type: 'Horse',
  }
  const owner = createOwner({
    buildings: [{ type: 'Stable', isBuilt: true, isDead: false, isDestroyed: false, stableHorses: [] }],
    foundedAnimals: new Set([horse]),
  })
  const villager = createVillager(owner)

  assert.equal(hasVillagerAutonomyTarget(villager, 'horseCapture'), true)
  assert.equal(assignVillagerAutonomy(villager, 'horseCapture'), true)

  assert.equal(villager.dest, horse)
  assert.equal(villager.work, constants.WORK_TYPES.horseCapture)
  assert.equal(villager.action, constants.ACTION_TYPES.captureHorse)
})

test('horse capture autonomy ignores a hero companion horse', () => {
  const { assignVillagerAutonomy, hasVillagerAutonomyTarget } = loadVillagerAutonomy()
  const hero = { label: 'hero-1' }
  const horse = {
    companionOwner: hero,
    family: constants.FAMILY_TYPES.animal,
    i: 3,
    isDead: false,
    isDestroyed: false,
    j: 3,
    label: 'horse-1',
    type: 'Horse',
  }
  const owner = createOwner({
    buildings: [{ type: 'Stable', isBuilt: true, isDead: false, isDestroyed: false, stableHorses: [] }],
    foundedAnimals: new Set([horse]),
  })
  const villager = createVillager(owner)

  assert.equal(hasVillagerAutonomyTarget(villager, 'horseCapture'), false)
  assert.equal(assignVillagerAutonomy(villager, 'horseCapture'), false)
  assert.equal(villager.dest, null)
})

test('horse capture autonomy refuses when no stable can store the horse', () => {
  const { assignVillagerAutonomy, hasVillagerAutonomyTarget } = loadVillagerAutonomy()
  const horse = {
    family: constants.FAMILY_TYPES.animal,
    i: 3,
    isDead: false,
    isDestroyed: false,
    j: 3,
    label: 'horse-1',
    type: 'Horse',
  }
  const owner = createOwner({
    buildings: [
      { type: 'Stable', isBuilt: true, isDead: false, isDestroyed: false, stableHorses: [{}, {}, {}, {}, {}] },
    ],
    foundedAnimals: new Set([horse]),
  })
  const villager = createVillager(owner)

  assert.equal(hasVillagerAutonomyTarget(villager, 'horseCapture'), false)
  assert.equal(assignVillagerAutonomy(villager, 'horseCapture'), false)
  assert.equal(villager.dest, null)
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
  assert.equal(villager.autonomousJob, 'construction')
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

test('resource autonomy can keep a strict job idle without exploring when no target exists', () => {
  const { assignVillagerAutonomy, hasVillagerAutonomyTarget } = loadVillagerAutonomy()
  const owner = createOwner({ foundedResources: { [constants.RESOURCE_TYPES.gold]: new Set() } })
  const villager = createVillager(owner, {
    explored: false,
    explore() {
      this.explored = true
      return true
    },
  })

  assert.equal(hasVillagerAutonomyTarget(villager, 'gold'), false)
  assert.equal(assignVillagerAutonomy(villager, 'gold', { exploreWhenNoTarget: false }), false)
  assert.equal(villager.explored, false)
  assert.equal(villager.autonomousJob, 'gold')
  assert.equal(villager.dest, null)
  assert.equal(villager.action, null)
})

test('resource autonomy keeps the job stopped when no target or exploration route exists', () => {
  const { assignVillagerAutonomy, hasVillagerAutonomyTarget } = loadVillagerAutonomy()
  const owner = createOwner({ foundedTrees: new Set() })
  const villager = createVillager(owner, {
    autonomousJob: 'wood',
    explored: false,
    explore() {
      this.explored = true
      return false
    },
  })

  assert.equal(hasVillagerAutonomyTarget(villager, 'wood'), false)
  assert.equal(assignVillagerAutonomy(villager, 'wood'), false)
  assert.equal(villager.explored, true)
  assert.equal(villager.autonomousJob, 'wood')
  assert.equal(villager.dest, null)
  assert.equal(villager.action, null)
  assert.equal(villager.inactif, true)
})

test('resource autonomy tries the next known target when the closest order is rejected', () => {
  const { assignVillagerAutonomy } = loadVillagerAutonomy()
  const blockedTree = {
    family: constants.FAMILY_TYPES.resource,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'tree-blocked',
    quantity: 50,
    type: constants.RESOURCE_TYPES.tree,
  }
  const reachableTree = {
    family: constants.FAMILY_TYPES.resource,
    i: 4,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'tree-reachable',
    quantity: 50,
    type: constants.RESOURCE_TYPES.tree,
  }
  const owner = createOwner({
    foundedResources: { [constants.RESOURCE_TYPES.tree]: new Set([blockedTree, reachableTree]) },
  })
  const attempts = []
  const villager = createVillager(owner, {
    sendToTree(target) {
      attempts.push(target.label)
      if (target === blockedTree) return false
      this.dest = target
      this.work = constants.WORK_TYPES.woodcutter
      this.action = constants.ACTION_TYPES.chopwood
      return true
    },
  })

  assert.equal(assignVillagerAutonomy(villager, 'wood'), true)

  assert.deepEqual(attempts, ['tree-blocked', 'tree-reachable'])
  assert.equal(villager.dest, reachableTree)
  assert.equal(villager.autonomousJob, 'wood')
})

test('resource autonomy skips known targets without a contact path before sending orders', () => {
  const { assignVillagerAutonomy } = loadVillagerAutonomy()
  const blockedTree = {
    family: constants.FAMILY_TYPES.resource,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'tree-no-path',
    path: [],
    quantity: 50,
    type: constants.RESOURCE_TYPES.tree,
  }
  const reachableTree = {
    family: constants.FAMILY_TYPES.resource,
    i: 4,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'tree-path',
    path: [{ i: 1, j: 1 }],
    quantity: 50,
    type: constants.RESOURCE_TYPES.tree,
  }
  const owner = createOwner({
    foundedResources: { [constants.RESOURCE_TYPES.tree]: new Set([blockedTree, reachableTree]) },
  })
  const attempts = []
  const villager = createVillager(owner, {
    context: { map: { grid: [[]] } },
    sendToTree(target) {
      attempts.push(target.label)
      this.dest = target
      this.work = constants.WORK_TYPES.woodcutter
      this.action = constants.ACTION_TYPES.chopwood
      return true
    },
  })

  assert.equal(assignVillagerAutonomy(villager, 'wood'), true)

  assert.deepEqual(attempts, ['tree-path'])
  assert.equal(villager.dest, reachableTree)
})

test('resource autonomy scores real path length ahead of raw distance', () => {
  const { assignVillagerAutonomy } = loadVillagerAutonomy()
  const closeTreeWithLongPath = {
    family: constants.FAMILY_TYPES.resource,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'tree-close-long-path',
    path: Array.from({ length: 12 }, (_, i) => ({ i, j: 0 })),
    quantity: 50,
    type: constants.RESOURCE_TYPES.tree,
  }
  const fartherTreeWithShortPath = {
    family: constants.FAMILY_TYPES.resource,
    i: 5,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'tree-far-short-path',
    path: [
      { i: 1, j: 1 },
      { i: 2, j: 1 },
    ],
    quantity: 50,
    type: constants.RESOURCE_TYPES.tree,
  }
  const owner = createOwner({
    foundedResources: { [constants.RESOURCE_TYPES.tree]: new Set([closeTreeWithLongPath, fartherTreeWithShortPath]) },
  })
  const villager = createVillager(owner, {
    context: { map: { grid: [[]] } },
  })

  assert.equal(assignVillagerAutonomy(villager, 'wood'), true)

  assert.equal(villager.dest, fartherTreeWithShortPath)
})

test('resource autonomy explores after every known resource target is rejected', () => {
  const { assignVillagerAutonomy } = loadVillagerAutonomy()
  const stone = {
    family: constants.FAMILY_TYPES.resource,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'stone-blocked',
    quantity: 50,
    type: constants.RESOURCE_TYPES.stone,
  }
  const owner = createOwner({
    foundedResources: { [constants.RESOURCE_TYPES.stone]: new Set([stone]) },
  })
  const villager = createVillager(owner, {
    explored: false,
    explore() {
      this.explored = true
      return true
    },
    sendToStone() {
      return false
    },
  })

  assert.equal(assignVillagerAutonomy(villager, 'stone'), true)

  assert.equal(villager.explored, true)
  assert.equal(villager.autonomousJob, 'stone')
})

test('food autonomy tries the next known food target when the closest order is rejected', () => {
  const { assignVillagerAutonomy } = loadVillagerAutonomy()
  const blockedBerry = {
    family: constants.FAMILY_TYPES.resource,
    i: 1,
    isDestroyed: false,
    j: 0,
    label: 'berry-blocked',
    quantity: 250,
    type: constants.RESOURCE_TYPES.berrybush,
  }
  const reachableBerry = {
    family: constants.FAMILY_TYPES.resource,
    i: 4,
    isDestroyed: false,
    j: 0,
    label: 'berry-reachable',
    quantity: 250,
    type: constants.RESOURCE_TYPES.berrybush,
  }
  const owner = createOwner({ foundedBerrybushs: new Set([blockedBerry, reachableBerry]) })
  const attempts = []
  const villager = createVillager(owner, {
    sendToBerrybush(target) {
      attempts.push(target.label)
      if (target === blockedBerry) return false
      this.dest = target
      this.work = constants.WORK_TYPES.forager
      this.action = constants.ACTION_TYPES.forageberry
      return true
    },
  })

  assert.equal(assignVillagerAutonomy(villager, 'food'), true)

  assert.deepEqual(attempts, ['berry-blocked', 'berry-reachable'])
  assert.equal(villager.dest, reachableBerry)
  assert.equal(villager.autonomousJob, 'food')
})

test('villager autonomy does not assign work during sleep time', () => {
  const { assignVillagerAutonomy } = loadVillagerAutonomy()
  const tree = {
    family: constants.FAMILY_TYPES.resource,
    i: 2,
    isDestroyed: false,
    j: 0,
    label: 'tree-1',
    quantity: 250,
    type: constants.RESOURCE_TYPES.tree,
  }
  const owner = createOwner({
    foundedResources: { [constants.RESOURCE_TYPES.tree]: new Set([tree]) },
  })
  const attempts = []
  const villager = createVillager(owner, {
    context: { dayNight: { state: { hour: 23 } } },
    sendToTree(target) {
      attempts.push(target.label)
      this.dest = target
      this.work = constants.WORK_TYPES.woodcutter
      this.action = constants.ACTION_TYPES.chopwood
      return true
    },
  })

  assert.equal(assignVillagerAutonomy(villager, 'wood'), false)
  assert.deepEqual(attempts, [])
  assert.equal(villager.autonomousJob, null)
  assert.equal(villager.dest, null)
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

test('construction autonomy repairs own damaged completed buildings', () => {
  const { assignVillagerAutonomy, hasVillagerAutonomyTarget } = loadVillagerAutonomy()
  const owner = createOwner()
  const damagedBuilding = {
    family: constants.FAMILY_TYPES.building,
    hitPoints: 60,
    i: 4,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 4,
    label: 'damaged-house',
    owner,
    totalHitPoints: 100,
    type: 'House',
  }
  owner.buildings.push(damagedBuilding)
  const villager = createVillager(owner)

  assert.equal(hasVillagerAutonomyTarget(villager, 'construction'), true)
  assert.equal(assignVillagerAutonomy(villager, 'construction'), true)
  assert.equal(villager.dest, damagedBuilding)
  assert.equal(villager.action, constants.ACTION_TYPES.build)
})

test('runtime reconciliation resumes real food selection after restore and resource depletion', () => {
  const autonomy = loadVillagerAutonomy()
  const recovery = loadModule('app/lib/units/villagerTaskRecovery.ts', {
    './villagerAutonomy': autonomy,
    './villagerAutonomyTargeting': { getAutonomyJobForWork: () => null },
  })
  const { VillagerAutonomySystem } = loadModule('app/services/VillagerAutonomySystem.ts', {
    '../constants': constants,
    '../lib/units/villagerAutonomy': autonomy,
    '../lib/units/villagerTaskRecovery': recovery,
    '../lib/units/villagerAutonomyTargeting': { markVillagerAutonomyTargetRejected() {} },
  })
  const owner = createOwner()
  const berries = { family: 'resource', type: 'Berrybush', label: 'berries-1', i: 2, j: 2, quantity: 10 }
  owner.foundedBerrybushs.add(berries)
  const context = {
    dayNight: { state: { hour: 12, minute: 0 } },
    players: [owner],
    scheduler: { elapsedMs: 0, add: () => 1, remove() {} },
  }
  const unit = createVillager(owner, { context, autonomousJob: 'food', action: null, path: [], inactif: true })
  const system = new VillagerAutonomySystem(context)
  context.scheduler.elapsedMs = 1000
  system.update()
  assert.equal(unit.dest, berries)
  assert.equal(unit.action, 'forageberry')
  const replacement = { ...berries, label: 'berries-2', i: 4 }
  berries.quantity = 0
  owner.foundedBerrybushs.add(replacement)
  context.scheduler.elapsedMs = 2000
  system.update()
  assert.equal(unit.dest, replacement)
  assert.equal(unit.autonomousJob, 'food')
  system.destroy()
})

test('food search retries after failure and collects newly discovered food on the next scheduled check', () => {
  const { assignVillagerAutonomy } = loadVillagerAutonomy()
  const tasks = []
  let explored = 0
  const owner = createOwner()
  const villager = createVillager(owner, {
    context: {
      scheduler: {
        addOneShot(callback, delay) {
          tasks.push({ callback, delay })
          return tasks.length
        },
        remove() {},
      },
    },
    explore() {
      explored++
      return false
    },
  })
  assert.equal(assignVillagerAutonomy(villager, 'food'), false)
  assert.equal(explored, 1)
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].delay, 2000)
  tasks[0].callback()
  assert.equal(explored, 2)
  assert.equal(tasks.length, 2)
  const berries = {
    family: constants.FAMILY_TYPES.resource,
    type: constants.RESOURCE_TYPES.berrybush,
    i: 5,
    j: 5,
    quantity: 10,
    hitPoints: 10,
  }
  owner.foundedBerrybushs.add(berries)
  tasks[1].callback()
  assert.equal(explored, 2)
  assert.equal(villager.dest, berries)
  assert.equal(villager.action, constants.ACTION_TYPES.forageberry)
  assert.equal(tasks.length, 2)
})
