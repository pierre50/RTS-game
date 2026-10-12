const assert = require('node:assert/strict')
const { createInventoryContainer, moveInventoryResource } = require('./helpers/loadTsModule.cjs').loadTsModule(
  'app/lib/inventory/inventoryContainers.ts'
)
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
        return ['helmet_barbarian_leather', 'round_shield_wood_slash', 'helmet_barbarian_leather']
      },
    },
    '../units/unitExperience': {
      getUnitEquipmentTier: unit => {
        calls.push(['getUnitEquipmentTier', unit.label])
        return 2
      },
    },
    '../lpc': {
      refreshBakedLpcUnitAssets: unit => calls.push(['refreshBakedLpcUnitAssets', unit.label]),
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
  const hero = { owner: { age: 2 } }

  assert.deepEqual(getUnitCorpseLootEquipment(corpse), [
    'helmet_barbarian_leather',
    'round_shield_wood_slash',
    'helmet_barbarian_leather',
  ])
  assert.equal(pickupCorpseEquipment(corpse, hero, 'round_shield_wood_slash'), true)

  assert.deepEqual(corpse.lootEquipment, ['helmet_barbarian_leather', 'helmet_barbarian_leather'])
  assert.deepEqual(hero.inventory.equipment, ['round_shield_wood_slash'])
  assert.ok(calls.some(call => call[0] === 'refreshBakedLpcUnitAssets' && call[1] === 'bandit-1'))
  assert.ok(calls.some(call => call[0] === 'syncAppearanceLayers' && call[1] === 'corpseSheet'))
})

