const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule, requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadResourceDelivery() {
  return loadTsModule('app/lib/resources/resourceDelivery.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: {
          chest: 'Chest',
          granary: 'Granary',
          storagePit: 'StoragePit',
          townCenter: 'TownCenter',
        },
        LOADING_TYPES: {
          berry: 'berry',
          meat: 'meat',
          wheat: 'wheat',
        },
        RESOURCE_STORAGE_NAMES: ['wood', 'berry', 'meat', 'wheat', 'stone', 'gold', 'copper', 'iron'],
        UNIT_TYPES: {
          hero: 'Hero',
          villager: 'Villager',
        },
      },
      '../grid/queries': {
        getClosestInstanceWithPath: (_unit, candidates) => ({ instance: candidates[0], path: [{}] }),
      },
      '../mapSpaces': {
        getEntitySpaceId: entity => entity?.spaceId ?? 'outside',
        isOutsideSpaceId: spaceId => !spaceId || spaceId === 'outside',
        sameMapSpace: (a, b) => (a?.spaceId ?? 'outside') === (b?.spaceId ?? 'outside'),
      },
      '../units/unitControl': {
        isHeroControlled: unit => unit.controlMode === 'hero',
      },
    },
  })
}

function loadGameResourceDelivery(overrides = {}) {
  const playAudibleSoundCue = overrides.playAudibleSoundCue ?? (() => null)
  return loadTsModule('app/screens/game/GameResourceDelivery.ts', {
    mocks: {
      '../../constants': {
        ACTION_TYPES: {
          chopwood: 'chopwood',
          delivery: 'delivery',
          farm: 'farm',
          forageberry: 'forageberry',
          minecopper: 'minecopper',
          minegold: 'minegold',
          mineiron: 'mineiron',
          minestone: 'minestone',
          takemeat: 'takemeat',
        },
        BUILDING_TYPES: {
          chest: 'Chest',
        },
        RESOURCE_STORAGE_NAMES: ['wood', 'berry', 'meat', 'wheat', 'stone', 'gold', 'copper', 'iron'],
        SOUND_CUES: {
          building: { chestOpen: 'building/chest-open' },
        },
        UNIT_TYPES: { hero: 'Hero' },
      },
      '../../lib/audio/sound': {
        playAudibleSoundCue,
      },
      '../../lib/buildings/interiors': {
        getBuildingInteriorBlueprintType: () => 'default',
      },
      '../../lib/inventory/inventoryContainers': {
        createInventoryContainer: (target, options) => ({
          ...options,
          inventory: (target.inventory ??= { resources: {} }),
        }),
        moveInventoryResource: (source, destination, resource) => {
          const amount = source.inventory.resources?.[resource] ?? 0
          if (amount <= 0 || destination.canAcceptResource?.(resource, amount) === false) return 0
          delete source.inventory.resources[resource]
          destination.inventory.resources = destination.inventory.resources ?? {}
          destination.inventory.resources[resource] = (destination.inventory.resources[resource] ?? 0) + amount
          return amount
        },
      },
      '../../lib/mapSpaces': {
        getEntitySpaceId: overrides.getEntitySpaceId ?? (unit => unit.spaceId ?? 'outside'),
        sameMapSpace: (a, b) => (a.spaceId ?? 'outside') === (b.spaceId ?? 'outside'),
      },
      '../../lib/units/villagerAutonomy': {
        assignVillagerAutonomy: overrides.assignVillagerAutonomy ?? (() => false),
        resumeVillagerAutonomy: () => false,
      },
      '../../lib/units/villagerAutonomyTargeting': {
        getAutonomyJobForWork: work => {
          if (work === 'woodcutter') return 'wood'
          if (work === 'stoneminer') return 'stone'
          if (work === 'goldminer') return 'gold'
          return null
        },
      },
      '../../lib/units/villagerTaskRecovery': {
        resumeVillagerJobIntent:
          overrides.resumeVillagerJobIntent ??
          ((unit, task) => {
            unit.previousDest = null
            unit.previousWork = null
            unit.handleChangeDest?.()
            unit.dest = null
            unit.path = []
            unit.autonomousJob = task?.autonomousJob ?? unit.autonomousJob ?? null
            if (task?.dest && task.action && unit.getActionCondition?.(task.dest, task.action) !== false) {
              const senders = {
                chopwood: unit.sendToTree,
                minegold: unit.sendToMineResource,
                minestone: unit.sendToStone,
              }
              return senders[task.action]?.call(unit, task.dest, true) !== false
            }
            return Boolean(
              (task?.autonomousJob ?? unit.autonomousJob) &&
                (overrides.assignVillagerAutonomy?.(unit, task?.autonomousJob ?? unit.autonomousJob, {
                  exploreWhenNoTarget: true,
                  preserveRejectedTargets: true,
                }) ?? false)
            )
          }),
        resumeVillagerStoredTask:
          overrides.resumeVillagerStoredTask ??
          ((unit, task, options) => {
            if (!task?.dest || !task.action) return false
            unit.previousDest = null
            unit.previousWork = null
            unit.handleChangeDest?.()
            unit.dest = null
            unit.path = []
            if (task.work) unit.work = task.work
            unit.autonomousJob = task.autonomousJob ?? unit.autonomousJob ?? null
            if (unit.getActionCondition?.(task.dest, task.action) === false) {
              return Boolean(
                unit.autonomousJob &&
                  (overrides.assignVillagerAutonomy?.(unit, unit.autonomousJob, {
                    exploreWhenNoTarget: options?.exploreWhenNoTarget ?? false,
                    preserveRejectedTargets: true,
                  }) ??
                    false)
              )
            }
            const senders = {
              chopwood: unit.sendToTree,
              minegold: unit.sendToMineResource,
              minestone: unit.sendToStone,
            }
            return senders[task.action]?.call(unit, task.dest, true) !== false
          }),
      },
      '../../lib/resources/resourceDelivery': {
        buildingAcceptsInventoryResource: overrides.buildingAcceptsInventoryResource ?? (() => true),
        findResourceDeliveryTarget: overrides.findResourceDeliveryTarget ?? (() => null),
        unitHasDeliverableResourcesForBuilding: overrides.unitHasDeliverableResourcesForBuilding ?? (() => true),
      },
      '../../services/rest/UnitRestRules': {
        canResumeVillagerReturnTaskBeforeRest: overrides.canResumeVillagerReturnTaskBeforeRest ?? (() => true),
      },
      '../../services/BuildingInteriorSpaceSystem': {
        ensureBuildingInteriorSpace: () => ({ id: 'interior:tc' }),
        getBuildingInteriorSpaceForUnit: overrides.getBuildingInteriorSpaceForUnit ?? (unit => unit.space ?? null),
        routeUnitIntoBuildingInteriorSpace: () => true,
        routeUnitOutOfBuildingInteriorSpace:
          overrides.routeUnitOutOfBuildingInteriorSpace ??
          ((_context, unit, _space, options) => {
            unit.spaceId = 'outside'
            options?.onTransferred?.()
            return true
          }),
      },
      '../../services/rest/UnitRestLifecycle': {
        continueRestAfterDelivery:
          overrides.continueRestAfterDelivery ?? (() => false),
        sendUnitToRest:
          overrides.sendUnitToRest ??
          ((unit, reason) => {
            unit.shelterState = { reason, status: 'movingToRest' }
            return true
          }),
      },
    },
  })
}

