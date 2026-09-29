const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const moduleCache = new Map()
const { advanceVillageWork } = loadTsModule('app/services/world/VillageWorkSimulation.ts', {
  moduleCache,
  mocks: {
    'pixi.js': { Assets: { cache: { get: () => ({}) } } },
    '../../lib/economy/configuredWorkTiming': { offlineWorkCycleMs: () => 1000 },
    '../../lib/units/playerTargetKnowledge': {
      knowsEconomicTarget: (_owner, source, worker) => Math.hypot(source.i - worker.i, source.j - worker.j) <= 30,
      playerSeesTarget: () => false,
    },
    '../../lib/mapSpaces': {
      isOutsideSpaceId: id => !id || id === 'outside',
      getEntitySpaceId: e => e?.spaceId ?? 'outside',
      ensureOutsideMapSpace: map => ({ grid: map.grid }),
      moveEntityToMapSpace(map, unit, _space, cell) {
        if (map.grid[unit.i][unit.j].has === unit) map.grid[unit.i][unit.j].has = null
        Object.assign(unit, { i: cell.i, j: cell.j })
        cell.has = unit
      },
    },
  },
})
function fixture() {
  const grid = Array.from({ length: 90 }, (_, i) =>
    Array.from({ length: 90 }, (_, j) => ({ i, j, category: 'Grass', z: 0 }))
  )
  const home = { id: 'center', i: 40, j: 40, spaceId: 'outside' }
  const store = {
    type: 'TownCenter',
    family: 'building',
    label: 'center',
    i: 36,
    j: 36,
    isBuilt: true,
    inventory: { resources: {} },
  }
  const owner = {
    type: 'AI',
    label: 'owner',
    buildings: [store],
    config: { units: { Villager: { speed: 1.5, gatherAmount: { woodcutter: 1 } } } },
  }
  const context = { map: { grid, revealEverything: true }, players: [owner] }
  const unit = {
    type: 'Villager',
    family: 'unit',
    label: 'worker',
    i: 40,
    j: 40,
    autonomousJob: 'wood',
    villageHome: home,
    owner,
    context,
  }
  const tree = {
    type: 'Tree',
    family: 'resource',
    label: 'tree',
    i: 40,
    j: 42,
    quantity: 3,
    hitPoints: 0,
    die() {
      this.isDestroyed = true
      grid[this.i][this.j].has = null
    },
  }
  for (const entity of [unit, tree, store]) grid[entity.i][entity.j].has = entity
  return { context, home, owner, unit, tree, store }
}
test('distant work depletes real nodes and commits only real stock once', () => {
  const { context, home, owner, unit, tree, store } = fixture()
  advanceVillageWork(context, home, owner, [unit], 60000)
  assert.equal(tree.quantity, 0)
  assert.equal(tree.isDestroyed, true)
  assert.equal(store.inventory.resources.wood ?? 0, 0)
  assert.equal(unit.inventory.resources.wood, 3)
  advanceVillageWork(context, home, owner, [unit], 60000)
  assert.equal(store.inventory.resources.wood ?? 0, 0)
  assert.equal(unit.inventory.resources.wood, 3)
})
test('resources outside the village and inaccessible resources cannot feed distant production', () => {
  for (const blocked of [false, true]) {
    const { context, home, owner, unit, tree, store } = fixture()
    if (!blocked) {
      context.map.grid[tree.i][tree.j].has = null
      tree.j = 71
      context.map.grid[tree.i][tree.j].has = tree
    } else {
      for (let i = 0; i < 90; i++) context.map.grid[i][41].category = 'Water'
    }
    advanceVillageWork(context, home, owner, [unit], 60000)
    assert.equal(tree.quantity, 3)
    assert.equal(store.inventory.resources.wood ?? 0, 0)
  }
})
test('short simulation slices retain travel progress and reach the same finite harvest', () => {
  const { context, home, owner, unit, tree, store } = fixture()
  for (let i = 0; i < 60; i++) advanceVillageWork(context, home, owner, [unit], 1000)
  assert.equal(tree.quantity, 0)
  assert.equal(store.inventory.resources.wood ?? 0, 0)
  assert.equal(unit.inventory.resources.wood, 3)
})

test('competing workers cannot duplicate a finite node; town centers receive nothing', () => {
  const { context, home, owner, unit, tree, store } = fixture()
  store.villagerDeliveriesBlocked = true
  const second = { ...unit, label: 'second', i: 39, inventory: { resources: {} } }
  context.map.grid[39][40].has = second
  advanceVillageWork(context, home, owner, [unit, second], 60000)
  assert.equal(tree.quantity, 0)
  assert.equal(store.inventory.resources.wood ?? 0, 0)
  assert.equal((unit.inventory?.resources?.wood ?? 0) + (second.inventory?.resources?.wood ?? 0), 3)
})

