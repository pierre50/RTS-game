const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('forge crafts into the hero bag and rechecks proximity, construction and destruction on click', () => {
  const previousDocument = global.document
  global.document = {
    createElement: () => ({
      appendChild() {},
      append() {},
      textContent: '',
      dataset: {},
      classList: { toggle() {}, add() {} },
      setAttribute() {},
      addEventListener() {},
      querySelector() {
        return null
      },
    }),
  }
  let reachable = true
  const rows = []
  const { HeroForgeBody } = loadTsModule('app/ui/hero-building/HeroForgeBody.ts', {
    mocks: {
      '../../lib/ui/VariantRow': { attachVariantRow() {} },
      '../../lib/avatar': {},
      '../inventory/InventoryItemRows': {
        createInventoryEquipmentRow: () => ({ element: {} }),
        createInventoryResourceRow: () => ({ element: {} }),
      },
      '../inventory/InventoryCostMeta': { inventoryCostMetaParts: () => [] },
      '../../lib/graphics/assets': { getIconPath: () => '' },
      '../../lib/hero/heroActionRange': { isHeroInteractionTargetReachable: () => reachable },
      '../../lib/hero/placeableInventoryItems': { getPlaceableInventoryBuildingType: () => null },
      '../../lib/lang': { t: key => key },
      '../inventory/InventoryItemIcons': { createInventoryEquipmentIcon: () => ({}) },
      '../inventory/InventoryActionRow': {
        createInventoryActionRow: options => {
          rows.push(options)
          return { element: { querySelector: () => null }, icon: { appendChild() {} } }
        },
      },
      '../equipment/equipmentLoot': {
        getHeroInventory: hero => hero.inventory,
        addHeroInventoryItem: (hero, item) => hero.inventory.equipment.push(item),
        removeHeroInventoryItem: () => false,
      },
    },
  })
  try {
    const hero = { type: 'Hero', inventory: { resources: { wood: 10, feather: 4, bronzeIngot: 2 }, equipment: [] } }
    const menu = { context: { player: { age: 0 }, controls: { heroUnit: hero } }, showMessage() {}, updateTopbar() {} }
    const forge = { type: 'Forge', isBuilt: true }
    new HeroForgeBody(menu, forge)
    const arrows = rows.find(row => row.id === 'craft-arrow_bronze')
    assert.equal(arrows.disabled, false)
    arrows.trailingAction.onClick()
    assert.equal(hero.inventory.equipment.length, 1)
    assert.deepEqual(hero.inventory.resources, { wood: 9, feather: 4, bronzeIngot: 1 })
    for (const state of ['distant', 'unfinished', 'destroyed']) {
      reachable = state !== 'distant'
      forge.isBuilt = state !== 'unfinished'
      forge.isDestroyed = state === 'destroyed'
      arrows.trailingAction.onClick()
      assert.equal(hero.inventory.equipment.length, 1)
      assert.deepEqual(hero.inventory.resources, { wood: 9, feather: 4, bronzeIngot: 1 })
    }
    reachable = true
    forge.isBuilt = true
    forge.isDestroyed = false
    hero.inventory.resources = { wood: 17, feather: 8, bronzeIngot: 3 }
    arrows.trailingAction.onClick({ shiftKey: true })
    assert.equal(hero.inventory.equipment.length, 11)
    assert.deepEqual(hero.inventory.resources, { wood: 12, feather: 8, bronzeIngot: 2 })
    hero.inventory.resources = { wood: 2, copper: 2, tin: 1 }
    const ingot = rows.find(row => row.id === 'craft-bronzeIngot')
    assert.ok(ingot)
    ingot.trailingAction.onClick()
    assert.deepEqual(hero.inventory.resources, { bronzeIngot: 1 })
    assert.equal(hero.inventory.equipment.length, 11)
  } finally {
    global.document = previousDocument
  }
})

