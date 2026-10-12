const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { workerInventory } = require('./helpers/workerInventory.cjs')
const cache = new Map()
const load = path => loadTsModule(path, { moduleCache: cache })
const { setConstructionPaused, canManageConstructionPause } = load('app/lib/buildings/constructionPause.ts')
const { assignConstructionWork, constructionAssignment } = load('app/lib/economy/constructionAssignments.ts')
const { createSettlementPlan } = load('app/lib/economy/collectiveSettlementPlan.ts')
const {
  createConstructionMaterials,
  deliverConstructionMaterials,
  advanceMaterialConstruction,
  applyConstructionWork,
  hasConstructionWork,
} = load('app/lib/economy/constructionMaterials.ts')
const { consumeVillageWorkChange } = load('app/lib/units/village/villageWorkEvents.ts')
const { buildOffline } = load('app/services/world/work/OfflineWorkImpacts.ts')

function fixture() {
  const owner = { isPlayed: true, units: [], buildings: [] }
  const site = {
    type: 'House',
    label: 'site',
    i: 10,
    j: 10,
    owner,
    isBuilt: false,
    hitPoints: 75,
    totalHitPoints: 75,
    constructionProgress: 0,
    constructionWorkRequired: 20,
    constructionTime: 48,
    constructionMaterials: createConstructionMaterials({ wood: 10, stone: 5 }),
  }
  owner.buildings.push(site)
  return { owner, site }
}

test('pausing releases builders and ingredient/transport missions immediately, leaving cargo and work intact', () => {
  const { owner, site } = fixture()
  deliverConstructionMaterials(site, [{ wood: 5 }])
  let stopped = 0
  for (const job of ['construction', 'wood', 'construction']) {
    const unit = {
      type: 'Villager',
      i: 10,
      j: 9,
      autonomousJob: job,
      collectiveTask: job,
      inventory: { ...workerInventory('hammer_ceramic'), resources: { wood: 3, wheat: 12 } },
      stop: () => {
        assert.equal(site.constructionPaused, true)
        stopped++
      },
    }
    assignConstructionWork(unit, { site, resource: 'wood', target: 10 })
    owner.units.push(unit)
  }
  const before = structuredClone(site.constructionMaterials)
  assert.equal(setConstructionPaused(site, true), true)
  assert.equal(stopped, 3)
  assert.equal(hasConstructionWork(site), false)
  assert.deepEqual(site.constructionMaterials, before)
  assert.equal(site.constructionProgress, 0)
  for (const unit of owner.units) {
    assert.equal(constructionAssignment(unit), undefined)
    assert.equal(unit.autonomousJob, null)
    assert.equal(unit.collectiveTask, null)
    assert.equal(unit.inventory.resources.wood, 3)
  }
  assert.equal(consumeVillageWorkChange(owner), true)
  assert.equal(setConstructionPaused(site, true), false)
  assert.equal(setConstructionPaused(site, false), true)
  assert.equal(hasConstructionWork(site), true)
  assert.equal(consumeVillageWorkChange(owner), true)
})

test('paused projects are absent from both material goals and builder assignments; other projects stay active', () => {
  const { owner, site } = fixture()
  const other = { ...site, label: 'other', i: 12, constructionMaterials: createConstructionMaterials({ fiber: 4 }) }
  owner.buildings.push(other)
  setConstructionPaused(site, true)
  const plan = createSettlementPlan(owner, site, [], [], () => 10)
  assert.deepEqual(plan.sites, [other])
  assert.equal(plan.missing.wood, 0)
  assert.equal(plan.missing.stone, 0)
  assert.equal(plan.boards[0].needed.fiber, 4)
  setConstructionPaused(site, false)
  assert.deepEqual(createSettlementPlan(owner, site, [], [], () => 10).sites, [site, other])
})

test('pause blocks all delivery and work, and resuming continues from the same progress', () => {
  const { site } = fixture()
  const bag = { wood: 10, stone: 5 }
  setConstructionPaused(site, true)
  assert.deepEqual(deliverConstructionMaterials(site, [bag]), {})
  assert.equal(advanceMaterialConstruction(site, 20), 0)
  applyConstructionWork(site, 20)
  assert.deepEqual(bag, { wood: 10, stone: 5 })
  assert.equal(site.constructionProgress, 0)
  setConstructionPaused(site, false)
  deliverConstructionMaterials(site, [bag])
  applyConstructionWork(site, advanceMaterialConstruction(site, 8))
  assert.equal(site.constructionProgress, 0.4)
  setConstructionPaused(site, true)
  assert.equal(advanceMaterialConstruction(site, 20), 8)
  applyConstructionWork(site, 20)
  assert.equal(site.constructionProgress, 0.4)
  setConstructionPaused(site, false)
  applyConstructionWork(site, advanceMaterialConstruction(site, 20))
  assert.equal(site.constructionProgress, 1)
  assert.deepEqual(site.constructionMaterials.consumed, { wood: 10, stone: 5 })
})

test('offline pause spends no work budget, cargo or tool uses and drops pending work time', () => {
  const { owner, site } = fixture()
  setConstructionPaused(site, true)
  const unit = {
    inventory: { ...workerInventory('hammer_ceramic'), resources: { wood: 10, stone: 5 } },
    offlineWork: { target: 'builder:site', milliseconds: 10000 },
  }
  const tool = unit.inventory.activeWeapons.tool
  const result = buildOffline({ player: owner, unit, target: site }, 100000)
  assert.deepEqual(result, { budget: 100000, status: 'skip' })
  assert.equal(unit.offlineWork, undefined)
  assert.equal(unit.inventory.activeWeapons.tool, tool)
  assert.deepEqual(unit.inventory.resources, { wood: 10, stone: 5 })
  assert.equal(site.constructionProgress, 0)
})

test('pause persists in full saves and village snapshots, including renovations and old saves without a flag', () => {
  const { owner, site } = fixture()
  site.isBuilt = true
  site.buildingUpgrade = { targetLevel: 1, constructionTime: 2000, constructionProgress: 0.25 }
  setConstructionPaused(site, true)
  const { buildingData } = loadTsModule('app/serialization/entity/EntitySaveData.ts', {
    mocks: {
      '../../lib': {
        filterObject: (object, keys) =>
          Object.fromEntries(keys.filter(key => object[key] !== undefined).map(key => [key, object[key]])),
      },
    },
  })
  const { serializeEconomyPlayer } = load('app/serialization/VillageEconomySnapshot.ts')
  const saved = JSON.parse(JSON.stringify(buildingData(site)))
  assert.equal(saved.constructionPaused, true)
  assert.equal(saved.buildingUpgrade.constructionProgress, 0.25)
  const snapshot = serializeEconomyPlayer(owner)
  assert.equal(snapshot.buildings[0].constructionPaused, true)
  assert.equal(hasConstructionWork(saved), false)
  delete saved.constructionPaused
  assert.equal(hasConstructionWork(saved), true)
})

test('foreign buildings, completed buildings and destroyed projects cannot be managed', () => {
  const { site, owner } = fixture()
  owner.isPlayed = false
  assert.equal(canManageConstructionPause(site), false)
  assert.equal(setConstructionPaused(site, true), false)
  owner.isPlayed = true
  site.isBuilt = true
  assert.equal(canManageConstructionPause(site), false)
  site.isBuilt = false
  site.isDestroyed = true
  assert.equal(setConstructionPaused(site, true), false)
})