test('autonomous gathering preserves a useful target while supplying construction', () => {
  const { context, home, owner, unit, tree, store } = fixture()
  owner.isPlayed = true
  owner.type = 'Human'
  unit.work = 'woodcutter'
  unit.action = 'chopwood'
  unit.dest = tree
  unit.collectiveTask = 'wood'
  unit.inventory = { resources: { wheat: 12 } }
  owner.buildings.push({
    label: 'project',
    type: 'House',
    i: 44,
    j: 44,
    isBuilt: false,
    hitPoints: 1,
    constructionMaterials: { cost: { wood: 100 }, consumed: {}, delivered: {} },
  })
  tree.quantity = 100
  const nearer = { ...tree, label: 'nearer', j: 41, quantity: 100 }
  context.map.grid[40][41].has = nearer
  advanceVillageWork(context, home, owner, [unit], 20000, 0)
  assert.ok(tree.quantity < 100)
  assert.equal(nearer.quantity, 100)
  assert.equal(unit.dest, tree)
  const consumed = 100 - tree.quantity
  assert.equal((store.inventory.resources.wood ?? 0) + (unit.inventory?.resources?.wood ?? 0), consumed)
})

test('player offline construction commits completion once and respects its queue', () => {
  const { context, home, owner, unit } = fixture()
  owner.isPlayed = true
  owner.type = 'Human'
  owner.config.buildings = { House: { totalHitPoints: 100, constructionTime: 10 } }
  let completions = 0
  const house = {
    label: 'house',
    type: 'House',
    family: 'building',
    i: 43,
    j: 43,
    hitPoints: 1,
    totalHitPoints: 100,
    isBuilt: false,
    updateHitPoints() {
      if (this.hitPoints >= 100 && !this.isBuilt) {
        this.isBuilt = true
        completions++
      }
    },
  }
  owner.buildings.push(house)
  context.map.grid[43][43].has = house
  unit.work = 'builder'
  unit.action = 'build'
  unit.autonomousJob = 'construction'
  unit.dest = house
  unit.buildQueue = [house]
  advanceVillageWork(context, home, owner, [unit], 60000, 0)
  assert.equal(house.hitPoints, 100)
  assert.equal(completions, 1)
  assert.deepEqual(unit.buildQueue, [])
  advanceVillageWork(context, home, owner, [unit], 60000, 60000)
  assert.equal(completions, 1)
})

test('player offline work respects night schedules and does not replay daily upkeep', () => {
  const { context, home, owner, unit, tree, store } = fixture()
  owner.isPlayed = true
  owner.type = 'Human'
  unit.work = 'woodcutter'
  unit.action = 'chopwood'
  unit.dest = tree
  store.inventory.resources.berry = 20
  // World begins at 07:30; +13 hours is 20:30.
  advanceVillageWork(context, home, owner, [unit], 60000, 13 * 60000)
  assert.equal(tree.quantity, 3)
  assert.equal(store.inventory.resources.berry, 20)
})

function settlement(type) {
  const f = fixture()
  const { owner, unit, store, tree, context } = f
  owner.type = type
  owner.isPlayed = type === 'Human'
  owner.units = [unit]
  owner.config.units.Villager.gatherAmount = { woodcutter: 1, stoneminer: 1, forager: 1 }
  owner.config.buildings = { TownCenter: { size: 1, totalHitPoints: 101, constructionTime: 20 } }
  Object.assign(store, {
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 101,
    constructionMaterials: { cost: { wood: 6, stone: 4 }, consumed: {}, delivered: {} },
    updateHitPoints() {
      if (this.hitPoints >= this.totalHitPoints) this.isBuilt = true
    },
  })
  Object.assign(unit, {
    action: null,
    work: null,
    autonomousJob: null,
    collectiveTask: null,
    inactif: true,
    inventory: { resources: { wheat: 24 } },
  })
  tree.quantity = 20
  const stone = { ...tree, label: 'stone', type: 'Stone', j: 44, quantity: 20, hitPoints: 100 }
  context.map.grid[40][44].has = stone
  return { ...f, stone }
}

