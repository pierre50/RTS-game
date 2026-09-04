const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadTrainingOrders() {
  return loadTsModule('app/lib/units/unitTrainingOrders.ts', {
    '../../constants': {
      ACTION_TYPES: { train: 'train' },
      BUILDING_TYPES: { stable: 'Stable', temple: 'Temple' },
      UNIT_TYPES: { bowman: 'Bowman', infantry: 'Fantassin', priest: 'Priest', villager: 'Villager' },
    },
    '../buildings/buildingTraining': {
      canUnitTrainInto: (building, unit, type) =>
        building.units?.includes(type) &&
        (type !== 'Priest' || building.type === 'Temple') &&
        (building.type !== 'Stable' || unit.type === type),
      getBuildingTrainingLoad: building => {
        const active = building.loading != null || building.trainingUnit ? 1 : 0
        const queued = Math.max(0, (building.queue?.length ?? 0) - active)
        const incoming =
          building.owner?.units?.filter(
            unit => unit.dest === building && Boolean(unit.trainingTargetType) && !unit.isDead && !unit.isDestroyed
          ).length ?? 0
        return active + queued + incoming
      },
      hasBuildingTrainingCapacity: building => {
        const active = building.loading != null || building.trainingUnit ? 1 : 0
        const queued = Math.max(0, (building.queue?.length ?? 0) - active)
        const incoming =
          building.owner?.units?.filter(
            unit => unit.dest === building && Boolean(unit.trainingTargetType) && !unit.isDead && !unit.isDestroyed
          ).length ?? 0
        return active + queued + incoming < 5
      },
    },
    '../lang': { t: key => key },
  })
}

function createOwner(buildings) {
  return {
    buildings,
    config: {
      units: {
        Bowman: { category: 'Archer' },
        Fantassin: { category: 'Fantassin' },
        Villager: { category: 'Civilian' },
      },
    },
    isPlayed: true,
    label: 'player-1',
    units: [],
  }
}

test('unit training order picks the lower loaded building before distance', () => {
  const { findBestTrainingBuildingForUnit, sendUnitToTraining } = loadTrainingOrders()
  const busyBarracks = {
    family: 'building',
    i: 1,
    isBuilt: true,
    j: 0,
    loading: 10,
    owner: null,
    queue: ['Fantassin'],
    type: 'Barracks',
    units: ['Fantassin'],
  }
  const freeBarracks = {
    family: 'building',
    i: 10,
    isBuilt: true,
    j: 0,
    loading: null,
    owner: null,
    queue: [],
    type: 'Barracks',
    units: ['Fantassin'],
  }
  const owner = createOwner([busyBarracks, freeBarracks])
  busyBarracks.owner = owner
  freeBarracks.owner = owner
  const villager = {
    context: { menu: { showMessage() {} } },
    family: 'unit',
    i: 0,
    j: 0,
    owner,
    sendToEvt(target, action, options) {
      this.sent = { target, action, options }
    },
    type: 'Villager',
  }
  owner.units.push(villager)

  assert.equal(findBestTrainingBuildingForUnit(villager, 'Fantassin'), freeBarracks)
  assert.equal(sendUnitToTraining(villager, 'Fantassin'), true)
  assert.equal(villager.trainingTargetType, 'Fantassin')
  assert.deepEqual(villager.sent, {
    target: freeBarracks,
    action: 'train',
    options: { forceRepath: true, allowPassageStop: true },
  })
})