function loadUnitRestRules(overrides = {}) {
  return loadTsModule('app/services/rest/UnitRestRules.ts', {
    mocks: {
      '../../constants': {
        ACTION_TYPES: { attack: 'attack' },
        BUILDING_TYPES: {},
        CELL_HEIGHT: 32,
        CELL_WIDTH: 64,
        FAMILY_TYPES: { building: 'building', unit: 'unit' },
        STEP_TIME: 20,
        UNIT_TYPES: { hero: 'Hero', villager: 'Villager' },
        WORK_TYPES: { attacker: 'attacker' },
      },
      '../../config/gameplay': {
        DAY_NIGHT_CONFIG: { dayLengthMs: 24 * 60 * 1000, hoursPerDay: 24 },
      },
      '../../lib/buildings/buildingOccupancy': {
        getBuildingShelterCapacity: () => 1,
        hasBuildingShelterCapacity: () => true,
      },
      '../../lib/buildings/interiors': {
        getBuildingInteriorEntryCell: () => null,
        isBuildingInteriorSupported: () => false,
      },
      '../../lib/buildings/passageCells': {
        canUnitUseCellAsIdleDestination: () => true,
        createReservedPassageCellLookup: () => null,
      },
      '../../lib/combat/bandits': {
        isBanditUnit: () => false,
      },
      '../../lib/grid/cells': {
        getCellsAroundPoint: () => [],
      },
      '../../lib/grid/movement': {
        getInstanceClosestFreeCellPath: overrides.getInstanceClosestFreeCellPath ?? ((_unit, target) => target.path ?? []),
        getInstancePath: overrides.getInstancePath ?? (() => []),
      },
      '../../lib/units/unitControl': {
        isHeroControlled: () => false,
      },
      '../../lib/units/villagerSchedule': requireFromTsFile(
        '../../lib/units/villagerSchedule',
        path.join(__dirname, '..', 'app/services/rest/UnitRestRules.ts'),
        {}
      ),
      '../../lib/mapSpaces': {
        getEntityCell: (_entity, map) => map.grid?.[0]?.[0] ?? null,
        getEntitySpaceGrid: (_entity, map) => map.grid,
        sameMapSpace: () => true,
      },
    },
  })
}

test('loading types fill local resource pockets up to the unit bag capacity', () => {
  const { getResourceKeyForLoadingType, getUnitResourceCapacityRemaining, unitShouldDeliverResource } =
    loadResourceDelivery()
  const villager = {
    inventory: { resources: { meat: 10, stone: 4 } },
    type: 'Villager',
  }

  assert.equal(getResourceKeyForLoadingType('meat'), 'meat')
  assert.equal(getResourceKeyForLoadingType('stone'), 'stone')
  assert.equal(getUnitResourceCapacityRemaining(villager, 'stone'), 16)
  assert.equal(getUnitResourceCapacityRemaining(villager, 'meat'), 16)
  assert.equal(unitShouldDeliverResource(villager, 'meat'), false)

  villager.inventory.resources.meat = 4
  assert.equal(unitShouldDeliverResource(villager, 'meat'), false)
})

