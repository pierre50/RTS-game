const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('inventory crafts without a building, supports bounded batches and refuses a dead hero', () => {
  const previousDocument = global.document
  global.document = {
    createElement: () => ({
      replaceChildren() {},
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
  const reachable = false
  const rows = []
  const actions = []
  const { HeroInventoryCraftingBody } = loadTsModule('app/ui/inventory/HeroInventoryCraftingBody.ts', {
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
          const action = { dataset: {} }
          actions.push(action)
          return { element: { querySelector: () => action }, icon: { appendChild() {} } }
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
    const hero = { type: 'Hero', inventory: { resources: { wood: 10, feather: 4, stone: 4 }, equipment: [] } }
    const menu = { context: { player: { age: 0 }, controls: { heroUnit: hero } }, showMessage() {}, updateTopbar() {} }
    new HeroInventoryCraftingBody(menu, undefined).renderCraft()
    assert.ok(!rows.some(row => ['craft-arrow_bronze', 'craft-grilled_meat', 'craft-poison_vial'].includes(row.id)))
    const arrows = rows.find(row => row.id === 'craft-arrow_ceramic')
    assert.equal(arrows.disabled, false)
    assert.equal(arrows.quantity, 1)
    assert.equal(arrows.trailingAction.label, 'craftAction 1')
    assert.equal(actions[rows.indexOf(arrows)].dataset.craftBatchLabel, 'craftAction 10')
    arrows.trailingAction.onClick()
    assert.equal(hero.inventory.equipment.length, 1)
    assert.deepEqual(hero.inventory.resources, { wood: 9, feather: 4, stone: 3 })
    assert.deepEqual(hero.inventory.craftingRemainders, { wood: 5, stone: 8 })
    hero.isDead = true
    arrows.trailingAction.onClick()
    assert.equal(hero.inventory.equipment.length, 1)
    hero.isDead = false
    hero.inventory.resources = { wood: 17, feather: 8, stone: 6 }
    arrows.trailingAction.onClick({ shiftKey: true })
    assert.equal(hero.inventory.equipment.length, 11)
    assert.deepEqual(hero.inventory.resources, { wood: 12, feather: 8, stone: 4 })
    hero.inventory.resources = { wood: 3, stone: 2 }
    delete hero.inventory.craftingRemainders
    rows.length = 0
    actions.length = 0
    new HeroInventoryCraftingBody(menu, undefined).renderCraft()
    const partial = rows.find(row => row.id === 'craft-arrow_ceramic')
    assert.equal(actions[rows.indexOf(partial)].dataset.craftBatchLabel, 'craftAction 6')
    partial.trailingAction.onClick({ shiftKey: true })
    assert.equal(hero.inventory.equipment.length, 17)
    assert.deepEqual(hero.inventory.resources, {})
    const afterSix = JSON.stringify(hero.inventory)
    arrows.trailingAction.onClick({ shiftKey: true })
    assert.equal(JSON.stringify(hero.inventory), afterSix)
  } finally {
    global.document = previousDocument
  }
})
