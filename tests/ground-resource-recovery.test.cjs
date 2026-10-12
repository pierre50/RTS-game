const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { recoverOfflineGroundTool } = loadTsModule('app/services/world/offline/OfflineGroundRecovery.ts')
const { OfflineWorldSpatial } = loadTsModule('app/services/world/offline/OfflineWorldSpatial.ts')
const { regrowOfflineResources } = loadTsModule('app/services/world/offline/OfflineWorldResources.ts')

function fixture() {
  const unit = {
    type: 'Villager',
    label: 'worker',
    i: 10,
    j: 10,
    inactif: true,
    villageHome: { i: 10, j: 10, id: 'village', spaceId: 'outside' },
    inventory: { activeWeapons: { tool: 'axe_bronze~condition:0' }, resources: {} },
  }
  const player = { label: 'village', units: [unit], buildings: [] }
  const resources = Array.from({ length: 9 }, (_, index) => ({
    i: 12 + index,
    j: 12,
    type: index < 4 ? 'GroundWood' : 'GroundStone',
    quantity: 1,
    totalQuantity: 1,
    isNaturalResource: true,
    textureName: index < 4 ? '001_resources/ground' : '004_resources/ground',
  }))
  const state = { resources, players: [player], animals: [] }
  const terrain = Array.from({ length: 50 }, () =>
    Array.from({ length: 50 }, () => ({ category: 'Land', type: 'Grass' }))
  )
  const spatial = new OfflineWorldSpatial(terrain, state, () => 1, { traceConnectivity: false })
  const report = { gathered: {}, resourcesDepleted: 0, resourcesRespawned: 0 }
  const rules = { unitConfig: () => ({ speed: 1.5 }) }
  return { state, unit, player, spatial, report, rules, terrain }
}

test('an empty village recovers a metal tool with nine real ground items and paid travel', () => {
  const f = fixture()
  assert.equal(
    recoverOfflineGroundTool(f.state, f.player, 0, f.unit, 1, 5, f.spatial, f.rules, f.report).status,
    'waiting'
  )
  assert.deepEqual(f.unit.inventory.resources, {})
  assert.equal(f.state.resources.length, 9)
  assert.ok(f.unit.offlineWork.milliseconds > 0)
  // Saved progress survives a load.
  const restored = JSON.parse(JSON.stringify(f.state))
  const unit = restored.players[0].units[0]
  const spatial = new OfflineWorldSpatial(f.terrain, restored, () => 1, { traceConnectivity: false })
  recoverOfflineGroundTool(restored, restored.players[0], 0, unit, 100000, 5, spatial, f.rules, f.report)
  assert.equal(unit.inventory.activeWeapons.tool, 'axe_ceramic')
  assert.equal(unit.inventory.toolSupplyTarget, 'axe_bronze')
  assert.deepEqual(unit.inventory.resources, { wood: 0, stone: 0 })
  assert.equal(restored.resources.length, 0)
  assert.equal(restored.naturalResourceRespawnSlots.length, 9)
  assert.deepEqual(f.report.gathered, { wood: 4, stone: 5 })
  assert.equal(f.report.resourcesDepleted, 9)
  assert.equal(
    recoverOfflineGroundTool(restored, restored.players[0], 0, unit, 100000, 5, spatial, f.rules, f.report).status,
    'inactive'
  )
})

test('no known or reachable ground resource means no free replacement', () => {
  for (const blocked of ['unknown', 'unreachable', 'outside']) {
    const f = fixture()
    if (blocked === 'unknown') f.rules.isKnown = () => false
    if (blocked === 'unreachable') f.spatial.resourceApproach = () => undefined
    if (blocked === 'outside') f.unit.villageHome = { i: 500, j: 500 }
    assert.equal(
      recoverOfflineGroundTool(f.state, f.player, 0, f.unit, 100000, 5, f.spatial, f.rules, f.report).status,
      'blocked'
    )
    assert.equal(f.unit.inventory.activeWeapons.tool, 'axe_bronze~condition:0')
    assert.equal(f.state.resources.length, 9)
  }
})

