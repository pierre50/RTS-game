const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { constructionToolPreparation, equipOwnedTool } = loadTsModule('app/lib/units/supplies/toolPreparation.ts')
const { supplyTownTool } = loadTsModule('app/lib/units/supplies/townToolSupply.ts')
const { simulateOfflineWorld } = loadTsModule('app/services/world/offline/OfflineWorldSimulation.ts')
const { automaticDepositAmount } = loadTsModule('app/lib/resources/resourceDelivery.ts')

function fixture() {
  const unit = {
    type: 'Villager',
    label: 'companion',
    i: 10,
    j: 10,
    inactif: true,
    inventory: {
      toolsInitialized: true,
      npcWeaponsInitialized: true,
      npcArrows: { initialized: true },
      activeWeapons: {},
      equipment: [],
      resources: { wheat: 12 },
    },
  }
  const site = {
    type: 'House',
    label: 'house',
    i: 14,
    j: 14,
    isBuilt: false,
    hitPoints: 11,
    totalHitPoints: 11,
    constructionTime: 4,
    constructionProgress: 0,
    constructionMaterials: { cost: { wood: 20, stone: 10 }, consumed: {}, delivered: {} },
  }
  const owner = {
    type: 'Human',
    label: 'owner',
    units: [unit],
    buildings: [{ type: 'FireCamp', label: 'camp', i: 8, j: 8, isBuilt: true }, site],
  }
  return { unit, site, owner }
}

test('homeless companion prepares only production tools and hammer, reserving their costs', () => {
  const f = fixture()
  assert.deepEqual(constructionToolPreparation(f.unit, f.owner).needed, ['axe', 'pickaxe', 'hammer'])
  f.unit.inventory.resources.wood = 4
  f.unit.inventory.resources.stone = 5
  assert.equal(automaticDepositAmount({ ...f.unit, owner: f.owner }, 'wood'), 0)
  assert.equal(supplyTownTool(f.unit, f.owner), false)
  f.unit.inventory.resources.wood = 8
  f.unit.inventory.resources.stone = 10
  assert.equal(supplyTownTool(f.unit, f.owner), true)
  assert.equal(f.unit.inventory.activeWeapons.tool, 'axe_ceramic')
  assert.deepEqual(
    { wood: f.unit.inventory.resources.wood, stone: f.unit.inventory.resources.stone },
    { wood: 4, stone: 5 }
  )
  assert.deepEqual(constructionToolPreparation(f.unit, f.owner).needed, ['pickaxe', 'hammer'])
  assert.equal(f.site.constructionProgress, 0)
  f.unit.followingHero = true
  assert.equal(constructionToolPreparation(f.unit, f.owner), undefined)
})

test('tools swap from the bag without duplication and preparation stops with the project', () => {
  const f = fixture()
  f.unit.inventory.activeWeapons.tool = 'axe_ceramic'
  f.unit.inventory.equipment = ['pickaxe_ceramic', 'hammer_ceramic']
  assert.equal(constructionToolPreparation(f.unit, f.owner), undefined)
  assert.equal(equipOwnedTool(f.unit, 'hammer'), true)
  assert.deepEqual(f.unit.inventory.equipment.sort(), ['axe_ceramic', 'pickaxe_ceramic'])
  f.unit.inventory.equipment = []
  f.site.isBuilt = true
  assert.equal(constructionToolPreparation(f.unit, f.owner), undefined)
})

