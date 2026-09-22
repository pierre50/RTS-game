const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadMapSaveRestore() {
  return loadTsModule('app/classes/map/MapSaveRestore.ts', {
    mocks: {
      '../../../engine/services/BuildingInteriorSpaceSystemRuntime': { ensureRuntimeBuildingInteriorSpace() {} },
      '../../constants': { FAMILY_TYPES: { building: 'building', unit: 'unit' }, PLAYER_TYPES: { ai: 'AI' } },
      '../../lib/playerState': { isAIControlledPlayer: () => false },
      '../../lib/resources/playerResourceTotals': {
        expandLegacyFoodAmount: resources => resources,
        syncPlayerResourceFieldsFromChests: () => {},
      },
    },
  })
}

const { restorePlayerEntitiesFromSave } = loadMapSaveRestore()

test('cave orders resolve cells and paths in the interior and can target another owner', () => {
  const { processUnit } = loadMapSaveRestore()
  const cell = { i: 0, j: 0 }
  const enemy = { family: 'unit', label: 'bandit' }
  const map = {
    grid: [[{ outside: true }]],
    spaces: new Map([['cave', { grid: [[cell]] }]]),
    context: { players: [{ units: [enemy], corpses: [], buildings: [] }] },
    getChildByLabel: () => null,
  }
  const unit = {
    spaceId: 'cave',
    setDest(dest) {
      this.dest = dest
    },
    setPath(path) {
      this.path = path
    },
  }
  processUnit(unit, map, { caveOrders: { dest: [0, 0], path: [{ i: 0, j: 0 }], action: null } })
  assert.equal(unit.dest, cell)
  assert.deepEqual(unit.path, [cell])
  processUnit(unit, map, { caveOrders: { dest: 'bandit', path: [{ i: 0, j: 0 }], action: 'attack' } })
  assert.equal(unit.dest, enemy)
  assert.equal(unit.action, 'attack')
})

test('restored delivery rebuilds its return task without reviving transient timers', () => {
  const { processUnit } = loadMapSaveRestore()
  const building = { family: 'building', label: 'store' }
  const resource = { family: 'resource', label: 'tree' }
  const map = { grid: [[{}]], context: {}, getChildByLabel: label => (label === 'store' ? building : resource) }
  const unit = { family: 'unit', path: [], dest: null }
  processUnit(unit, map, {
    resourceDelivery: {
      building: 'store',
      returnTask: {
        dest: 'tree',
        action: 'chopwood',
        work: 'woodcutter',
        autonomousJob: 'wood',
      },
    },
  })
  assert.equal(unit.resourceDeliveryState.building, building)
  assert.equal(unit.resourceDeliveryState.phase, 'toBuilding')
  assert.equal(unit.resourceDeliveryState.returnTask.dest, resource)
  assert.equal(unit.resourceDeliveryState.returnTask.work, 'woodcutter')
  assert.equal(unit.resourceDeliveryState.taskId, undefined)
  assert.equal(unit.dest, null)
  const missingBuilding = { ...map, getChildByLabel: label => (label === 'tree' ? resource : null) }
  processUnit(unit, missingBuilding, {
    resourceDelivery: { building: 'gone', returnTask: { dest: 'tree', action: 'chopwood' } },
  })
  assert.equal(unit.resourceDeliveryState.building, null)
  assert.equal(unit.resourceDeliveryState.returnTask.dest, resource)
})

test('restored exploration without a usable saved path replans without clearing the job', () => {
  const { processUnit } = loadMapSaveRestore()
  const cell = { i: 0, j: 0, has: null }
  const calls = []
  const unit = {
    type: 'Villager',
    autonomousJob: 'food',
    exploringForAutonomy: true,
    action: null,
    dest: [0, 0],
    path: [{ i: 4, j: 4 }],
    setDest(dest) {
      this.dest = dest
    },
    sendToEvt(dest, action, options) {
      calls.push({ dest, action, options })
    },
    sendTo() {
      assert.fail('manual movement would clear the assignment')
    },
  }
  processUnit(unit, { context: {}, grid: [[cell]] })
  assert.deepEqual(calls, [{ dest: cell, action: null, options: { forceRepath: true, preserveAutonomy: true } }])
  assert.equal(unit.autonomousJob, 'food')
})

test('incoming training resolves its building without entering before the clock exists', () => {
  const { processUnit } = loadMapSaveRestore()
  const building = { label: 'barracks', family: 'building' }
  const unit = {
    type: 'Villager',
    trainingTargetType: 'Fantassin',
    action: 'train',
    dest: 'barracks',
    path: [{ i: 0, j: 0 }],
    setDest(dest) {
      this.dest = dest
    },
    getAction() {
      assert.fail('training must wait for runtime initialization')
    },
    setPath() {
      assert.fail('movement must wait for runtime initialization')
    },
  }
  processUnit(unit, { context: { dayNight: null }, grid: [[{}]], getChildByLabel: () => building })
  assert.equal(unit.dest, building)
  assert.equal(unit.action, 'train')
  assert.equal(unit.trainingTargetType, 'Fantassin')
})

test('exploration restoration skips sparse holes without restoring display fog', () => {
  const { restorePlayerViews } = loadMapSaveRestore()
  const fog = []
  const viewed = []
  const map = { size: 2, grid: [[], [, { setFog: value => fog.push(value) }], []] }
  restorePlayerViews(
    {
      isPlayed: true,
      views: {
        restoreViewers() {},
        isViewed: () => true,
        isVisible: () => false,
        onViewed: (i, j) => viewed.push([i, j]),
      },
    },
    map
  )
  assert.deepEqual(fog, [])
  assert.deepEqual(viewed, [[1, 1]])
})

test('restoring player entities preserves saved unit types instead of applying new-game hero promotion', () => {
  const createUnitCalls = []
  const player = {
    createBuilding(options) {
      return options
    },
    createUnit(options, creationOptions) {
      createUnitCalls.push({ options, creationOptions })
      return { ...options }
    },
  }

  restorePlayerEntitiesFromSave(player, {
    buildings: [{ i: 1, j: 2, type: 'House' }],
    units: [{ i: 3, j: 4, type: 'Villager' }],
    corpses: [{ i: 5, j: 6, type: 'Fantassin', currentSheet: 'corpse' }],
  })

  assert.deepEqual(player.buildings, [{ i: 1, j: 2, type: 'House', skipBuiltEffects: true, deferTrainingResume: true }])
  assert.equal(player.units[0].type, 'Villager')
  assert.equal(player.corpses[0].type, 'Fantassin')
  assert.equal(createUnitCalls[0].options.suppressCreateSound, true)
  assert.equal(createUnitCalls[1].options.suppressCreateSound, true)
  assert.deepEqual(
    createUnitCalls.map(call => call.creationOptions),
    [{ preserveType: true }, { preserveType: true }]
  )
})