test('ground respawn respects separate delays, nearby trees and blocked cells without accumulation', () => {
  const f = fixture()
  f.state.resources = [{ type: 'Tree', i: 20, j: 20, quantity: 30 }]
  f.state.naturalResourceRespawnSlots = [
    { type: 'GroundWood', i: 19, j: 20, depletedDay: 5, totalQuantity: 1, textureName: '001_resources/ground' },
    { type: 'GroundStone', i: 14, j: 20, depletedDay: 5, totalQuantity: 1, textureName: '004_resources/ground' },
  ]
  const spatial = new OfflineWorldSpatial(f.terrain, f.state, () => 1, { traceConnectivity: false })
  regrowOfflineResources(f.state, 6, spatial, 5, f.report)
  assert.equal(f.state.resources.length, 1)
  regrowOfflineResources(f.state, 7, spatial, 5, f.report)
  assert.equal(f.state.resources.length, 2)
  assert.equal(f.state.resources[1].type, 'GroundWood')
  assert.ok(Math.hypot(f.state.resources[1].i - 20, f.state.resources[1].j - 20) <= 3)
  const available = spatial.naturalCell.bind(spatial)
  spatial.naturalCell = () => false
  regrowOfflineResources(f.state, 9, spatial, 5, f.report)
  assert.equal(f.state.naturalResourceRespawnSlots.length, 1)
  spatial.naturalCell = available
  regrowOfflineResources(f.state, 10, spatial, 5, f.report)
  regrowOfflineResources(f.state, 10, spatial, 5, f.report)
  assert.equal(f.state.resources.length, 3)
  assert.equal(f.state.naturalResourceRespawnSlots.length, 0)
  assert.equal(f.state.resources[2].textureName, '004_resources/ground')
  assert.equal(f.state.resources[2].quantity, 1)
})

test('branches wait if their nearby trees have disappeared', () => {
  const f = fixture()
  f.state.naturalResourceRespawnSlots = [{ type: 'GroundWood', i: 10, j: 10, depletedDay: 1, totalQuantity: 1 }]
  regrowOfflineResources(f.state, 10, f.spatial, 5, f.report)
  assert.equal(f.state.naturalResourceRespawnSlots.length, 1)
  assert.equal(f.report.resourcesRespawned, 0)
})

test('live worker walks before collecting and respects player orders and bag limits', () => {
  const targets = [{ family: 'resource', type: 'GroundWood', i: 12, j: 10, quantity: 1 }]
  let collected = 0,
    walked = 0,
    delivered = 0,
    room = 1,
    reachable = false
  const { seekGroundToolMaterials } = loadTsModule('app/lib/units/village/villageGroundRecovery.ts', {
    mocks: {
      '../../hero/heroGroundCollection': {
        collectGroundResource: () => {
          collected++
          return true
        },
      },
      '../../hero/heroActionRange': { isHeroInteractionTargetReachable: () => reachable },
      '../autonomy/villagerKnownTargets': {
        knownResources: (_unit, type) =>
          targets.filter(target => (Array.isArray(type) ? type.includes(target.type) : target.type === type)),
      },
      '../autonomy/villagerAutonomyAvailability': { villagerAutonomySuspension: () => null },
      '../../resources/resourceDelivery': {
        getUnitResourceCapacityRemaining: () => room,
        getUnitResourceCarryRemaining: () => room,
      },
    },
  })
  const f = fixture()
  f.unit.context = { scheduler: { elapsedMs: 0 } }
  f.unit.sendToEvt = () => {
    walked++
    return true
  }
  f.unit.sendToDelivery = () => {
    delivered++
    return true
  }
  assert.equal(seekGroundToolMaterials(f.unit), true)
  assert.equal(walked, 1)
  assert.equal(collected, 0)
  f.unit.context.scheduler.elapsedMs = 10000
  reachable = true
  assert.equal(seekGroundToolMaterials(f.unit), true)
  assert.equal(collected, 1)
  f.unit.action = 'build'
  assert.equal(seekGroundToolMaterials(f.unit), false)
  f.unit.action = null
  room = 0
  assert.equal(seekGroundToolMaterials(f.unit), true)
  assert.equal(delivered, 1)
})

