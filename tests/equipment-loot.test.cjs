const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadModule(relativePath, mocks = {}) {
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

test('unit corpse loot initializes from resolved equipment and transfers to hero inventory', () => {
  const calls = []
  const { getUnitCorpseLootEquipment, pickupCorpseEquipment } = loadModule('app/lib/equipment/equipmentLoot.ts', {
    '../constants': {
      SHEET_TYPES: { corpse: 'corpseSheet' },
      UNIT_TYPES: { villager: 'Villager' },
    },
    './equipmentStats': {
      refreshUnitEquipmentStats: () => {},
      getUnitEquipment: (...args) => {
        calls.push(['getUnitEquipment', ...args])
        return ['helmet_barbarian_ceramic', 'round_shield_ceramic_slash', 'helmet_barbarian_ceramic']
      },
    },
    '../units/unitExperience': {
      getUnitEquipmentLevel: unit => {
        calls.push(['getUnitEquipmentLevel', unit.label])
        return 2
      },
    },
    '../lpc': {
      applyBakedLpcUnitAssets: unit => calls.push(['applyBakedLpcUnitAssets', unit.label]),
    },
  })
  const corpse = {
    currentSheet: 'corpseSheet',
    family: 'unit',
    isDead: true,
    isDestroyed: false,
    label: 'bandit-1',
    owner: {
      age: 0,
      civ: 'Bandit',
      config: {
        units: {
          BanditSword: { category: 'Fantassin' },
        },
      },
    },
    syncAppearanceLayers: sheet => calls.push(['syncAppearanceLayers', sheet]),
    type: 'BanditSword',
  }
  const hero = {}

  assert.deepEqual(getUnitCorpseLootEquipment(corpse), [
    'helmet_barbarian_ceramic',
    'round_shield_ceramic_slash',
    'helmet_barbarian_ceramic',
  ])
  assert.equal(pickupCorpseEquipment(corpse, hero, 'round_shield_ceramic_slash'), true)

  assert.deepEqual(corpse.lootEquipment, ['helmet_barbarian_ceramic', 'helmet_barbarian_ceramic'])
  assert.deepEqual(hero.inventory.equipment, ['round_shield_ceramic_slash'])
  assert.ok(calls.some(call => call[0] === 'applyBakedLpcUnitAssets' && call[1] === 'bandit-1'))
  assert.ok(calls.some(call => call[0] === 'syncAppearanceLayers' && call[1] === 'corpseSheet'))
})

test('equipment loot labels humanize runtime ids', () => {
  const { formatEquipmentLootLabel, formatEquipmentStackLabel, getEquipmentStacks } = loadModule(
    'app/lib/equipment/equipmentLoot.ts',
    {
      '../constants': {
        SHEET_TYPES: { corpse: 'corpseSheet' },
        UNIT_TYPES: { villager: 'Villager' },
      },
      './equipmentStats': { getUnitEquipment: () => [], refreshUnitEquipmentStats: () => {} },
      '../units/unitExperience': { getUnitEquipmentLevel: () => 0 },
      '../lpc': { applyBakedLpcUnitAssets: () => {} },
    }
  )

  assert.equal(formatEquipmentLootLabel('round_shield_ceramic_slash'), 'Round Shield Ceramic Slash')
  assert.equal(formatEquipmentStackLabel('round_shield_ceramic_slash', 2), 'Round Shield Ceramic Slash x2')
  assert.deepEqual(getEquipmentStacks(['bow', 'bow', 'helmet_barbarian_ceramic']), [
    { equipment: 'bow', count: 2 },
    { equipment: 'helmet_barbarian_ceramic', count: 1 },
  ])
})

test('unit corpse loot transfers pocket resources to hero inventory', () => {
  const { getUnitCorpseLootResources, pickupCorpseResource } = loadModule('app/lib/equipment/equipmentLoot.ts', {
    '../constants': {
      RESOURCE_NAMES: ['wood', 'food', 'stone', 'gold', 'copper', 'iron'],
      SHEET_TYPES: { corpse: 'corpseSheet' },
      UNIT_TYPES: { villager: 'Villager' },
    },
    './equipmentStats': { getUnitEquipment: () => [], refreshUnitEquipmentStats: () => {} },
    '../units/unitExperience': { getUnitEquipmentLevel: () => 0 },
    '../lpc': { applyBakedLpcUnitAssets: () => {} },
  })
  const corpse = {
    inventory: { resources: { wood: 3, stone: 7, gold: 0 } },
    isDead: true,
    isDestroyed: false,
  }
  const hero = { inventory: { resources: { stone: 2 } } }

  assert.deepEqual(getUnitCorpseLootResources(corpse), { wood: 3, stone: 7 })
  assert.equal(pickupCorpseResource(corpse, hero, 'stone', 4), 4)
  assert.deepEqual(corpse.inventory.resources, { wood: 3, stone: 3 })
  assert.deepEqual(hero.inventory.resources, { stone: 6 })
  assert.equal(pickupCorpseResource(corpse, hero, 'stone'), 3)
  assert.deepEqual(corpse.inventory.resources, { wood: 3 })
  assert.deepEqual(hero.inventory.resources, { stone: 9 })
})

test('hero equips bag items into gear and weapon slots with replacement swaps', () => {
  const calls = []
  const { equipHeroInventoryItem, unequipHeroInventorySlot } = loadModule('app/lib/equipment/equipmentLoot.ts', {
    '../constants': {
      SHEET_TYPES: { standing: 'standingSheet', corpse: 'corpseSheet' },
      UNIT_TYPES: { villager: 'Villager' },
    },
    './equipmentStats': {
      getUnitEquipment: () => [],
      refreshUnitEquipmentStats: unit => calls.push(['refreshUnitEquipmentStats', unit.label]),
    },
    '../units/unitExperience': { getUnitEquipmentLevel: () => 0 },
    '../lpc': {
      applyBakedLpcUnitAssets: unit => calls.push(['applyBakedLpcUnitAssets', unit.label]),
    },
  })
  const hero = {
    currentSheet: 'standingSheet',
    inventory: {
      equipment: [
        'helmet_barbarian_ceramic',
        'upward_horns_ceramic',
        'helmet_barbarian_nasal_ceramic',
        'sword_ceramic',
        'sword_bronze',
        'round_shield_ceramic_slash',
        'bow',
        'arrow_copper',
        'arrow_copper',
      ],
      equipped: {},
      activeWeapons: {},
    },
    label: 'hero',
    syncAppearanceLayers: sheet => calls.push(['syncAppearanceLayers', sheet]),
  }

  assert.equal(equipHeroInventoryItem(hero, 'helmet_barbarian_ceramic'), true)
  assert.deepEqual(hero.inventory.equipped, {
    helmet: 'helmet_barbarian_ceramic',
    helmetDecor: 'upward_horns_ceramic',
  })
  assert.deepEqual(hero.inventory.equipment, [
    'helmet_barbarian_nasal_ceramic',
    'sword_ceramic',
    'sword_bronze',
    'round_shield_ceramic_slash',
    'bow',
    'arrow_copper',
    'arrow_copper',
  ])

  assert.equal(equipHeroInventoryItem(hero, 'helmet_barbarian_nasal_ceramic'), true)
  assert.deepEqual(hero.inventory.equipped, {
    helmet: 'helmet_barbarian_nasal_ceramic',
    helmetDecor: 'upward_horns_ceramic',
  })
  assert.deepEqual(hero.inventory.equipment, [
    'sword_ceramic',
    'sword_bronze',
    'round_shield_ceramic_slash',
    'bow',
    'arrow_copper',
    'arrow_copper',
    'helmet_barbarian_ceramic',
  ])

  assert.equal(equipHeroInventoryItem(hero, 'sword_ceramic'), true)
  assert.deepEqual(hero.inventory.activeWeapons, { melee: 'sword_ceramic' })
  assert.equal(equipHeroInventoryItem(hero, 'round_shield_ceramic_slash'), true)
  assert.deepEqual(hero.inventory.equipped, {
    helmet: 'helmet_barbarian_nasal_ceramic',
    helmetDecor: 'upward_horns_ceramic',
    offhand: 'round_shield_ceramic_slash',
  })
  assert.deepEqual(hero.inventory.activeWeapons, {
    melee: 'sword_ceramic',
  })
  assert.equal(equipHeroInventoryItem(hero, 'sword_bronze'), true)
  assert.deepEqual(hero.inventory.activeWeapons, {
    melee: 'sword_bronze',
  })
  assert.equal(equipHeroInventoryItem(hero, 'bow'), true)
  assert.deepEqual(hero.inventory.activeWeapons, {
    melee: 'sword_bronze',
    ranged: 'bow',
  })
  assert.equal(equipHeroInventoryItem(hero, 'arrow_copper'), true)
  assert.deepEqual(hero.inventory.equipped, {
    helmet: 'helmet_barbarian_nasal_ceramic',
    helmetDecor: 'upward_horns_ceramic',
    offhand: 'round_shield_ceramic_slash',
    arrow: 'arrow_copper',
  })
  assert.equal(hero.inventory.equippedCounts.arrow, 2)
  assert.deepEqual(hero.inventory.activeWeapons, {
    melee: 'sword_bronze',
    ranged: 'bow',
  })
  assert.equal(hero.inventory.equipment.includes('arrow_copper'), false)
  assert.ok(hero.inventory.equipment.includes('sword_ceramic'))

  assert.equal(unequipHeroInventorySlot(hero, 'helmetDecor'), true)
  assert.equal(hero.inventory.equipped.helmetDecor, undefined)
  assert.ok(hero.inventory.equipment.includes('upward_horns_ceramic'))
  assert.equal(unequipHeroInventorySlot(hero, 'arrow'), true)
  assert.equal(hero.inventory.equipped.arrow, undefined)
  assert.equal(hero.inventory.equipment.filter(item => item === 'arrow_copper').length, 2)
  assert.ok(calls.some(call => call[0] === 'refreshUnitEquipmentStats' && call[1] === 'hero'))
  assert.ok(calls.some(call => call[0] === 'syncAppearanceLayers' && call[1] === 'standingSheet'))
})

test('helmet decor requires an equipped helmet and is removed with the helmet', () => {
  const calls = []
  const { equipHeroInventoryItem, unequipHeroInventorySlot } = loadModule('app/lib/equipment/equipmentLoot.ts', {
    '../constants': {
      SHEET_TYPES: { standing: 'standingSheet', corpse: 'corpseSheet' },
      UNIT_TYPES: { villager: 'Villager' },
    },
    './equipmentStats': {
      getUnitEquipment: () => [],
      refreshUnitEquipmentStats: unit => calls.push(['refreshUnitEquipmentStats', unit.label]),
    },
    '../units/unitExperience': { getUnitEquipmentLevel: () => 0 },
    '../lpc': {
      applyBakedLpcUnitAssets: unit => calls.push(['applyBakedLpcUnitAssets', unit.label]),
    },
  })
  const hero = {
    currentSheet: 'standingSheet',
    inventory: {
      equipment: ['plumage', 'helmet_norman_ceramic'],
      equipped: {},
      activeWeapons: {},
    },
    label: 'hero',
    syncAppearanceLayers: sheet => calls.push(['syncAppearanceLayers', sheet]),
  }

  assert.equal(equipHeroInventoryItem(hero, 'plumage'), false)
  assert.deepEqual(hero.inventory.equipped, {})
  assert.deepEqual(hero.inventory.equipment, ['plumage', 'helmet_norman_ceramic'])

  assert.equal(equipHeroInventoryItem(hero, 'helmet_norman_ceramic'), true)
  assert.equal(equipHeroInventoryItem(hero, 'plumage'), true)
  assert.deepEqual(hero.inventory.equipped, {
    helmet: 'helmet_norman_ceramic',
    helmetDecor: 'plumage',
  })

  assert.equal(unequipHeroInventorySlot(hero, 'helmet'), true)
  assert.deepEqual(hero.inventory.equipped, {})
  assert.equal(hero.inventory.equipment.includes('helmet_norman_ceramic'), true)
  assert.equal(hero.inventory.equipment.includes('plumage'), true)
  assert.ok(calls.some(call => call[0] === 'refreshUnitEquipmentStats' && call[1] === 'hero'))
  assert.ok(calls.some(call => call[0] === 'syncAppearanceLayers' && call[1] === 'standingSheet'))
})

test('equipping the same arrow type merges the bag stack into the equipped stack', () => {
  const { equipHeroInventoryItem } = loadModule('app/lib/equipment/equipmentLoot.ts', {
    '../constants': {
      SHEET_TYPES: { standing: 'standingSheet', corpse: 'corpseSheet' },
      UNIT_TYPES: { villager: 'Villager' },
    },
    './equipmentStats': {
      getUnitEquipment: () => [],
      refreshUnitEquipmentStats: () => {},
    },
    '../units/unitExperience': { getUnitEquipmentLevel: () => 0 },
    '../lpc': { applyBakedLpcUnitAssets: () => {} },
  })
  const hero = {
    currentSheet: 'standingSheet',
    inventory: {
      equipment: ['arrow_copper', 'arrow_copper'],
      equipped: { arrow: 'arrow_copper' },
      equippedCounts: { arrow: 3 },
      activeWeapons: {},
    },
    syncAppearanceLayers: () => {},
  }

  assert.equal(equipHeroInventoryItem(hero, 'arrow_copper'), true)
  assert.deepEqual(hero.inventory.equipment, [])
  assert.equal(hero.inventory.equipped.arrow, 'arrow_copper')
  assert.equal(hero.inventory.equippedCounts.arrow, 5)
})

test('hero arrow stacks can equip and unequip one item at a time', () => {
  const { equipHeroInventoryItem, unequipHeroInventorySlot } = loadModule('app/lib/equipment/equipmentLoot.ts', {
    '../constants': {
      SHEET_TYPES: { standing: 'standingSheet', corpse: 'corpseSheet' },
      UNIT_TYPES: { villager: 'Villager' },
    },
    './equipmentStats': {
      getUnitEquipment: () => [],
      refreshUnitEquipmentStats: () => {},
    },
    '../units/unitExperience': { getUnitEquipmentLevel: () => 0 },
    '../lpc': { applyBakedLpcUnitAssets: () => {} },
  })
  const hero = {
    currentSheet: 'standingSheet',
    inventory: {
      equipment: ['arrow_copper', 'arrow_copper', 'arrow_copper'],
      equipped: {},
      equippedCounts: {},
      activeWeapons: {},
    },
    syncAppearanceLayers: () => {},
  }

  assert.equal(equipHeroInventoryItem(hero, 'arrow_copper', 1), true)
  assert.equal(hero.inventory.equipped.arrow, 'arrow_copper')
  assert.equal(hero.inventory.equippedCounts.arrow, 1)
  assert.equal(hero.inventory.equipment.filter(item => item === 'arrow_copper').length, 2)

  assert.equal(equipHeroInventoryItem(hero, 'arrow_copper', 2), true)
  assert.equal(hero.inventory.equippedCounts.arrow, 3)
  assert.equal(hero.inventory.equipment.filter(item => item === 'arrow_copper').length, 0)

  assert.equal(unequipHeroInventorySlot(hero, 'arrow', 1), true)
  assert.equal(hero.inventory.equipped.arrow, 'arrow_copper')
  assert.equal(hero.inventory.equippedCounts.arrow, 2)
  assert.equal(hero.inventory.equipment.filter(item => item === 'arrow_copper').length, 1)

  assert.equal(unequipHeroInventorySlot(hero, 'arrow', 2), true)
  assert.equal(hero.inventory.equipped.arrow, undefined)
  assert.equal(hero.inventory.equippedCounts.arrow, undefined)
  assert.equal(hero.inventory.equipment.filter(item => item === 'arrow_copper').length, 3)
})
