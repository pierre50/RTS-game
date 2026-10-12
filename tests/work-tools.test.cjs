const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const options = { moduleCache: new Map() }
const load = file => loadTsModule(file, options)
const tools = load('app/lib/equipment/workTools.ts')
const { initializeWorkTools } = load('app/lib/equipment/workToolMigration.ts')
const { equipHeroInventoryItemData } = load('app/lib/equipment/heroEquipmentData.ts')
const { wearEquippedTool, wearEquippedWeapon } = load('app/lib/equipment/equipmentWear.ts')
const { getEquipmentCombatStats, getUnitWorkEquipment } = load('app/lib/equipment/equipmentStats.ts')
const definitions = require('../public/assets/data/gameplay/equipment.json')

for (const type of ['Hero', 'Villager']) {
  test(`${type} receives real tools once, preserves worn copies, and never recreates removed tools`, () => {
    const unit = {
      type,
      work: 'stoneminer',
      inventory: { equipment: ['pickaxe_bronze~uses:17'], activeWeapons: { melee: 'axe_ceramic~condition:42' } },
    }
    initializeWorkTools(unit)
    assert.equal(unit.inventory.activeWeapons.tool, 'pickaxe_bronze~uses:17')
    assert.equal(unit.inventory.activeWeapons.melee, undefined)
    assert.deepEqual(unit.inventory.equipment.sort(), ['axe_ceramic~condition:42', 'hammer_ceramic', 'scythe_ceramic'])
    const saved = JSON.parse(JSON.stringify(unit))
    initializeWorkTools(saved)
    assert.deepEqual(saved, unit)
    saved.inventory.equipment = []
    delete saved.inventory.activeWeapons.tool
    initializeWorkTools(saved)
    assert.equal(saved.inventory.activeWeapons.tool, undefined)
    assert.deepEqual(saved.inventory.equipment, [])
  })
}

test('equipping each tool swaps a real item and unlocks only its associated activity', () => {
  const hero = { type: 'Hero' }
  initializeWorkTools(hero)
  const actions = { axe: 'chopwood', pickaxe: 'mineiron', hammer: 'build', scythe: 'farm' }
  for (const [family, action] of Object.entries(actions)) {
    const item = `${family}_ceramic`
    if (hero.inventory.activeWeapons.tool !== item) assert.equal(equipHeroInventoryItemData(hero, item), true)
    assert.equal(hero.inventory.equipment.length, 3)
    assert.equal(hero.inventory.equipment.includes(item), false)
    for (const [other, otherAction] of Object.entries(actions))
      assert.equal(tools.hasRequiredWorkTool(hero, otherAction), otherAction === 'farm' || family === other)
    assert.equal(tools.hasRequiredWorkTool(hero, 'forageberry'), true)
    hero.inventory.toolsStowed = true
    assert.equal(tools.hasRequiredWorkTool(hero, action), action === 'farm')
    hero.inventory.toolsStowed = false
  }
})

test('bag tools and forge research never replace an absent, wrong or broken equipped tool', () => {
  const hero = {
    type: 'Hero',
    inventory: { activeWeapons: { tool: 'axe_ceramic' }, equipment: ['pickaxe_iron'] },
    owner: { forgeUpgrades: { pickaxes: 3 } },
  }
  assert.deepEqual(getUnitWorkEquipment('stoneminer', hero), [])
  assert.equal(tools.hasRequiredWorkTool(hero, 'minestone'), false)
  hero.inventory.activeWeapons.tool = 'pickaxe_bronze~condition:0'
  assert.equal(tools.hasRequiredWorkTool(hero, 'minestone'), false)
  assert.equal(load('app/lib/resources/miningEquipment.ts').hasIronMiningPickaxe(hero), false)
  hero.inventory.activeWeapons.tool = 'pickaxe_ceramic'
  assert.deepEqual(getUnitWorkEquipment('stoneminer', hero), ['pickaxe_ceramic'])
})

test('work and melee wear the very same Tool item, while the separate sword is untouched', () => {
  const hero = {
    type: 'Hero',
    work: 'stoneminer',
    inventory: { activeWeapons: { tool: 'pickaxe_bronze~uses:2', melee: 'sword_iron' } },
  }
  wearEquippedTool(hero, 'mineiron')
  assert.equal(hero.inventory.activeWeapons.tool, 'pickaxe_bronze~uses:1')
  wearEquippedWeapon(hero, 'melee')
  assert.equal(hero.inventory.activeWeapons.tool, 'pickaxe_bronze~condition:0')
  assert.equal(hero.inventory.activeWeapons.melee, 'sword_iron')
  assert.equal(tools.hasRequiredWorkTool(hero, 'mineiron'), false)
})

test('NPCs use the equipped tool in combat, never another tool from the bag', () => {
  const { getNpcWeaponChoice } = load('app/lib/units/combat/npcWeapons.ts')
  const unit = {
    type: 'Villager',
    x: 0,
    y: 0,
    dest: { family: 'unit', x: 10, y: 0 },
    inventory: {
      toolsInitialized: true,
      npcWeaponsInitialized: true,
      activeWeapons: { tool: 'hammer_ceramic' },
      equipment: ['axe_iron'],
    },
    owner: { config: { equipment: definitions } },
  }
  assert.equal(getNpcWeaponChoice(unit).weapon, 'hammer_ceramic')
  wearEquippedWeapon(unit, 'melee')
  assert.equal(unit.inventory.activeWeapons.tool, 'hammer_ceramic~uses:299')
  unit.inventory.toolsStowed = true
  assert.equal(getNpcWeaponChoice(unit).weapon, undefined)
})