test('live ground respawn finds a free local site and preserves the atlas frame', () => {
  const { respawnNaturalResource } = loadTsModule('app/classes/map/resources/MapNaturalResources.ts', {
    mocks: {
      '../../../lib': { hasWaterBorderWithin: () => false },
      '../../../lib/buildings/passageCells': {
        createNonReservedPassageCellCondition: () => cell => !cell.reservedPassage,
      },
      './MapResourceCreation': { createResource: (_map, i, j, type, options) => ({ i, j, type, ...options }) },
    },
  })
  const grid = Array.from({ length: 25 }, (_, i) => Array.from({ length: 25 }, (_, j) => ({ i, j, category: 'Land' })))
  const map = { grid, context: {}, resources: new Set(), random: () => 0.5 }
  const slot = {
    type: 'GroundWood',
    i: 12,
    j: 12,
    totalQuantity: 1,
    textureName: '002_resources/ground',
    depletedDay: 3,
  }
  assert.equal(respawnNaturalResource({ map }, slot), false)
  grid[12][12].has = { family: 'resource', type: 'Tree' }
  assert.equal(respawnNaturalResource({ map }, slot), true)
  const resource = [...map.resources][0]
  assert.equal(resource.quantity, 1)
  assert.equal(resource.textureName, '002_resources/ground')
  assert.ok(Math.hypot(resource.i - 12, resource.j - 12) <= 3)
  for (const row of grid) for (const cell of row) cell.reservedPassage = true
  assert.equal(respawnNaturalResource({ map }, { ...slot, type: 'GroundStone' }), false)
})

test('collecting natural ground resources records a dated slot with its original sprite', () => {
  const { registerResourceRespawnSlot } = loadTsModule('app/classes/resources/ResourceRespawn.ts')
  const context = { map: {}, dayNight: { state: { day: 8 } } }
  registerResourceRespawnSlot({
    type: 'GroundStone',
    i: 3,
    j: 5,
    isNaturalResource: true,
    totalQuantity: 1,
    textureName: '005_resources/ground',
    context,
  })
  assert.equal(context.map.naturalResourceRespawnSlots.length, 1)
  assert.equal(context.map.naturalResourceRespawnSlots[0].depletedDay, 8)
  assert.equal(context.map.naturalResourceRespawnSlots[0].textureName, '005_resources/ground')
})

test('offline world simulation runs ground recovery for a worker blocked by a broken tool', () => {
  const { simulateOfflineWorld } = loadTsModule('app/services/world/offline/OfflineWorldSimulation.ts')
  const f = fixture()
  f.state.camera = { x: 0, y: 0 }
  f.player.type = 'Human'
  f.unit.autonomousJob = 'wood'
  const result = simulateOfflineWorld(f.state, {
    fromElapsedMs: 0,
    toElapsedMs: 60000,
    terrain: f.terrain,
    unitConfig: f.rules.unitConfig,
    buildingConfig: () => ({}),
    buildingCapacity: () => 300,
    cycleMs: () => 1000,
    wheatMatureFrame: 5,
    runtimeOwnsMeals: true,
    runtimeOwnsTraining: true,
    runtimeOwnsDailyEvents: true,
  })
  assert.equal(f.unit.inventory.activeWeapons.tool, 'axe_ceramic')
  assert.deepEqual(result.gathered, { wood: 4, stone: 5 })
  assert.equal(f.state.resources.length, 0)
})

test('offline renewal checks local building footprints and neighbouring pickups', () => {
  const f = fixture()
  f.state.resources = [{ type: 'GroundWood', i: 20, j: 20, quantity: 1 }]
  f.player.buildings = [{ type: 'House', i: 30, j: 30, size: 3 }]
  const spatial = new OfflineWorldSpatial(f.terrain, f.state, () => 3, {
    traceConnectivity: false,
    protectVillageAccess: false,
    exactBuildingFootprints: true,
  })
  assert.equal(spatial.groundCell({ i: 22, j: 20 }, 'GroundStone'), false)
  assert.equal(spatial.groundCell({ i: 23, j: 20 }, 'GroundStone'), true)
  assert.equal(spatial.groundCell({ i: 34, j: 30 }, 'GroundStone'), false)
  assert.equal(spatial.groundCell({ i: 35, j: 30 }, 'GroundStone'), true)
})