test('camp bootstrap builds a house from eighteen ground items then finite trees and stone', () => {
  const f = fixture()
  const resources = Array.from({ length: 18 }, (_, n) => ({
    type: n < 8 ? 'GroundWood' : 'GroundStone',
    label: `ground-${n}`,
    i: 16 + n,
    j: 12,
    quantity: 1,
    totalQuantity: 1,
  }))
  resources.push(
    { type: 'Tree', label: 'tree', i: 20, j: 20, quantity: 100, totalQuantity: 100, hitPoints: 2 },
    { type: 'Stone', label: 'stone', i: 21, j: 22, quantity: 100, totalQuantity: 100 }
  )
  const state = { players: [f.owner], resources, animals: [], camera: { x: 0, y: 0 } }
  const options = {
    terrain: Array.from({ length: 40 }, () => Array.from({ length: 40 }, () => ({ category: 'Land' }))),
    unitConfig: () => ({ speed: 1.5, gatherAmount: { woodcutter: 1, stoneminer: 1, forager: 1 } }),
    buildingConfig: () => ({ size: 1, constructionTime: 4, totalHitPoints: 11 }),
    cycleMs: () => 100,
    wheatMatureFrame: 5,
    runtimeOwnsMeals: true,
    runtimeOwnsDailyEvents: true,
    runtimeOwnsTraining: true,
    autonomousResidents: true,
  }
  for (let from = 0; from < 600000 && !f.site.isBuilt; from += 1000)
    simulateOfflineWorld(state, { ...options, fromElapsedMs: from, toElapsedMs: from + 1000 })
  assert.equal(f.site.isBuilt, true, JSON.stringify(f.unit))
  assert.ok(
    f.unit.inventory.equipment.some(item => item.startsWith('axe_ceramic')) ||
      f.unit.inventory.activeWeapons.tool?.startsWith('axe_')
  )
})

test('live homeless companion walks for tool materials and retains the camp anchor', () => {
  const f = fixture()
  f.unit.owner = f.owner
  f.unit.context = { scheduler: { elapsedMs: 0 } }
  const target = { type: 'GroundWood', family: 'resource', i: 28, j: 10, quantity: 1 }
  let reachable = false,
    picked = 0
  f.unit.sendToEvt = destination => {
    assert.equal(destination, target)
    return true
  }
  const { seekGroundToolMaterials } = loadTsModule('app/lib/units/village/villageGroundRecovery.ts', {
    mocks: {
      '../../hero/heroGroundCollection': {
        collectGroundResource: () => {
          picked++
          return true
        },
      },
      '../../hero/heroActionRange': { isHeroInteractionTargetReachable: () => reachable },
      '../autonomy/villagerKnownTargets': {
        knownResources: (_unit, type) =>
          (Array.isArray(type) ? type.includes('GroundWood') : type === 'GroundWood') ? [target] : [],
      },
      '../autonomy/villagerAutonomyAvailability': { villagerAutonomySuspension: () => null },
      '../../resources/resourceDelivery': {
        getUnitResourceCapacityRemaining: () => 18,
        getUnitResourceCarryRemaining: () => 18,
      },
    },
  })
  assert.equal(seekGroundToolMaterials(f.unit), true)
  assert.equal(f.unit.villageHome, undefined)
  assert.deepEqual([f.unit.collectiveHome.i, f.unit.collectiveHome.j], [8, 8])
  assert.equal(picked, 0)
  f.unit.i = 28
  reachable = true
  f.unit.context.scheduler.elapsedMs = 10000
  assert.equal(seekGroundToolMaterials(f.unit), true)
  assert.equal(picked, 1)
  assert.ok(constructionToolPreparation(f.unit, f.owner))
})

test('loaded bags prepare tools sequentially without consuming food or spare equipment', () => {
  const { groundToolPlan } = loadTsModule('app/lib/units/supplies/groundToolRecovery.ts')
  const f = fixture()
  f.unit.inventory.equipment = ['sword_ceramic']
  // Only 17 spaces remain: the 18 ingredients for two production tools cannot fit.
  assert.deepEqual(groundToolPlan(f.unit, f.owner).cost, { wood: 4, stone: 5 })
  f.unit.inventory.resources.wood = 4
  f.unit.inventory.resources.stone = 5
  assert.equal(supplyTownTool(f.unit, f.owner), true)
  assert.equal(f.unit.inventory.activeWeapons.tool, 'axe_ceramic')
  assert.equal(f.unit.inventory.resources.wheat, 12)
  assert.deepEqual(f.unit.inventory.equipment, ['sword_ceramic'])
  assert.ok(constructionToolPreparation(f.unit, f.owner).needed.includes('pickaxe'))
  assert.equal(f.site.constructionProgress, 0)
})
