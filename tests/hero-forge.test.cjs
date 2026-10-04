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
      '../../lib/avatar': {},
      '../inventory/InventoryCostMeta': { inventoryCostMetaParts: () => [] },
      '../../lib/graphics/assets': { getIconPath: () => '' },
      '../../lib/hero/heroActionRange': { isHeroInteractionTargetReachable: () => reachable },
      '../../lib/hero/placeableInventoryItems': { getPlaceableInventoryBuildingType: () => null },
      '../../lib/lang': { t: key => key },
      '../inventory/InventoryItemIcons': { createInventoryEquipmentIcon: () => ({}) },
      '../inventory/InventoryActionRow': {
        createInventoryActionRow: (_, options) => {
          rows.push(options)
          return { element: { querySelector: () => null }, icon: { appendChild() {} } }
        },
      },
      '../equipment/equipmentLoot': {
        addHeroInventoryItem: (hero, item) => hero.inventory.equipment.push(item),
        removeHeroInventoryItem: () => false,
      },
    },
  })
  try {
    const hero = { type: 'Hero', inventory: { resources: { wood: 10, feather: 4, stone: 4 }, equipment: [] } }
    const menu = { context: { player: { age: 0 }, controls: { heroUnit: hero } }, showMessage() {}, updateTopbar() {} }
    const forge = { type: 'Forge', isBuilt: true }
    new HeroForgeBody(menu, forge)
    const arrows = rows.find(row => row.id === 'craft-arrow_ceramic')
    assert.equal(arrows.disabled, false)
    arrows.trailingAction.onClick()
    assert.equal(hero.inventory.equipment.length, 1)
    assert.deepEqual(hero.inventory.resources, { wood: 5, feather: 2, stone: 2 })
    for (const state of ['distant', 'unfinished', 'destroyed']) {
      reachable = state !== 'distant'
      forge.isBuilt = state !== 'unfinished'
      forge.isDestroyed = state === 'destroyed'
      arrows.trailingAction.onClick()
      assert.equal(hero.inventory.equipment.length, 1)
      assert.deepEqual(hero.inventory.resources, { wood: 5, feather: 2, stone: 2 })
    }
    reachable = true
    forge.isBuilt = true
    forge.isDestroyed = false
    hero.inventory.resources = { wood: 17, feather: 8, stone: 6 }
    arrows.trailingAction.onClick({ shiftKey: true })
    assert.equal(hero.inventory.equipment.length, 4)
    assert.deepEqual(hero.inventory.resources, { wood: 2, feather: 2 })
  } finally {
    global.document = previousDocument
  }
})