test('preparing multiple tools conserves time beyond sixteen pickups and across save boundaries', () => {
  const setup = () => {
    const f = fixture()
    f.unit.inventory = { toolsInitialized: true, resources: {} }
    f.player.buildings = [
      {
        type: 'House',
        label: 'site',
        i: 8,
        j: 8,
        isBuilt: false,
        hitPoints: 1,
        totalHitPoints: 100,
        constructionMaterials: { cost: { wood: 20, stone: 20 }, delivered: {}, consumed: {} },
      },
    ]
    f.state.resources = Array.from({ length: 27 }, (_, n) => ({
      type: n < 12 ? 'GroundWood' : 'GroundStone',
      i: 12 + n,
      j: 12,
      quantity: 1,
      totalQuantity: 1,
      isNaturalResource: true,
    }))
    f.spatial = new OfflineWorldSpatial(f.terrain, f.state, () => 1, { traceConnectivity: false })
    return f
  }
  const whole = setup()
  const result = recoverOfflineGroundTool(
    whole.state,
    whole.player,
    0,
    whole.unit,
    100000,
    5,
    whole.spatial,
    whole.rules,
    whole.report
  )
  assert.equal(result.status, 'ready')
  assert.ok(result.remainingMs > 0)
  assert.equal(whole.report.resourcesDepleted, 27)
  let split = setup(),
    spent = 0
  for (let n = 0; n < 100; n++) {
    const step = recoverOfflineGroundTool(
      split.state,
      split.player,
      0,
      split.unit,
      1000,
      5,
      split.spatial,
      split.rules,
      split.report
    )
    spent += 1000 - step.remainingMs
    if (step.status === 'ready') break
    const state = JSON.parse(JSON.stringify(split.state))
    split = {
      ...split,
      state,
      player: state.players[0],
      unit: state.players[0].units[0],
      spatial: new OfflineWorldSpatial(split.terrain, state, () => 1, { traceConnectivity: false }),
    }
  }
  assert.deepEqual(split.unit.inventory, whole.unit.inventory)
  assert.equal(split.state.resources.length, whole.state.resources.length)
  assert.ok(Math.abs(spent - (100000 - result.remainingMs)) < 0.0001)
})

test('a completely full bag without storage waits without losing food, equipment or pickups', () => {
  const f = fixture()
  f.unit.inventory.resources = { wheat: 30 }
  const before = structuredClone(f.unit.inventory)
  const result = recoverOfflineGroundTool(f.state, f.player, 0, f.unit, 100000, 5, f.spatial, f.rules, f.report)
  assert.equal(result.status, 'blocked')
  assert.deepEqual(f.unit.inventory, before)
  assert.equal(f.state.resources.length, 9)
  // Releasing actual bag space lets the same worker recover normally.
  f.unit.inventory.resources.wheat = 12
  assert.equal(
    recoverOfflineGroundTool(f.state, f.player, 0, f.unit, 100000, 5, f.spatial, f.rules, f.report).status,
    'ready'
  )
  assert.equal(f.unit.inventory.activeWeapons.tool, 'axe_ceramic')
  assert.equal(f.unit.inventory.resources.wheat, 12)
})

test('two workers competing for the last pickups never duplicate them', () => {
  const f = fixture()
  const second = structuredClone(f.unit)
  second.label = 'second'
  second.i = 9
  f.player.units.push(second)
  f.spatial.reserve(second)
  const recover = unit => recoverOfflineGroundTool(f.state, f.player, 0, unit, 100000, 5, f.spatial, f.rules, f.report)
  assert.equal(recover(f.unit).status, 'ready')
  assert.equal(recover(second).status, 'blocked')
  assert.deepEqual(f.report.gathered, { wood: 4, stone: 5 })
  assert.equal(f.report.resourcesDepleted, 9)
  assert.equal(second.inventory.activeWeapons.tool, 'axe_bronze~condition:0')
})

test('a full bag uses reachable storage and resumes tool preparation with food conserved', () => {
  const f = fixture()
  f.unit.inventory.resources = { wheat: 30 }
  f.unit.villageHome.id = 'village:town'
  const depot = { type: 'Granary', label: 'store', i: 7, j: 7, isBuilt: true, inventory: { resources: {} } }
  f.player.buildings.push(depot, { type: 'TownCenter', label: 'town', i: 5, j: 5, isBuilt: true })
  f.spatial = new OfflineWorldSpatial(f.terrain, f.state, () => 1, { traceConnectivity: false })
  const result = recoverOfflineGroundTool(f.state, f.player, 0, f.unit, 100000, 5, f.spatial, f.rules, f.report)
  assert.equal(result.status, 'ready')
  assert.equal(f.unit.inventory.activeWeapons.tool, 'axe_ceramic')
  assert.equal((f.unit.inventory.resources.wheat ?? 0) + (depot.inventory.resources.wheat ?? 0), 30)
  assert.ok(depot.inventory.resources.wheat > 0)
})