test('villagers deliver only when the shared bag is full', () => {
  const { unitShouldDeliverResource } = loadResourceDelivery()
  const villager = {
    inventory: { resources: { wood: 11 } },
    type: 'Villager',
  }

  for (const amount of [10, 20, 29]) {
    villager.inventory.resources.wood = amount
    assert.equal(unitShouldDeliverResource(villager, 'wood'), false)
  }
  villager.inventory.resources.wood = 30
  assert.equal(unitShouldDeliverResource(villager, 'wood'), true)
  villager.inventory.resources = { wood: 15, stone: 14 }
  assert.equal(unitShouldDeliverResource(villager, 'wood'), false)
  villager.inventory.equipment = ['axe']
  assert.equal(unitShouldDeliverResource(villager, 'wood'), true)
  assert.equal(unitShouldDeliverResource(villager, 'unknown'), false)
  villager.controlMode = 'hero'
  villager.inventory.resources.wood = 50
  assert.equal(unitShouldDeliverResource(villager, 'wood'), false)
})

test('full-storage blocking clears when a chest or the bag has room again', () => {
  const { isUnitBlockedByFullStorage } = loadResourceDelivery()
  const owner = { buildings: [] }
  const unit = { type: 'Villager', owner, inventory: { resources: { wood: 30 } } }
  assert.equal(isUnitBlockedByFullStorage(unit), true)
  const chest = { type: 'Chest', family: 'building', owner, isBuilt: true, inventory: { resources: {} } }
  owner.buildings.push(chest)
  assert.equal(isUnitBlockedByFullStorage(unit), false)
  chest.inventory.resources.wood = 100000
  assert.equal(isUnitBlockedByFullStorage(unit), true)
  unit.inventory.resources.wood = 29
  assert.equal(isUnitBlockedByFullStorage(unit), false)
})

test('villager delivery return tasks account for travel time before resuming work', () => {
  const { canResumeVillagerReturnTaskBeforeRest } = loadUnitRestRules()
  const owner = { config: { units: { Villager: { speed: 25 } } } }
  const unit = {
    context: { dayNight: { state: { hour: 17, minute: 30 } }, map: { grid: [[{ has: null, i: 0, j: 0 }]] } },
    i: 0,
    j: 0,
    owner,
    speed: 25,
    type: 'Villager',
  }
  const farTree = { family: 'resource', label: 'far-tree', path: Array.from({ length: 1000 }), type: 'Tree' }

  assert.equal(
    canResumeVillagerReturnTaskBeforeRest(unit, {
      action: 'chopwood',
      autonomousJob: 'wood',
      dest: farTree,
      work: 'woodcutter',
    }),
    false
  )

  unit.context.dayNight.state.hour = 16
  unit.context.dayNight.state.minute = 0
  const nearTree = { family: 'resource', label: 'near-tree', path: [{}], type: 'Tree' }
  assert.equal(
    canResumeVillagerReturnTaskBeforeRest(unit, {
      action: 'chopwood',
      autonomousJob: 'wood',
      dest: nearTree,
      work: 'woodcutter',
    }),
    true
  )
})

test('delivery targets match the carried resource family', () => {
  const { buildingAcceptsInventoryResource, findResourceDeliveryTarget } = loadResourceDelivery()
  const owner = { buildings: [] }
  const granary = {
    family: 'building',
    hitPoints: 100,
    isBuilt: true,
    owner,
    type: 'Granary',
  }
  const storagePit = {
    family: 'building',
    hitPoints: 100,
    isBuilt: true,
    owner,
    type: 'StoragePit',
  }
  owner.buildings = [granary, storagePit]

  assert.equal(buildingAcceptsInventoryResource(granary, 'berry'), true)
  assert.equal(buildingAcceptsInventoryResource(granary, 'stone'), false)
  assert.equal(buildingAcceptsInventoryResource(storagePit, 'stone'), true)
  assert.equal(buildingAcceptsInventoryResource(storagePit, 'berry'), false)
  assert.equal(
    findResourceDeliveryTarget({
      inventory: { resources: { stone: 10 } },
      owner,
      type: 'Villager',
    }),
    storagePit
  )
})

test('delivery target prefers a building that accepts the whole carried pocket', () => {
  const { findResourceDeliveryTarget } = loadResourceDelivery()
  const owner = { buildings: [] }
  const granary = {
    family: 'building',
    hitPoints: 100,
    isBuilt: true,
    owner,
    type: 'Granary',
  }
  const storagePit = {
    family: 'building',
    hitPoints: 100,
    isBuilt: true,
    owner,
    type: 'StoragePit',
  }
  const townCenter = {
    family: 'building',
    hitPoints: 100,
    isBuilt: true,
    owner,
    type: 'TownCenter',
  }
  owner.buildings = [granary, storagePit, townCenter]

  assert.equal(
    findResourceDeliveryTarget({
      inventory: { resources: { wheat: 3, stone: 4 } },
      owner,
      type: 'Villager',
    }),
    townCenter
  )
})