test('forge remains exterior and uses its atlas sprite across levels and civilizations', () => {
  const { isBuildingInteriorSupported } = loadTsModule('app/lib/buildings/interiors.ts')
  const { getBuildingAsset } = loadTsModule('app/lib/graphics/assets.ts')
  const fs = require('node:fs')
  const path = require('node:path')
  const directory = path.join(__dirname, '../public/assets/data/civilizations')
  assert.equal(isBuildingInteriorSupported({ type: 'Forge', isBuilt: true }), false)
  for (const filename of fs.readdirSync(directory).filter(name => name.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'))
    for (const level of [0, 1, 2]) {
      assert.deepEqual(getBuildingAsset('Forge', { level }, { cache: { get: () => data } }).images.final, {
        sheet: 'buildings',
        frame: level === 2 ? 28 : 17,
      })
    }
  }
})

test('forge keeps repairs and personal crafting without village research', () => {
  const previousDocument = global.document
  const element = () => ({
    children: [],
    dataset: {},
    classList: { toggle() {}, add() {} },
    set textContent(value) {
      this.text = value
      this.children = []
    },
    get textContent() {
      return this.text ?? ''
    },
    appendChild(child) {
      this.children.push(child)
    },
    append(...children) {
      this.children.push(...children)
    },
    setAttribute() {},
    addEventListener(name, handler) {
      this[name] = handler
    },
    querySelector() {
      return null
    },
  })
  global.document = { createElement: element }
  const rows = []
  const { HeroForgeBody } = loadTsModule('app/ui/hero-building/HeroForgeBody.ts', {
    mocks: {
      '../../lib/ui/VariantRow': { attachVariantRow() {} },
      '../../lib/avatar': {},
      '../../lib/lang': { t: (key, args) => `${key}${args ? JSON.stringify(args) : ''}` },
      '../../lib/graphics/assets': { getIconPath: () => '' },
      '../../lib/hero/placeableInventoryItems': { getPlaceableInventoryBuildingType: () => null },
      '../../lib/hero/heroActionRange': { isHeroInteractionTargetReachable: () => true },
      '../../lib/resources/playerResourceTotals': {
        getPlayerResourceTotals: () => ({ wood: 500, copper: 500, iron: 500 }),
      },
      '../inventory/InventoryItemRows': {
        createInventoryEquipmentRow: () => ({ element: {} }),
        createInventoryResourceRow: () => ({ element: {} }),
      },
      '../inventory/InventoryCostMeta': { inventoryCostMetaParts: () => [] },
      '../inventory/InventoryItemIcons': { createInventoryEquipmentIcon: () => element() },
      '../inventory/InventoryActionRow': {
        createInventoryActionRow: options => {
          rows.push(options)
          return { element: element(), icon: element() }
        },
      },
    },
  })
  try {
    const menu = { context: { player: { forgeUpgrades: {} }, controls: { heroUnit: {} } }, showMessage() {} }
    const forge = { type: 'Forge', isBuilt: true }
    const body = new HeroForgeBody(menu, forge)
    const upgrades = () => rows.filter(row => row.id.startsWith('forge-upgrade-'))
    assert.equal(body.craftPanel.children.length, 2, 'craft catalogue and repair bag')
    assert.equal(body.craftPanel.children[0].children.length, 3, 'fixed title, iron requirement and scrolling body')
    assert.equal(
      body.craftPanel.children[0].children[2].children.length,
      5,
      'five recipe categories in the scrolling body'
    )
    for (const id of ['sword_bronze', 'armor_legion_bronze', 'helmet_pointed_bronze', 'round_shield_bronze_slash']) {
      assert.ok(rows.some(row => row.id === `craft-${id}`))
    }
    assert.ok(rows.some(row => row.id === 'craft-arrow_bronze'))
    assert.ok(!rows.some(row => row.id === 'craft-ironIngot' || row.id === 'craft-armor_mail_iron'))
    assert.equal(upgrades().length, 0)
  } finally {
    global.document = previousDocument
  }
})

test('campfire prepares consumables into the hero bag and rechecks proximity, construction and destruction on click', () => {
  const previousDocument = global.document
  global.document = {
    createElement: () => ({
      appendChild() {},
      append() {},
      textContent: '',
      dataset: {},
      classList: { toggle() {}, add() {} },
      setAttribute() {},
      addEventListener() {},
      querySelector() {
        return null
      },
    }),
  }
  let reachable = true
  const rows = []
  const { HeroCampfireBody } = loadTsModule('app/ui/hero-building/HeroCampfireBody.ts', {
    mocks: {
      '../../lib/ui/VariantRow': { attachVariantRow() {} },
      '../../lib/avatar': {},
      '../inventory/InventoryItemRows': {
        createInventoryEquipmentRow: () => ({ element: {} }),
        createInventoryResourceRow: () => ({ element: {} }),
      },
      '../inventory/InventoryCostMeta': { inventoryCostMetaParts: () => [] },
      '../../lib/graphics/assets': { getIconPath: () => '' },
      '../../lib/hero/heroActionRange': { isHeroInteractionTargetReachable: () => reachable },
      '../../lib/hero/placeableInventoryItems': { getPlaceableInventoryBuildingType: () => null },
      '../../lib/lang': { t: key => key },
      '../inventory/InventoryItemIcons': { createInventoryEquipmentIcon: () => ({}) },
      '../inventory/InventoryActionRow': {
        createInventoryActionRow: options => {
          rows.push(options)
          return { element: { querySelector: () => null }, icon: { appendChild() {} } }
        },
      },
      '../equipment/equipmentLoot': {
        getHeroInventory: hero => hero.inventory,
        addHeroInventoryItem: (hero, item) => hero.inventory.equipment.push(item),
        removeHeroInventoryItem: () => false,
      },
    },
  })
  try {
    const hero = { type: 'Hero', inventory: { resources: { toxicHerb: 4 }, equipment: [] } }
    const menu = { context: { player: { age: 0 }, controls: { heroUnit: hero } }, showMessage() {}, updateTopbar() {} }
    const forge = { type: 'FireCamp', isBuilt: true }
    new HeroCampfireBody(menu, forge)
    const arrows = rows.find(row => row.id === 'craft-poison_vial')
    assert.equal(arrows.disabled, false)
    assert.equal(arrows.trailingAction.label, 'campfirePrepare 1')
    assert.equal(rows.find(row => row.id === 'craft-grilled_meat').trailingAction.label, 'campfireCook 1')
    assert.equal(
      rows.some(row => row.id === 'craft-arrow_ceramic'),
      false
    )
    arrows.trailingAction.onClick()
    assert.equal(hero.inventory.equipment.length, 1)
    assert.deepEqual(hero.inventory.resources, { toxicHerb: 2 })
    for (const state of ['distant', 'unfinished', 'destroyed']) {
      reachable = state !== 'distant'
      forge.isBuilt = state !== 'unfinished'
      forge.isDestroyed = state === 'destroyed'
      arrows.trailingAction.onClick()
      assert.equal(hero.inventory.equipment.length, 1)
      assert.deepEqual(hero.inventory.resources, { toxicHerb: 2 })
    }
  } finally {
    global.document = previousDocument
  }
})
