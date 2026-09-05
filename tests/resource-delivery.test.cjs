const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadResourceDelivery() {
  return loadTsModule('app/lib/resources/resourceDelivery.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: {
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
        buildingAcceptsInventoryResource: () => true,
        unitHasDeliverableResourcesForBuilding: overrides.unitHasDeliverableResourcesForBuilding ?? (() => true),
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
      },
    },
  })
}

test('loading types fill local resource pockets with a capacity of ten', () => {
  const { getResourceKeyForLoadingType, getUnitResourceCapacityRemaining, unitShouldDeliverResource } =
    loadResourceDelivery()
  const villager = {
    inventory: { resources: { meat: 10, stone: 4 } },
    type: 'Villager',
  }

  assert.equal(getResourceKeyForLoadingType('meat'), 'meat')
  assert.equal(getResourceKeyForLoadingType('stone'), 'stone')
  assert.equal(getUnitResourceCapacityRemaining(villager, 'stone'), 6)
  assert.equal(getUnitResourceCapacityRemaining(villager, 'meat'), 0)
  assert.equal(unitShouldDeliverResource(villager, 'meat'), true)
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

  assert.equal(getUnitResourceCapacityRemaining(hero, 'meat'), Number.POSITIVE_INFINITY)
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

  assert.equal(handleResourceDeliveryAction(context, unit), true)

  assert.deepEqual(sounds, [{ cue: 'building/chest-open', instance: chest, options: { profile: 'surface' } }])
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