test('delivery target routes outdoor chests directly and interior chests through their parent building', () => {
  const { findResourceDeliveryTarget, getBuildingStorageCapacity } = loadResourceDelivery()
  const owner = { label: 'player-1', buildings: [] }
  const townCenter = {
    family: 'building',
    hitPoints: 100,
    interiorPortalId: 'tc-1',
    isBuilt: true,
    label: 'town-center',
    owner,
    spaceId: 'outside',
    type: 'TownCenter',
  }
  const interiorChest = {
    family: 'building',
    hitPoints: 100,
    inventory: { resources: {} },
    isBuilt: true,
    label: 'interior:tc-1:default:storage-chest',
    owner,
    spaceId: 'interior:tc-1',
    type: 'Chest',
  }
  const outdoorChest = {
    family: 'building',
    hitPoints: 100,
    inventory: { resources: {} },
    isBuilt: true,
    label: 'outdoor-chest',
    owner,
    spaceId: 'outside',
    type: 'Chest',
  }
  owner.buildings = [interiorChest, townCenter, outdoorChest]

  assert.equal(getBuildingStorageCapacity(interiorChest), 600)
  assert.equal(getBuildingStorageCapacity(outdoorChest), 300)
  assert.equal(
    findResourceDeliveryTarget({
      inventory: { resources: { wood: 10 } },
      owner,
      parent: { grid: [] },
      spaceId: 'outside',
      type: 'Villager',
    }),
    townCenter
  )

  owner.buildings = [outdoorChest]
  assert.equal(
    findResourceDeliveryTarget({
      inventory: { resources: { wood: 10 } },
      owner,
      parent: { grid: [] },
      spaceId: 'outside',
      type: 'Villager',
    }),
    outdoorChest
  )
})

test('hero-controlled units do not auto-select a delivery target', () => {
  const { findResourceDeliveryTarget, getUnitResourceCapacityRemaining, unitShouldDeliverResource } =
    loadResourceDelivery()
  const owner = {
    buildings: [
      {
        family: 'building',
        hitPoints: 100,
        isBuilt: true,
        owner: null,
        type: 'TownCenter',
      },
    ],
  }
  owner.buildings[0].owner = owner
  const hero = {
    controlMode: 'hero',
    inventory: { resources: { meat: 10 } },
    owner,
    type: 'Villager',
  }

  assert.equal(getUnitResourceCapacityRemaining(hero, 'meat'), 40)
  assert.equal(unitShouldDeliverResource(hero, 'meat'), false)
  assert.equal(findResourceDeliveryTarget(hero), null)
})

test('resource delivery finalizes immediately when building exit transfers the unit outside', () => {
  const { handleResourceDeliveryAction } = loadGameResourceDelivery()
  const calls = []
  const owner = { buildings: [], units: [] }
  const building = { family: 'building', owner, label: 'town-center', type: 'TownCenter' }
  const chest = { family: 'building', inventory: { resources: {} }, label: 'chest-1', type: 'Chest' }
  const tree = { family: 'resource', isDestroyed: false, label: 'tree-1' }
  const unit = {
    action: 'delivery',
    autonomousJob: 'wood',
    dest: chest,
    handleChangeDest: () => calls.push(['handleChangeDest']),
    inventory: { resources: { wood: 4 } },
    owner,
    path: [],
    previousDest: null,
    previousWork: null,
    resourceDeliveryState: {
      building,
      chest,
      phase: 'toChest',
      returnTask: {
        action: 'chopwood',
        autonomousJob: 'wood',
        dest: tree,
        work: 'woodcutter',
      },
      spaceId: 'interior:tc',
    },
    sendToTree: (target, immediate) => calls.push(['sendToTree', target.label, immediate]),
    space: { id: 'interior:tc' },
    spaceId: 'interior:tc',
    work: 'woodcutter',
    getActionCondition: (target, action) => target === tree && action === 'chopwood',
  }
  owner.units = [unit]
  const context = {
    menu: { refreshInventory: () => calls.push(['refreshInventory']) },
    scheduler: { remove: id => calls.push(['remove', id]) },
  }

  chest.spaceId = unit.spaceId
  unit.isUnitAtDest = () => true
  const handled = handleResourceDeliveryAction(context, unit)

  assert.equal(handled, true)
  assert.equal(unit.resourceDeliveryState, null)
  assert.deepEqual(unit.inventory.resources, {})
  assert.deepEqual(chest.inventory.resources, { wood: 4 })
  assert.deepEqual(calls, [['refreshInventory'], ['handleChangeDest'], ['sendToTree', 'tree-1', true]])
})