test('forge remains exterior and uses its atlas sprite across ages and civilizations', () => {
  const { isBuildingInteriorSupported } = loadTsModule('app/lib/buildings/interiors.ts')
  const { getBuildingAsset } = loadTsModule('app/lib/graphics/assets.ts')
  const fs = require('node:fs')
  const path = require('node:path')
  const directory = path.join(__dirname, '../public/assets/data/civilizations')
  assert.equal(isBuildingInteriorSupported({ type: 'Forge', isBuilt: true }), false)
  for (const filename of fs.readdirSync(directory).filter(name => name.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'))
    for (const age of [0, 1, 2]) {
      assert.deepEqual(getBuildingAsset('Forge', { age }, { cache: { get: () => data } }).images.final, {
        sheet: 'buildings/age-0',
        frame: 10,
      })
    }
  }
})

test('forge stacks crafting and six next-tier village upgrades in sections', () => {
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
      '../../lib/avatar': {},
      '../../lib/lang': { t: (key, args) => `${key}${args ? JSON.stringify(args) : ''}` },
      '../../lib/graphics/assets': { getIconPath: () => '' },
      '../../lib/hero/placeableInventoryItems': { getPlaceableInventoryBuildingType: () => null },
      '../../lib/hero/heroActionRange': { isHeroInteractionTargetReachable: () => true },
      '../../lib/resources/playerResourceTotals': {
        getPlayerResourceTotals: () => ({ wood: 500, copper: 500, iron: 500 }),
      },
      '../inventory/InventoryCostMeta': { inventoryCostMetaParts: () => [] },
      '../inventory/InventoryItemIcons': { createInventoryEquipmentIcon: () => element() },
      '../inventory/InventoryActionRow': {
        createInventoryActionRow: (_, options) => {
          rows.push(options)
          return { element: element(), icon: element() }
        },
      },
      '../../lib/equipment/forgeResearch': {
        canManageForge: () => true,
        canResearchForgeUpgrade: (player, _forge, family) => (player.forgeUpgrades[family] ?? 0) < 3,
        researchForgeUpgrade: (player, _forge, family, tier) => {
          player.forgeUpgrades[family] = tier
          return true
        },
      },
    },
  })
  try {
    const menu = { context: { player: { forgeUpgrades: {} }, controls: { heroUnit: {} } }, showMessage() {} }
    const forge = { type: 'Forge', isBuilt: true }
    const body = new HeroForgeBody(menu, forge)
    const upgrades = () => rows.filter(row => row.id.startsWith('forge-upgrade-'))
    assert.equal(body.craftPanel.children.length, 4, 'two crafting and two upgrade sections')
    assert.ok(rows.some(row => row.id === 'craft-arrow_ceramic'))
    assert.equal(upgrades().length, 6)
    const [title] = body.craftPanel.children[2].children
    assert.equal(title.text, 'forgeCategoryTools')
    assert.equal(body.craftPanel.children[2].children.length, 2, 'only category title and upgrade list')
    let axes = rows.find(row => row.id === 'forge-upgrade-axes')
    assert.match(axes.title, /forgeMaterial_copper/)
    axes.trailingAction.onClick()
    axes = rows.findLast(row => row.id === 'forge-upgrade-axes')
    assert.match(axes.title, /forgeMaterial_bronze/)
    axes.trailingAction.onClick()
    axes = rows.findLast(row => row.id === 'forge-upgrade-axes')
    assert.match(axes.title, /forgeMaterial_iron/)
    axes.trailingAction.onClick()
    axes = rows.findLast(row => row.id === 'forge-upgrade-axes')
    assert.equal(axes.disabled, true)
    assert.equal(axes.badge, 'forgeMaximum')
    assert.equal(rows.findLast(row => row.id === 'forge-upgrade-weapons').disabled, false)
    rows.length = 0
    new HeroForgeBody(menu, forge)
    assert.equal(upgrades().length, 6, 'a fresh body lists upgrades without switching panels')
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
      '../../lib/avatar': {},
      '../inventory/InventoryCostMeta': { inventoryCostMetaParts: () => [] },
      '../../lib/graphics/assets': { getIconPath: () => '' },
      '../../lib/hero/heroActionRange': { isHeroInteractionTargetReachable: () => reachable },
      '../../lib/hero/placeableInventoryItems': { getPlaceableInventoryBuildingType: () => null },
      '../../lib/lang': { t: key => key },
      '../inventory/InventoryItemIcons': { createInventoryEquipmentIcon: () => ({}) },
      '../inventory/InventoryActionRow': {
        createInventoryActionRow: (_, options) => {
          rows.push(options)
          return { element: { querySelector: () => null }, icon: { appendChild() {} } }
        },
      },
      '../equipment/equipmentLoot': {
        addHeroInventoryItem: (hero, item) => hero.inventory.equipment.push(item),
        removeHeroInventoryItem: () => false,
      },
    },
  })
  try {
    const hero = { type: 'Hero', inventory: { resources: { herb: 4, fiber: 2 }, equipment: [] } }
    const menu = { context: { player: { age: 0 }, controls: { heroUnit: hero } }, showMessage() {}, updateTopbar() {} }
    const forge = { type: 'FireCamp', isBuilt: true }
    new HeroCampfireBody(menu, forge)
    const arrows = rows.find(row => row.id === 'craft-healing_poultice')
    assert.equal(arrows.disabled, false)
    assert.equal(arrows.trailingAction.label, 'campfirePrepare')
    assert.equal(rows.find(row => row.id === 'craft-grilled_meat').trailingAction.label, 'campfireCook')
    assert.equal(
      rows.some(row => row.id === 'craft-arrow_ceramic'),
      false
    )
    arrows.trailingAction.onClick()
    assert.equal(hero.inventory.equipment.length, 1)
    assert.deepEqual(hero.inventory.resources, { herb: 2, fiber: 1 })
    for (const state of ['distant', 'unfinished', 'destroyed']) {
      reachable = state !== 'distant'
      forge.isBuilt = state !== 'unfinished'
      forge.isDestroyed = state === 'destroyed'
      arrows.trailingAction.onClick()
      assert.equal(hero.inventory.equipment.length, 1)
      assert.deepEqual(hero.inventory.resources, { herb: 2, fiber: 1 })
    }
  } finally {
    global.document = previousDocument
  }
})