test('three skipped days build an autonomous settlement from finite materials for both owners', () => {
  const { DAY_NIGHT_CONFIG } = loadTsModule('app/config/gameplay.ts')
  const results = []
  for (const type of ['Human', 'AI']) {
    const f = settlement(type)
    for (let day = 0; day < 3; day++)
      advanceVillageWork(
        f.context,
        f.home,
        f.owner,
        [f.unit],
        DAY_NIGHT_CONFIG.dayLengthMs,
        day * DAY_NIGHT_CONFIG.dayLengthMs
      )
    assert.equal(f.store.isBuilt, true, type)
    assert.deepEqual(f.store.constructionMaterials.consumed, { wood: 6, stone: 4 }, type)
    assert.equal(f.tree.quantity, 14, type)
    assert.equal(f.stone.quantity, 16, type)
    assert.equal(f.unit.inventory.resources.wheat, 12, type)
    results.push({ inventory: f.unit.inventory, materials: f.store.constructionMaterials, job: f.unit.autonomousJob })
  }
  assert.deepEqual(results[0], results[1])
})

test('nextday three times catches up an idle player settlement and returning does not replay it', () => {
  const { PlayerWorkActivitySystem } = loadTsModule('app/services/world/PlayerWorkActivitySystem.ts', {
    moduleCache,
    mocks: { '../../lib/units/unitEnergy': { cancelEnergyWait() {}, updateUnitEnergy() {} } },
  })
  const { DayNightSystem } = loadTsModule('app/services/DayNightSystem.ts', {
    moduleCache,
    mocks: { '../lib/lang': { t: (_key, params) => `Day ${params.day}` } },
  })
  const { forceNextDay } = loadTsModule('app/dev-console/actions/world.ts', { moduleCache })
  const { isUnitSuspended } = loadTsModule('app/lib/units/unitSuspension.ts', { moduleCache })
  const f = settlement('Human')
  const hero = { type: 'Hero', i: 900, j: 900 }
  Object.assign(f.context, {
    app: { ticker: { add() {}, remove() {} } },
    scheduler: { elapsedMs: 0 },
    controls: { heroUnit: hero, instanceInCamera: () => false },
  })
  f.context.dayNight = new DayNightSystem(f.context)
  const work = new PlayerWorkActivitySystem(f.context)
  // Same day-change settlement boundary as DailyWorldEventSystem.
  f.context.dayNight.onDayChange(() => work.flush())
  work.update()
  assert.equal(isUnitSuspended(f.unit), true)
  for (let day = 0; day < 3; day++) assert.equal(forceNextDay(f.context).ok, true)
  assert.equal(f.store.isBuilt, true)
  assert.equal(f.unit.inventory.resources.wheat, 12)
  const inventory = structuredClone(f.unit.inventory)
  Object.assign(hero, { i: 40, j: 40 })
  work.update()
  assert.equal(isUnitSuspended(f.unit), false)
  assert.deepEqual(f.unit.inventory, inventory)
  work.destroy()
  f.context.dayNight.destroy()
})

test('one three-day catch-up matches daily settlement including meals and materials', () => {
  const { DAY_NIGHT_CONFIG } = loadTsModule('app/config/gameplay.ts')
  const whole = settlement('Human')
  const split = settlement('Human')
  advanceVillageWork(whole.context, whole.home, whole.owner, [whole.unit], 3 * DAY_NIGHT_CONFIG.dayLengthMs, 0)
  for (let day = 0; day < 3; day++)
    advanceVillageWork(
      split.context,
      split.home,
      split.owner,
      [split.unit],
      DAY_NIGHT_CONFIG.dayLengthMs,
      day * DAY_NIGHT_CONFIG.dayLengthMs
    )
  assert.deepEqual(whole.unit.inventory, split.unit.inventory)
  assert.deepEqual(whole.store.constructionMaterials, split.store.constructionMaterials)
  assert.equal(whole.tree.quantity, split.tree.quantity)
  assert.equal(whole.stone.quantity, split.stone.quantity)
  assert.equal(whole.unit.lastMealAt, split.unit.lastMealAt)
})

test('idle residents consume provisions and autonomously replenish them without a construction project', () => {
  const { DAY_NIGHT_CONFIG } = loadTsModule('app/config/gameplay.ts')
  for (const type of ['Human', 'AI']) {
    const f = settlement(type)
    f.store.isBuilt = true
    f.unit.inventory.resources = { wheat: 8 }
    const berry = { ...f.stone, type: 'Berrybush', label: 'berries', quantity: 40 }
    f.context.map.grid[berry.i][berry.j].has = berry
    advanceVillageWork(f.context, f.home, f.owner, [f.unit], 3 * DAY_NIGHT_CONFIG.dayLengthMs, 0)
    assert.ok(berry.quantity < 40, type)
    assert.equal(f.tree.quantity, 20, 'no needless materials harvested without a project or reserve')
    const bag = f.unit.inventory.resources
    assert.equal((bag.wheat ?? 0) + (bag.berry ?? 0) + berry.quantity, 8 + 40 - 12, type)
  }
})