test('gold miner resumes minegold only after the town center exit transfer completes', () => {
  let completeExit = null
  const calls = []
  const { handleResourceDeliveryAction } = loadGameResourceDelivery({
    routeUnitOutOfBuildingInteriorSpace: (_context, unit, _space, options) => {
      calls.push(['routeOutside'])
      completeExit = () => {
        unit.spaceId = 'outside'
        options?.onTransferred?.()
      }
      return true
    },
  })
  const owner = { buildings: [], units: [] }
  const building = { family: 'building', owner, label: 'town-center', type: 'TownCenter' }
  const chest = { family: 'building', inventory: { resources: {} }, label: 'chest-1', type: 'Chest' }
  const gold = { family: 'resource', isDestroyed: false, label: 'gold-1', type: 'Gold' }
  const unit = {
    action: 'delivery',
    autonomousJob: 'gold',
    dest: chest,
    getActionCondition: (target, action) => target === gold && action === 'minegold',
    handleChangeDest: () => calls.push(['handleChangeDest']),
    inventory: { resources: { gold: 10 } },
    owner,
    path: [],
    resourceDeliveryState: {
      building,
      chest,
      phase: 'toChest',
      returnTask: { action: 'minegold', autonomousJob: 'gold', dest: gold, work: 'goldminer' },
      spaceId: 'interior:tc',
    },
    sendToMineResource(target, immediate) {
      calls.push(['sendToMineResource', target.label, immediate, this.spaceId])
      this.dest = target
      this.action = 'minegold'
      return true
    },
    space: { id: 'interior:tc' },
    spaceId: 'interior:tc',
    work: 'goldminer',
  }
  owner.units.push(unit)
  const context = { menu: { refreshInventory: () => calls.push(['refreshInventory']) }, scheduler: { remove() {} } }

  chest.spaceId = unit.spaceId
  unit.isUnitAtDest = () => true
  assert.equal(handleResourceDeliveryAction(context, unit), true)
  assert.equal(unit.resourceDeliveryState.phase, 'leaving')
  assert.equal(calls.some(call => call[0] === 'sendToMineResource'), false)

  completeExit()

  assert.equal(unit.resourceDeliveryState, null)
  assert.equal(unit.dest, gold)
  assert.equal(unit.action, 'minegold')
  assert.deepEqual(calls.find(call => call[0] === 'sendToMineResource'), [
    'sendToMineResource',
    'gold-1',
    true,
    'outside',
  ])
})

test('resource delivery plays a distant chest open cue when a villager deposits resources', () => {
  const sounds = []
  const { handleResourceDeliveryAction } = loadGameResourceDelivery({
    playAudibleSoundCue: (instance, cue, options) => sounds.push({ cue, instance, options }),
  })
  const owner = { buildings: [], units: [] }
  const building = { family: 'building', owner, label: 'town-center', type: 'TownCenter' }
  const chest = { family: 'building', inventory: { resources: {} }, label: 'chest-1', type: 'Chest' }
  const unit = {
    action: 'delivery',
    dest: chest,
    inventory: { resources: { wheat: 6 } },
    owner,
    path: [],
    resourceDeliveryState: {
      building,
      chest,
      phase: 'toChest',
      returnTask: null,
      spaceId: 'interior:tc',
    },
    space: { id: 'interior:tc' },
    spaceId: 'interior:tc',
    stop() {},
  }
  owner.units = [unit]
  const context = {
    menu: { refreshInventory() {} },
    scheduler: { remove() {} },
  }

  chest.spaceId = unit.spaceId
  unit.isUnitAtDest = () => true
  assert.equal(handleResourceDeliveryAction(context, unit), true)

  assert.deepEqual(sounds, [{ cue: 'building/chest-open', instance: chest, options: { profile: 'surface' } }])
})

test('outdoor chest receives wood only after the villager arrives, without interrupting its path', () => {
  const { handleResourceDeliveryAction } = loadGameResourceDelivery()
  const chest = { family: 'building', type: 'Chest', i: 10, j: 10, inventory: { resources: {} } }
  const routes = []
  const unit = {
    action: 'delivery', dest: chest, i: 0, j: 0,
    inventory: { resources: { wood: 10 } },
    path: [{ i: 1, j: 0 }],
    isUnitAtDest(_action, target) { return this.i === target.i && this.j === target.j - 1 },
    sendToEvt: (...args) => routes.push(args),
    stop() {},
  }
  const context = { menu: { refreshInventory() {} }, scheduler: { remove() {} } }
  assert.equal(handleResourceDeliveryAction(context, unit), false)
  assert.deepEqual(chest.inventory.resources, {})
  assert.deepEqual(unit.inventory.resources, { wood: 10 })
  assert.equal(routes.length, 0)

  unit.path = []
  assert.equal(handleResourceDeliveryAction(context, unit), false)
  assert.equal(routes.length, 1)
  assert.equal(routes[0][0], chest)
  assert.deepEqual(chest.inventory.resources, {})

  unit.i = 10
  unit.j = 9
  unit.spaceId = 'interior:other'
  assert.equal(handleResourceDeliveryAction(context, unit), false)
  unit.spaceId = 'outside'
  unit.action = 'chopwood'
  assert.equal(handleResourceDeliveryAction(context, unit), false)
  assert.deepEqual(chest.inventory.resources, {})

  unit.action = 'delivery'
  assert.equal(handleResourceDeliveryAction(context, unit), true)
  assert.deepEqual(chest.inventory.resources, { wood: 10 })
  assert.deepEqual(unit.inventory.resources, {})
})