test('unit corpse loot can be frozen at death even after an empty transient cache', () => {
  const { initializeUnitCorpseLootEquipment } = loadModule('app/lib/equipment/equipmentLoot.ts', {
    '../constants': {
      SHEET_TYPES: { corpse: 'corpseSheet' },
      UNIT_TYPES: { villager: 'Villager' },
    },
    './equipmentStats': {
      refreshUnitEquipmentStats: () => {},
      getUnitEquipment: () => ['axe_ceramic', 'helmet_barbarian_nasal_leather'],
    },
    '../units/unitExperience': { getUnitEquipmentTier: () => 0 },
    '../lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const corpse = {
    isDead: true,
    isDestroyed: false,
    lootEquipment: [],
    owner: {
      age: 0,
      civ: 'Bandit',
      config: {
        units: {
          BanditSword: { category: 'Bandit' },
        },
      },
    },
    type: 'BanditSword',
  }

  assert.deepEqual(initializeUnitCorpseLootEquipment(corpse), ['axe_ceramic', 'helmet_barbarian_nasal_leather'])
  assert.deepEqual(corpse.lootEquipment, ['axe_ceramic', 'helmet_barbarian_nasal_leather'])
})

test('archer corpses loot only the actual remaining arrow stack', () => {
  const { initializeUnitCorpseLootEquipment } = loadModule('app/lib/equipment/equipmentLoot.ts', {
    '../constants': {
      SHEET_TYPES: { corpse: 'corpseSheet' },
      UNIT_TYPES: { villager: 'Villager' },
    },
    './equipmentStats': {
      refreshUnitEquipmentStats: () => {},
      getUnitEquipment: () => ['quiver', 'bow', 'arrow_bronze'],
    },
    '../units/unitExperience': { getUnitEquipmentTier: () => 0 },
    '../lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const corpse = {
    inventory: { equipment: Array(5).fill('arrow_bronze'), npcArrows: { initialized: true } },
    context: { map: { randomRange: (min, max) => Math.min(max, min + 2) } },
    isDead: true,
    isDestroyed: false,
    owner: {
      age: 1,
      civ: 'Hellas',
      config: {
        units: {
          Bowman: { category: 'Archer', corpseLootArrowMin: 3, corpseLootArrowMax: 8 },
        },
      },
    },
    type: 'Bowman',
  }

  assert.deepEqual(initializeUnitCorpseLootEquipment(corpse), [
    'bow',
    'arrow_bronze',
    'arrow_bronze',
    'arrow_bronze',
    'arrow_bronze',
    'arrow_bronze',
  ])
})

test('equipment loot labels use localized catalog names', () => {
  const { formatEquipmentLootLabel, formatEquipmentStackLabel, getEquipmentStacks } = loadModule(
    'app/lib/equipment/equipmentLoot.ts',
    {
      '../constants': {
        SHEET_TYPES: { corpse: 'corpseSheet' },
        UNIT_TYPES: { villager: 'Villager' },
      },
      './equipmentStats': { getUnitEquipment: () => [], refreshUnitEquipmentStats: () => {} },
      '../units/unitExperience': { getUnitEquipmentTier: () => 0 },
      '../lpc': { refreshBakedLpcUnitAssets: () => {} },
    }
  )

  assert.equal(formatEquipmentLootLabel('round_shield_wood_slash'), 'Bouclier rond en bois et cuir')
  assert.equal(formatEquipmentLootLabel('axe_ceramic'), 'Hache en pierre')
  assert.equal(formatEquipmentStackLabel('round_shield_wood_slash', 2), 'Bouclier rond en bois et cuir x2')
  assert.deepEqual(getEquipmentStacks(['bow', 'bow', 'helmet_barbarian_leather']), [
    { equipment: 'bow', count: 2 },
    { equipment: 'helmet_barbarian_leather', count: 1 },
  ])
})

test('unit corpse loot transfers pocket resources to hero inventory', () => {
  const { getUnitCorpseLootResources } = loadModule('app/lib/equipment/equipmentLoot.ts', {
    '../constants': {
      RESOURCE_STORAGE_NAMES: ['wood', 'berry', 'meat', 'wheat', 'stone', 'gold', 'copper', 'iron'],
      SHEET_TYPES: { corpse: 'corpseSheet' },
      UNIT_TYPES: { villager: 'Villager' },
    },
    './equipmentStats': { getUnitEquipment: () => [], refreshUnitEquipmentStats: () => {} },
    '../units/unitExperience': { getUnitEquipmentTier: () => 0 },
    '../lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const corpse = {
    inventory: { resources: { wood: 3, stone: 7, gold: 0 } },
    isDead: true,
    isDestroyed: false,
  }
  const hero = { owner: { age: 2 }, inventory: { resources: { stone: 2 } } }

  assert.deepEqual(getUnitCorpseLootResources(corpse), { wood: 3, stone: 7 })
  assert.equal(
    moveInventoryResource(
      createInventoryContainer(corpse, { id: 'corpse', labelKey: 'corpse' }),
      createInventoryContainer(hero, { id: 'hero', labelKey: 'hero' }),
      'stone',
      4
    ),
    4
  )
  assert.deepEqual(corpse.inventory.resources, { wood: 3, stone: 3 })
  assert.deepEqual(hero.inventory.resources, { stone: 6 })
  assert.equal(
    moveInventoryResource(
      createInventoryContainer(corpse, { id: 'corpse', labelKey: 'corpse' }),
      createInventoryContainer(hero, { id: 'hero', labelKey: 'hero' }),
      'stone'
    ),
    3
  )
  assert.deepEqual(corpse.inventory.resources, { wood: 3 })
  assert.deepEqual(hero.inventory.resources, { stone: 9 })
  for (let i = 0; i < 20; i++)
    assert.equal(
      moveInventoryResource(
        createInventoryContainer(corpse, { id: 'corpse', labelKey: 'corpse' }),
        createInventoryContainer(hero, { id: 'hero', labelKey: 'hero' }),
        'stone'
      ),
      0
    )
  assert.deepEqual(hero.inventory.resources, { stone: 9 })
})

test('hero equips found bag items into gear and weapon slots with replacement swaps', () => {
  const calls = []
  const { equipHeroInventoryItem, unequipHeroActiveWeaponSlot, unequipHeroInventorySlot } = loadModule(
    'app/lib/equipment/equipmentLoot.ts',
    {
      '../constants': {
        SHEET_TYPES: { standing: 'standingSheet', corpse: 'corpseSheet' },
        UNIT_TYPES: { villager: 'Villager' },
      },
      './equipmentStats': {
        getUnitEquipment: () => [],
        refreshUnitEquipmentStats: unit => calls.push(['refreshUnitEquipmentStats', unit.label]),
      },
      '../units/unitExperience': { getUnitEquipmentTier: () => 0 },
      '../lpc': {
        refreshBakedLpcUnitAssets: unit => calls.push(['refreshBakedLpcUnitAssets', unit.label]),
      },
    }
  )
  const hero = {
    owner: { age: 0 },
    currentSheet: 'standingSheet',
    inventory: {
      equipment: [
        'helmet_barbarian_leather~decor:upward_horns_white',
        'helmet_barbarian_nasal_leather',
        'axe_ceramic',
        'sword_bronze',
        'catchingPole',
        'round_shield_wood_slash',
        'bow',
        'arrow_bronze',
        'arrow_bronze',
      ],
      equipped: {},
      activeWeapons: {},
    },
    label: 'hero',
    syncAppearanceLayers: sheet => calls.push(['syncAppearanceLayers', sheet]),
  }

  assert.equal(equipHeroInventoryItem(hero, 'helmet_barbarian_leather~decor:upward_horns_white'), true)
  assert.deepEqual(hero.inventory.equipped, {
    helmet: 'helmet_barbarian_leather~decor:upward_horns_white',
  })
  assert.deepEqual(hero.inventory.equipment, [
    'helmet_barbarian_nasal_leather',
    'axe_ceramic',
    'sword_bronze',
    'catchingPole',
    'round_shield_wood_slash',
    'bow',
    'arrow_bronze',
    'arrow_bronze',
  ])

  assert.equal(equipHeroInventoryItem(hero, 'helmet_barbarian_nasal_leather'), true)
  assert.deepEqual(hero.inventory.equipped, {
    helmet: 'helmet_barbarian_nasal_leather',
  })
  assert.deepEqual(hero.inventory.equipment, [
    'axe_ceramic',
    'sword_bronze',
    'catchingPole',
    'round_shield_wood_slash',
    'bow',
    'arrow_bronze',
    'arrow_bronze',
    'helmet_barbarian_leather~decor:upward_horns_white',
  ])

  assert.equal(equipHeroInventoryItem(hero, 'axe_ceramic'), true)
  assert.deepEqual(hero.inventory.activeWeapons, { tool: 'axe_ceramic' })
  assert.equal(equipHeroInventoryItem(hero, 'round_shield_wood_slash'), true)
  assert.deepEqual(hero.inventory.equipped, {
    helmet: 'helmet_barbarian_nasal_leather',
    offhand: 'round_shield_wood_slash',
  })
  assert.deepEqual(hero.inventory.activeWeapons, {
    tool: 'axe_ceramic',
  })
  assert.equal(equipHeroInventoryItem(hero, 'sword_bronze'), true)
  assert.deepEqual(hero.inventory.activeWeapons, {
    tool: 'axe_ceramic',
    melee: 'sword_bronze',
  })
  assert.equal(equipHeroInventoryItem(hero, 'catchingPole'), true)
  assert.deepEqual(hero.inventory.activeWeapons, {
    tool: 'axe_ceramic',
    melee: 'catchingPole',
  })
  assert.ok(hero.inventory.equipment.includes('sword_bronze'))
  assert.equal(equipHeroInventoryItem(hero, 'bow'), true)
  assert.deepEqual(hero.inventory.activeWeapons, {
    tool: 'axe_ceramic',
    melee: 'catchingPole',
    ranged: 'bow',
  })
  assert.equal(equipHeroInventoryItem(hero, 'arrow_bronze'), true)
  assert.deepEqual(hero.inventory.equipped, {
    helmet: 'helmet_barbarian_nasal_leather',
    offhand: 'round_shield_wood_slash',
    arrow: 'arrow_bronze',
  })
  assert.equal(hero.inventory.equippedCounts.arrow, 2)
  assert.deepEqual(hero.inventory.activeWeapons, {
    tool: 'axe_ceramic',
    melee: 'catchingPole',
    ranged: 'bow',
  })
  assert.equal(hero.inventory.equipment.includes('arrow_bronze'), false)
  assert.equal(hero.inventory.activeWeapons.tool, 'axe_ceramic')

  assert.equal(unequipHeroActiveWeaponSlot(hero, 'ranged'), true)
  assert.equal(hero.inventory.activeWeapons.ranged, undefined)
  assert.ok(hero.inventory.equipment.includes('bow'))
  assert.equal(unequipHeroInventorySlot(hero, 'helmetDecor'), false)
  assert.equal(hero.inventory.equipped.helmetDecor, undefined)
  assert.ok(hero.inventory.equipment.includes('helmet_barbarian_leather~decor:upward_horns_white'))
  assert.equal(unequipHeroInventorySlot(hero, 'arrow'), true)
  assert.equal(hero.inventory.equipped.arrow, undefined)
  assert.equal(hero.inventory.equipment.filter(item => item === 'arrow_bronze').length, 2)
  assert.ok(calls.some(call => call[0] === 'refreshUnitEquipmentStats' && call[1] === 'hero'))
  assert.ok(calls.some(call => call[0] === 'syncAppearanceLayers' && call[1] === 'standingSheet'))
})

test('legacy loose helmet decor becomes one item and stays attached when unequipped', () => {
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
    '../units/unitExperience': { getUnitEquipmentTier: () => 0 },
    '../lpc': {
      refreshBakedLpcUnitAssets: unit => calls.push(['refreshBakedLpcUnitAssets', unit.label]),
    },
  })
  const hero = {
    owner: { age: 2 },
    currentSheet: 'standingSheet',
    inventory: {
      equipment: ['plumage', 'helmet_norman_bronze'],
      equipped: {},
      activeWeapons: {},
    },
    label: 'hero',
    syncAppearanceLayers: sheet => calls.push(['syncAppearanceLayers', sheet]),
  }

  assert.equal(equipHeroInventoryItem(hero, 'plumage'), false)
  assert.deepEqual(hero.inventory.equipped, {})
  assert.deepEqual(hero.inventory.equipment, ['helmet_norman_bronze~decor:plumage'])

  assert.equal(equipHeroInventoryItem(hero, 'helmet_norman_bronze~decor:plumage'), true)
  assert.deepEqual(hero.inventory.equipped, {
    helmet: 'helmet_norman_bronze~decor:plumage',
  })

  assert.equal(unequipHeroInventorySlot(hero, 'helmet'), true)
  assert.deepEqual(hero.inventory.equipped, {})
  assert.equal(hero.inventory.equipment.includes('helmet_norman_bronze~decor:plumage'), true)
  assert.equal(hero.inventory.equipment.includes('plumage'), false)
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
    '../units/unitExperience': { getUnitEquipmentTier: () => 0 },
    '../lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const hero = {
    owner: { age: 2 },
    currentSheet: 'standingSheet',
    inventory: {
      equipment: ['arrow_bronze', 'arrow_bronze'],
      equipped: { arrow: 'arrow_bronze' },
      equippedCounts: { arrow: 3 },
      activeWeapons: {},
    },
    syncAppearanceLayers: () => {},
  }

  assert.equal(equipHeroInventoryItem(hero, 'arrow_bronze'), true)
  assert.deepEqual(hero.inventory.equipment, [])
  assert.equal(hero.inventory.equipped.arrow, 'arrow_bronze')
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
    '../units/unitExperience': { getUnitEquipmentTier: () => 0 },
    '../lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const hero = {
    owner: { age: 2 },
    currentSheet: 'standingSheet',
    inventory: {
      equipment: ['arrow_bronze', 'arrow_bronze', 'arrow_bronze'],
      equipped: {},
      equippedCounts: {},
      activeWeapons: {},
    },
    syncAppearanceLayers: () => {},
  }

  assert.equal(equipHeroInventoryItem(hero, 'arrow_bronze', 1), true)
  assert.equal(hero.inventory.equipped.arrow, 'arrow_bronze')
  assert.equal(hero.inventory.equippedCounts.arrow, 1)
  assert.equal(hero.inventory.equipment.filter(item => item === 'arrow_bronze').length, 2)

  assert.equal(equipHeroInventoryItem(hero, 'arrow_bronze', 2), true)
  assert.equal(hero.inventory.equippedCounts.arrow, 3)
  assert.equal(hero.inventory.equipment.filter(item => item === 'arrow_bronze').length, 0)

  assert.equal(unequipHeroInventorySlot(hero, 'arrow', 1), true)
  assert.equal(hero.inventory.equipped.arrow, 'arrow_bronze')
  assert.equal(hero.inventory.equippedCounts.arrow, 2)
  assert.equal(hero.inventory.equipment.filter(item => item === 'arrow_bronze').length, 1)

  assert.equal(unequipHeroInventorySlot(hero, 'arrow', 2), true)
  assert.equal(hero.inventory.equipped.arrow, undefined)
  assert.equal(hero.inventory.equippedCounts.arrow, undefined)
  assert.equal(hero.inventory.equipment.filter(item => item === 'arrow_bronze').length, 3)
})