test('legacy resource jobs rejoin autonomous priorities equally for player and AI residents', () => {
  const { DAY_NIGHT_CONFIG } = loadTsModule('app/config/gameplay.ts')
  for (const type of ['Human', 'AI']) {
    const f = settlement(type)
    Object.assign(f.unit, { autonomousJob: 'wood', work: 'woodcutter', action: 'chopwood', dest: f.tree })
    advanceVillageWork(f.context, f.home, f.owner, [f.unit], 3 * DAY_NIGHT_CONFIG.dayLengthMs, 0)
    assert.equal(f.store.isBuilt, true, type)
    assert.equal(f.tree.quantity, 14, type)
    assert.equal(f.stone.quantity, 16, type)
  }
})

test('autonomous construction withdraws and consumes shared depot stock without creating new projects', () => {
  const { DAY_NIGHT_CONFIG } = loadTsModule('app/config/gameplay.ts')
  for (const type of ['Human', 'AI']) {
    const f = settlement(type)
    f.tree.quantity = 0
    f.stone.quantity = 0
    const depot = {
      family: 'building',
      type: 'StoragePit',
      label: 'depot',
      i: 45,
      j: 40,
      isBuilt: true,
      inventory: { resources: { wood: 6, stone: 4 } },
    }
    f.owner.buildings.push(depot)
    f.context.map.grid[45][40].has = depot
    advanceVillageWork(f.context, f.home, f.owner, [f.unit], 3 * DAY_NIGHT_CONFIG.dayLengthMs, 0)
    assert.equal(f.store.isBuilt, true, type)
    assert.equal(depot.inventory.resources.wood ?? 0, 0, type)
    assert.equal(depot.inventory.resources.stone ?? 0, 0, type)
    assert.deepEqual(f.store.constructionMaterials.consumed, { wood: 6, stone: 4 })
    assert.equal(f.owner.buildings.length, 2, 'execution never decides to create a project')
  }
})

test('autonomous villagers use nearby economic knowledge without requiring hero exploration', () => {
  const { DAY_NIGHT_CONFIG } = loadTsModule('app/config/gameplay.ts')
  const f = settlement('Human')
  f.context.map.revealEverything = false
  advanceVillageWork(f.context, f.home, f.owner, [f.unit], 3 * DAY_NIGHT_CONFIG.dayLengthMs, 0)
  assert.equal(f.store.isBuilt, true)
})

test('a legacy gathering job stops once no stock or project needs it', () => {
  const f = settlement('Human')
  f.store.isBuilt = true
  Object.assign(f.unit, { autonomousJob: 'wood', work: 'woodcutter', action: 'chopwood', dest: f.tree })
  advanceVillageWork(f.context, f.home, f.owner, [f.unit], 20000, 0)
  assert.equal(f.tree.quantity, 20)
  assert.equal(f.unit.autonomousJob, null)
  assert.equal(f.unit.action, null)
})

test('coarse sleep projects room workers to the doorway without moving live occupants out of their shelter', () => {
  const { context, home, owner, unit } = fixture()
  context.map.grid[unit.i][unit.j].has = null
  Object.assign(unit, {
    i: 2,
    j: 3,
    spaceId: 'house-room',
    hitPoints: 5,
    totalHitPoints: 20,
    dailySchedule: {
      bedMinute: 1320,
      wakeMinute: 360,
      workStartMinute: 420,
      workEndMinute: 1080,
      lunchStartMinute: 720,
      lunchEndMinute: 780,
    },
  })
  const shelter = { status: 'inside', reason: 'sleep' }
  unit.shelterState = shelter
  context.map.spaces = new Map([
    ['house-room', { portals: [{ targetSpaceId: 'outside', targetCell: { i: 40, j: 40 } }] }],
  ])
  advanceVillageWork(context, home, owner, [unit], 60000, (22 - 7.5) * 60000, true)
  assert.equal(unit.spaceId, 'house-room')
  assert.equal(unit.i, 2)
  assert.equal(unit.j, 3)
  assert.equal(unit.shelterState, shelter)
  assert.equal(unit.hitPoints, 7.5)
})

test('exhausting local AI work hands resource search back to the live dispatcher', () => {
  const { context, home, owner, unit, tree } = fixture()
  unit.collectiveTask = 'wood'
  unit.inventory = { resources: { meat: 6, berry: 6 } }
  owner.units = [unit]
  const pit = { type: 'StoragePit', label: 'pit', i: 44, j: 40, isBuilt: true, inventory: { resources: {} } }
  owner.buildings.push(pit)
  context.map.grid[44][40].has = pit
  advanceVillageWork(context, home, owner, [unit], 90000, 0)
  assert.equal(tree.quantity, 0)
  assert.equal(unit.autonomousJob, null)
  assert.equal(unit.autonomyBlockedJob, 'wood')
})