test('resource delivery system recovers stale leaving states with old task ids', () => {
  const { ResourceDeliverySystem } = loadGameResourceDelivery()
  const calls = []
  const owner = { units: [] }
  const building = { family: 'building', owner, label: 'town-center', type: 'TownCenter' }
  const chest = { family: 'building', inventory: { resources: {} }, label: 'chest-1', type: 'Chest' }
  const stone = { family: 'resource', isDestroyed: false, label: 'stone-1' }
  const unit = {
    autonomousJob: 'stone',
    dest: null,
    handleChangeDest: () => calls.push(['handleChangeDest']),
    inventory: { resources: {} },
    owner,
    path: [],
    previousDest: null,
    previousWork: null,
    resourceDeliveryState: {
      building,
      chest,
      phase: 'leaving',
      returnTask: {
        action: 'minestone',
        autonomousJob: 'stone',
        dest: stone,
        work: 'stoneminer',
      },
      spaceId: 'interior:tc',
      taskId: 999,
    },
    sendToStone: (target, immediate) => calls.push(['sendToStone', target.label, immediate]),
    spaceId: 'outside',
    work: 'stoneminer',
    getActionCondition: (target, action) => target === stone && action === 'minestone',
  }
  owner.units = [unit]
  const tasks = new Map()
  const context = {
    menu: { refreshInventory: () => calls.push(['refreshInventory']) },
    players: [owner],
    scheduler: {
      add(callback, _interval, name) {
        tasks.set(1, { callback, name })
        calls.push(['add', name])
        return 1
      },
      remove: id => calls.push(['remove', id]),
    },
  }
  unit.context = context

  new ResourceDeliverySystem(context)

  assert.equal(unit.resourceDeliveryState, null)
  assert.deepEqual(calls, [
    ['add', 'resource.delivery'],
    ['remove', 999],
    ['refreshInventory'],
    ['handleChangeDest'],
    ['sendToStone', 'stone-1', true],
  ])
})

test('resource delivery system resumes work when a stale delivery state has no resources left', () => {
  const { ResourceDeliverySystem } = loadGameResourceDelivery({
    unitHasDeliverableResourcesForBuilding: () => false,
  })
  const calls = []
  const owner = { units: [] }
  const building = { family: 'building', owner, label: 'town-center', type: 'TownCenter' }
  const chest = { family: 'building', inventory: { resources: {} }, label: 'chest-1', type: 'Chest' }
  const tree = { family: 'resource', isDestroyed: false, label: 'tree-1' }
  const unit = {
    action: null,
    autonomousJob: 'wood',
    dest: null,
    handleChangeDest: () => calls.push(['handleChangeDest']),
    inventory: { resources: {} },
    owner,
    path: [],
    previousDest: null,
    previousWork: null,
    resourceDeliveryState: {
      building,
      chest,
      phase: 'entering',
      returnTask: {
        action: 'chopwood',
        autonomousJob: 'wood',
        dest: tree,
        work: 'woodcutter',
      },
      spaceId: 'interior:tc',
      taskId: 999,
    },
    sendToTree: (target, immediate) => calls.push(['sendToTree', target.label, immediate]),
    spaceId: 'outside',
    work: 'woodcutter',
    getActionCondition: (target, action) => target === tree && action === 'chopwood',
  }
  owner.units = [unit]
  const context = {
    menu: { refreshInventory: () => calls.push(['refreshInventory']) },
    players: [owner],
    scheduler: {
      add(_callback, _interval, name) {
        calls.push(['add', name])
        return 1
      },
      remove: id => calls.push(['remove', id]),
    },
  }
  unit.context = context

  new ResourceDeliverySystem(context)

  assert.equal(unit.resourceDeliveryState, null)
  assert.deepEqual(calls, [
    ['add', 'resource.delivery'],
    ['remove', 999],
    ['refreshInventory'],
    ['handleChangeDest'],
    ['sendToTree', 'tree-1', true],
  ])
})

test('evening delivery clears its delivery state before continuing toward shelter', () => {
  const { ResourceDeliverySystem } = loadGameResourceDelivery({
    continueRestAfterDelivery: candidate => {
      calls.push(['continueRest', candidate.resourceDeliveryState])
      return true
    },
    resumeVillagerJobIntent: () => {
      calls.push(['fallbackToJob'])
      return false
    },
    unitHasDeliverableResourcesForBuilding: () => false,
  })
  const calls = []
  const owner = { units: [] }
  const building = { family: 'building', owner, label: 'town-center', type: 'TownCenter' }
  const chest = { family: 'building', label: 'chest-1', type: 'Chest' }
  const unit = {
    autonomousJob: 'gold',
    inventory: { resources: {} },
    owner,
    resourceDeliveryState: {
      building,
      chest,
      phase: 'leaving',
      returnTask: { action: 'minegold', autonomousJob: 'gold', dest: { label: 'gold-1' }, work: 'goldminer' },
      spaceId: 'interior:tc',
      taskId: 999,
    },
    shelterState: { status: 'delivering', reason: 'sleep', location: 'outside' },
    spaceId: 'outside',
  }
  owner.units.push(unit)
  const context = {
    menu: { refreshInventory: () => calls.push(['refreshInventory']) },
    players: [owner],
    scheduler: {
      add() {
        return 1
      },
      remove: id => calls.push(['remove', id]),
    },
  }
  unit.context = context

  new ResourceDeliverySystem(context)

  assert.equal(unit.resourceDeliveryState, null)
  assert.equal(unit.shelterState.status, 'delivering')
  assert.deepEqual(calls, [
    ['remove', 999],
    ['refreshInventory'],
    ['continueRest', null],
  ])
})