test('legacy helmet wings migrate into the helmet without a separate slot', () => {
  const { equipHeroInventoryItem, unequipHeroInventorySlot } = loadModule('app/lib/equipment/equipmentLoot.ts', {
    './equipmentStats': { getUnitEquipment: () => [], refreshUnitEquipmentStats: () => {} },
    '../units/unitExperience': { getUnitEquipmentTier: () => 0 },
    '../lpc': { refreshBakedLpcUnitAssets: () => {} },
  })
  const hero = { owner: { age: 2 }, inventory: { equipment: ['helmet_wings_gold', 'helmet_iron'] } }
  assert.equal(equipHeroInventoryItem(hero, 'helmet_wings_gold'), false)
  assert.deepEqual(hero.inventory.equipment, ['helmet_iron~decor:helmet_wings_gold'])
  assert.equal(equipHeroInventoryItem(hero, 'helmet_iron~decor:helmet_wings_gold'), true)
  assert.deepEqual(hero.inventory.equipped, { helmet: 'helmet_iron~decor:helmet_wings_gold' })
  assert.equal(unequipHeroInventorySlot(hero, 'helmet'), true)
  assert.deepEqual(hero.inventory.equipped, {})
  assert.deepEqual(hero.inventory.equipment, ['helmet_iron~decor:helmet_wings_gold'])
})

test('corpse resource storage stays attached across pickups and deposits, including empty corpses', () => {
  const { getUnitCorpseLootResources } = loadModule('app/lib/equipment/equipmentLoot.ts')
  const corpse = { isDead: true }
  const resources = getUnitCorpseLootResources(corpse)
  assert.equal(corpse.inventory.resources, resources)
  resources.wood = 3
  const hero = { controlMode: 'hero', inventory: { resources: {} } }
  assert.equal(
    moveInventoryResource(
      createInventoryContainer(corpse, { id: 'corpse', labelKey: 'corpse' }),
      createInventoryContainer(hero, { id: 'hero', labelKey: 'hero' }),
      'wood',
      1
    ),
    1
  )
  assert.equal(getUnitCorpseLootResources(corpse), resources)
  assert.equal(resources.wood, 2)
})