test('all four tool families have low material damage and forge/market replacements', () => {
  const { FORGE_EQUIPMENT_RECIPES } = load('app/lib/hero/heroForgeRecipes.ts')
  const { getMarketEquipmentOffers } = load('app/lib/equipment/equipmentMarket.ts')
  const offers = getMarketEquipmentOffers({ buildingLevel: 2 })
  for (const family of tools.WORK_TOOL_FAMILIES)
    for (const [tier, material] of ['ceramic', 'bronze', 'iron'].entries()) {
      const item = `${family}_${material}`
      assert.equal(getEquipmentCombatStats([item], definitions).weaponPower, [2, 4, 5][tier])
      assert.ok(
        FORGE_EQUIPMENT_RECIPES.some(recipe => recipe.outputEquipment === item),
        item
      )
      assert.ok(
        offers.some(offer => offer.equipment === item),
        item
      )
    }
})

test('R stows all held equipment without changing inventory, and Tool draws it again', () => {
  const visuals = []
  const { HeroEquipmentController } = loadTsModule('app/controllers/HeroEquipmentController.ts', {
    mocks: {
      '../lib/hero/heroTools': {
        HERO_TOOL_ORDER: ['interact', 'sword', 'bow'],
        isHeroToolAvailable: () => true,
        isHeroCatchingPoleEquipped: () => false,
        isHeroPowerChargeActiveForTool: () => false,
        cancelHeroCatchingPole() {},
        cancelHeroPowerCharge() {},
        applyToolAppearance: (_unit, tool) => visuals.push(tool),
      },
      '../lib/lpc/baked': { refreshBakedLpcUnitAssets() {} },
      '../lib/equipment/equipmentStats': { refreshUnitEquipmentStats() {} },
    },
  })
  const unit = {
    inventory: { activeWeapons: { tool: 'axe_ceramic', melee: 'sword_iron' }, equipment: ['hammer_ceramic'] },
    stop() {},
    setTextures() {},
  }
  const host = { heroUnit: unit, controls: { context: {} }, equippedItem: 'sword' }
  const controller = new HeroEquipmentController(host)
  const before = structuredClone(unit.inventory.activeWeapons)
  controller.setEquippedItem(null)
  assert.equal(unit.inventory.toolsStowed, true)
  assert.equal(unit.work, 'attacker')
  assert.deepEqual(unit.inventory.activeWeapons, before)
  controller.setEquippedItem('interact')
  assert.equal(unit.inventory.toolsStowed, false)
  assert.deepEqual(visuals, ['interact'])
})

test('offline repair and woodcutting stop at tool breakage and cannot work with bag tools', () => {
  const { buildOffline, gatherOffline } = load('app/services/world/work/OfflineWorkImpacts.ts')
  const unit = {
    type: 'Villager',
    action: 'build',
    inventory: {
      toolsInitialized: true,
      activeWeapons: { tool: 'hammer_ceramic~uses:1' },
      equipment: ['hammer_iron'],
      resources: {},
    },
  }
  const target = { type: 'House', isBuilt: true, hitPoints: 50, totalHitPoints: 100, constructionTime: 100 }
  const step = {
    unit,
    target,
    player: {},
    playerIndex: 0,
    cycle: 100,
    rules: { buildingConfig: () => ({ totalHitPoints: 100, constructionTime: 100 }) },
    report: {},
    spatial: {},
  }
  buildOffline(step, 10000)
  assert.equal(target.hitPoints, 51)
  assert.equal(unit.inventory.activeWeapons.tool, 'hammer_ceramic~condition:0')
  assert.equal(buildOffline(step, 10000).status, 'skip')
  assert.equal(target.hitPoints, 51)
  unit.action = 'chopwood'
  unit.inventory.activeWeapons.tool = 'axe_ceramic~uses:1'
  const tree = { type: 'Tree', quantity: 20, hitPoints: 3 }
  const gathering = {
    ...step,
    target: tree,
    work: 'woodcutter',
    stored: 'wood',
    config: { gatherAmount: { woodcutter: 1 } },
  }
  gatherOffline(gathering, 10000)
  assert.equal(tree.hitPoints, 2)
  assert.equal(unit.inventory.activeWeapons.tool, 'axe_ceramic~condition:0')
  assert.equal(gatherOffline(gathering, 10000).status, 'skip')
  // The last use must also break after felling, even though a wood lot needs two swings.
  tree.hitPoints = 0
  unit.inventory.activeWeapons.tool = 'axe_ceramic~uses:1'
  gatherOffline(gathering, 10000)
  assert.equal(unit.inventory.activeWeapons.tool, 'axe_ceramic~condition:0')
  assert.equal(tree.quantity, 20)
})

test('the actual action gate rejects construction with the wrong, stowed or broken tool', () => {
  const { getActionCondition } = load('app/lib/combat/combatActionConditions.ts')
  const source = {
    type: 'Hero',
    family: 'unit',
    hitPoints: 20,
    owner: { label: 'player' },
    inventory: { activeWeapons: { tool: 'hammer_ceramic' } },
  }
  const target = {
    type: 'House',
    family: 'building',
    owner: source.owner,
    hitPoints: 10,
    totalHitPoints: 100,
    isBuilt: false,
  }
  assert.equal(getActionCondition(source, target, 'build'), true)
  source.inventory.toolsStowed = true
  assert.equal(getActionCondition(source, target, 'build'), false)
  source.inventory.toolsStowed = false
  source.inventory.activeWeapons.tool = 'axe_iron'
  assert.equal(getActionCondition(source, target, 'build'), false)
  source.inventory.activeWeapons.tool = 'hammer_ceramic~condition:0'
  assert.equal(getActionCondition(source, target, 'build'), false)
})