test('delivery sends villagers to rest instead of resuming distant work near day end', () => {
  const calls = []
  const { handleResourceDeliveryAction } = loadGameResourceDelivery({
    canResumeVillagerReturnTaskBeforeRest: (candidate, task) => {
      calls.push(['canResume', task.dest.label])
      return false
    },
    resumeVillagerJobIntent: () => {
      calls.push(['resumeWork'])
      return true
    },
    sendUnitToRest: (candidate, reason) => {
      calls.push(['sendToRest', reason])
      candidate.shelterState = { reason, status: 'movingToRest' }
      return true
    },
  })
  const owner = { units: [] }
  const building = { family: 'building', owner, label: 'town-center', type: 'TownCenter' }
  const chest = { family: 'building', inventory: { resources: {} }, label: 'chest-1', type: 'Chest' }
  const tree = { family: 'resource', label: 'tree-1', type: 'Tree' }
  const unit = {
    action: 'delivery',
    dest: chest,
    inventory: { resources: { wood: 10 } },
    owner,
    resourceDeliveryState: {
      building,
      chest,
      phase: 'toChest',
      returnTask: { action: 'chopwood', autonomousJob: 'wood', dest: tree, work: 'woodcutter' },
      spaceId: 'interior:tc',
      taskId: 999,
    },
    space: { id: 'interior:tc' },
    spaceId: 'interior:tc',
  }
  owner.units.push(unit)
  const context = {
    menu: { refreshInventory: () => calls.push(['refreshInventory']) },
    players: [owner],
    scheduler: {
      add() {
        return 1
      },
      remove: id => calls.push(['remove', id]),
    },
  }
  unit.context = context

  chest.spaceId = unit.spaceId
  unit.isUnitAtDest = () => true
  handleResourceDeliveryAction(context, unit)

  assert.equal(unit.resourceDeliveryState, null)
  assert.deepEqual(calls, [
    ['remove', 999],
    ['refreshInventory'],
    ['canResume', 'tree-1'],
    ['sendToRest', 'sleep'],
  ])
  assert.equal(unit.shelterState.status, 'movingToRest')
})

test('resource delivery system falls back to autonomous job when exact return target is invalid', () => {
  const calls = []
  const { ResourceDeliverySystem } = loadGameResourceDelivery({
    assignVillagerAutonomy: (unit, job, options) => {
      calls.push(['assignAutonomy', job, options])
      unit.dest = { family: 'resource', label: 'gold-2' }
      unit.action = 'minegold'
      return true
    },
    unitHasDeliverableResourcesForBuilding: () => false,
  })
  const owner = { units: [] }
  const building = { family: 'building', owner, label: 'town-center', type: 'TownCenter' }
  const chest = { family: 'building', inventory: { resources: {} }, label: 'chest-1', type: 'Chest' }
  const depletedGold = { family: 'resource', isDestroyed: true, label: 'gold-1' }
  const unit = {
    action: null,
    autonomousJob: null,
    dest: null,
    handleChangeDest: () => calls.push(['handleChangeDest']),
    inventory: { resources: {} },
    owner,
    path: [],
    previousDest: null,
    previousWork: null,
    resourceDeliveryState: {
      building,
      chest,
      phase: 'entering',
      returnTask: {
        action: 'minegold',
        autonomousJob: 'gold',
        dest: depletedGold,
        work: 'goldminer',
      },
      spaceId: 'interior:tc',
      taskId: 999,
    },
    sendToMineResource: () => calls.push(['sendToMineResource']),
    spaceId: 'outside',
    work: null,
    getActionCondition: () => false,
  }
  owner.units = [unit]
  const context = {
    menu: { refreshInventory: () => calls.push(['refreshInventory']) },
    players: [owner],
    scheduler: {
      add(_callback, _interval, name) {
        calls.push(['add', name])
        return 1
      },
      remove: id => calls.push(['remove', id]),
    },
  }
  unit.context = context

  new ResourceDeliverySystem(context)

  assert.equal(unit.resourceDeliveryState, null)
  assert.equal(unit.autonomousJob, 'gold')
  assert.deepEqual(calls, [
    ['add', 'resource.delivery'],
    ['remove', 999],
    ['refreshInventory'],
    ['handleChangeDest'],
    ['assignAutonomy', 'gold', { exploreWhenNoTarget: true, preserveRejectedTargets: true }],
  ])
})

test('resource delivery system reissues a lost building entry order', () => {
  const { ResourceDeliverySystem } = loadGameResourceDelivery()
  const calls = []
  const owner = { units: [] }
  const building = { family: 'building', owner, label: 'town-center', type: 'TownCenter' }
  const chest = { family: 'building', inventory: { resources: {} }, label: 'chest-1', type: 'Chest' }
  const unit = {
    action: null,
    dest: null,
    inventory: { resources: { wood: 10 } },
    owner,
    resourceDeliveryState: {
      building,
      chest,
      phase: 'entering',
      returnTask: null,
      spaceId: 'interior:tc',
    },
    sendToEvt: (target, action, options) => calls.push(['sendToEvt', target.label, action, options.forceRepath]),
    spaceId: 'outside',
  }
  owner.units = [unit]
  const context = {
    players: [owner],
    scheduler: {
      add(_callback, _interval, name) {
        calls.push(['add', name])
        return 1
      },
      remove: id => calls.push(['remove', id]),
    },
  }

  new ResourceDeliverySystem(context)

  assert.deepEqual(calls, [
    ['add', 'resource.delivery'],
    ['sendToEvt', 'town-center', 'delivery', true],
  ])
  assert.equal(unit.resourceDeliveryState.phase, 'entering')
})