test('unit training order fills one training building up to five units', () => {
  const { findBestTrainingBuildingForUnit, sendUnitToTraining } = loadTrainingOrders()
  const barracks = {
    family: 'building',
    i: 1,
    isBuilt: true,
    j: 0,
    loading: null,
    owner: null,
    queue: [],
    type: 'Barracks',
    units: ['Fantassin'],
  }
  const owner = createOwner([barracks])
  barracks.owner = owner
  const villagers = Array.from({ length: 6 }, (_, index) => ({
    context: {
      menu: {
        showMessage(message, level) {
          this.lastMessage = { message, level }
        },
      },
    },
    family: 'unit',
    i: index,
    j: 0,
    owner,
    sendToEvt(target, action, options) {
      this.sent = { target, action, options }
      this.dest = target
    },
    type: 'Villager',
  }))
  owner.units.push(...villagers)

  for (const villager of villagers.slice(0, 5)) {
    assert.equal(sendUnitToTraining(villager, 'Fantassin'), true)
    assert.equal(villager.sent.target, barracks)
  }

  assert.equal(findBestTrainingBuildingForUnit(villagers[5], 'Fantassin'), null)
  assert.equal(sendUnitToTraining(villagers[5], 'Fantassin'), false)
  assert.equal(villagers[5].trainingTargetType, undefined)
})

test('villager training menu includes priest only when a usable temple is available', () => {
  const { canShowVillagerTrainingMenu, findBestTrainingBuildingForUnit, VILLAGER_TRAINING_UNIT_TYPES } =
    loadTrainingOrders()
  const temple = {
    family: 'building',
    i: 1,
    isBuilt: true,
    j: 0,
    loading: null,
    owner: null,
    queue: [],
    type: 'Temple',
    units: ['Priest'],
  }
  const owner = createOwner([temple])
  owner.config.units.Priest = { category: 'Civilian' }
  temple.owner = owner
  const villager = {
    context: { menu: { showMessage() {} } },
    family: 'unit',
    i: 0,
    j: 0,
    owner,
    type: 'Villager',
  }
  owner.units.push(villager)

  assert.deepEqual([...VILLAGER_TRAINING_UNIT_TYPES], ['Fantassin', 'Bowman', 'Priest'])
  assert.equal(findBestTrainingBuildingForUnit(villager, 'Priest'), temple)
  assert.equal(canShowVillagerTrainingMenu(villager), true)

  temple.isBuilt = false

  assert.equal(findBestTrainingBuildingForUnit(villager, 'Priest'), null)
})

test('unit training type lookup respects the caller allowed types', () => {
  const { findTrainingTypeForUnitAtBuilding } = loadTrainingOrders()
  const barracks = {
    family: 'building',
    i: 1,
    isBuilt: true,
    j: 0,
    loading: null,
    owner: null,
    queue: [],
    type: 'Barracks',
    units: ['Priest', 'Fantassin'],
  }
  const owner = createOwner([barracks])
  owner.config.units.Priest = { category: 'Civilian' }
  barracks.owner = owner
  const villager = {
    context: { menu: { showMessage() {} } },
    family: 'unit',
    i: 0,
    j: 0,
    owner,
    type: 'Villager',
  }

  assert.equal(findTrainingTypeForUnitAtBuilding(villager, barracks, ['Fantassin']), 'Fantassin')
  assert.equal(findTrainingTypeForUnitAtBuilding(villager, barracks, ['Priest']), null)
})

test('mount horse order sends a soldier to a matching stable', () => {
  const { canShowMountHorseAction, sendUnitToTraining } = loadTrainingOrders()
  const stable = {
    family: 'building',
    i: 2,
    isBuilt: true,
    j: 0,
    loading: null,
    owner: null,
    queue: [],
    type: 'Stable',
    units: ['Bowman'],
  }
  const owner = createOwner([stable])
  stable.owner = owner
  const bowman = {
    context: { menu: { showMessage() {} } },
    family: 'unit',
    i: 0,
    j: 0,
    mountedOnHorse: false,
    owner,
    sendToEvt(target, action) {
      this.sent = { target, action }
    },
    type: 'Bowman',
  }
  owner.units.push(bowman)

  assert.equal(canShowMountHorseAction(bowman), true)
  assert.equal(sendUnitToTraining(bowman, 'Bowman'), true)
  assert.equal(bowman.sent.target, stable)
  assert.equal(bowman.sent.action, 'train')
})