test('resource delivery system keeps an unresolved building delivery alive before the chest exists', () => {
  const { ResourceDeliverySystem } = loadGameResourceDelivery()
  const calls = []
  const owner = { units: [] }
  const building = { family: 'building', owner, label: 'town-center', type: 'TownCenter' }
  const unit = {
    action: 'delivery',
    dest: building,
    inventory: { resources: { stone: 10 } },
    owner,
    resourceDeliveryState: {
      building,
      phase: 'toBuilding',
      returnTask: null,
    },
    sendToEvt: (target, action, options) => calls.push(['sendToEvt', target.label, action, options.forceRepath]),
    spaceId: 'outside',
  }
  owner.units = [unit]
  const context = {
    players: [owner],
    scheduler: {
      add(_callback, _interval, name) {
        calls.push(['add', name])
        return 1
      },
      remove: id => calls.push(['remove', id]),
    },
  }

  new ResourceDeliverySystem(context)

  assert.deepEqual(calls, [['add', 'resource.delivery']])
  assert.equal(unit.resourceDeliveryState.phase, 'toBuilding')
  assert.equal(unit.resourceDeliveryState.chest, undefined)
})

test('resource delivery system reissues a lost outer building order before the chest exists', () => {
  const { ResourceDeliverySystem } = loadGameResourceDelivery()
  const calls = []
  const owner = { units: [] }
  const building = { family: 'building', owner, label: 'town-center', type: 'TownCenter' }
  const unit = {
    action: null,
    dest: null,
    inventory: { resources: { stone: 10 } },
    owner,
    resourceDeliveryState: {
      building,
      phase: 'toBuilding',
      returnTask: null,
    },
    sendToEvt: (target, action, options) => calls.push(['sendToEvt', target.label, action, options.forceRepath]),
    spaceId: 'outside',
  }
  owner.units = [unit]
  const context = {
    players: [owner],
    scheduler: {
      add(_callback, _interval, name) {
        calls.push(['add', name])
        return 1
      },
      remove: id => calls.push(['remove', id]),
    },
  }

  new ResourceDeliverySystem(context)

  assert.deepEqual(calls, [
    ['add', 'resource.delivery'],
    ['sendToEvt', 'town-center', 'delivery', true],
  ])
  assert.equal(unit.resourceDeliveryState.phase, 'toBuilding')
})

test('interior storage uses the capacity of each parent building and preserves existing overfull stock', () => {
  const { getBuildingStorageCapacity, getBuildingStorageRemaining } = loadResourceDelivery()
  for (const [type, capacity] of [['TownCenter', 600], ['StoragePit', 3000], ['Granary', 2000]]) {
    const owner = { buildings: [] }
    const chest = { type: 'Chest', label: 'inside', owner, inventory: { resources: { wood: capacity + 50 } } }
    const building = { type, label: 'parent', owner, interiorBuildings: [chest] }
    owner.buildings = [building, chest]
    assert.equal(getBuildingStorageCapacity(building), capacity)
    assert.equal(getBuildingStorageCapacity(chest), capacity)
    assert.equal(getBuildingStorageRemaining(chest), 0)
    assert.equal(chest.inventory.resources.wood, capacity + 50)
  }
})

test('blocked chests reject villager deliveries but still allow manual transfers', () => {
  const { unitHasDeliverableResourcesForBuilding, buildingAcceptsInventoryResource } = loadResourceDelivery()
  const chest = { type: 'Chest', family: 'building', inventory: { resources: {} }, villagerDeliveriesBlocked: true }
  const unit = { type: 'Villager', inventory: { resources: { wood: 10 } } }
  assert.equal(unitHasDeliverableResourcesForBuilding(unit, chest), false)
  assert.equal(buildingAcceptsInventoryResource(chest, 'wood', 10), true)
  chest.villagerDeliveriesBlocked = false
  assert.equal(unitHasDeliverableResourcesForBuilding(unit, chest), true)
})

test('mixed hunting loads finish depositing before returning to the original carcass', () => {
  const nextDepot = { family: 'building', type: 'StoragePit' }
  let resumed = 0
  const { handleResourceDeliveryAction } = loadGameResourceDelivery({
    buildingAcceptsInventoryResource: (_building, resource) => resource === 'meat',
    findResourceDeliveryTarget: unit => unit.inventory.resources.leather ? nextDepot : null,
    resumeVillagerJobIntent: () => { resumed++; return true },
  })
  const chest = { family: 'building', type: 'Chest', inventory: { resources: {} } }
  const originalTask = { action: 'takemeat', dest: { family: 'animal', isDead: true }, work: 'hunter', autonomousJob: 'food' }
  const sent = []
  const unit = {
    action: 'delivery', dest: chest, inventory: { resources: { meat: 10, leather: 2 } },
    resourceDeliveryState: { phase: 'toBuilding', building: chest, returnTask: originalTask },
    isUnitAtDest: () => true,
    sendToDelivery: (building, task) => { sent.push([building, task]); return true },
  }
  const context = { scheduler: { remove() {} }, menu: { refreshInventory() {} } }
  assert.equal(handleResourceDeliveryAction(context, unit), true)
  assert.equal(chest.inventory.resources.meat, 10)
  assert.equal(unit.inventory.resources.leather, 2)
  assert.deepEqual(sent, [[nextDepot, originalTask]])
  assert.equal(resumed, 0)
})
