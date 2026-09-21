const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function makeElement() {
  return {
    children: [],
    classList: { toggle() {} },
    appendChild(child) {
      this.children.push(child)
      return child
    },
    replaceChildren(...children) {
      this.children = children
    },
  }
}

test('hero bag actions equip weapons and delete one item or the displayed stack', () => {
  const calls = []
  let equipAction = null
  let deleteEquipmentAction = null
  let deleteResourceAction = null
  const hero = {
    inventory: {
      equipment: ['sword_bronze', 'sword_bronze', 'sword_bronze'],
      resources: { wood: 120 },
      equipped: {},
      equippedCounts: {},
      activeWeapons: { melee: 'sword_ceramic' },
    },
  }
  const menu = {
    context: {
      app: {},
      controls: {
        heroUnit: hero,
        setEquippedItem: tool => calls.push(['setEquippedItem', tool]),
        setEquippedTool: tool => calls.push(['setEquippedTool', tool]),
      },
      player: { age: 1 },
      performance: {},
    },
    updateHeroStatus: updatedHero => calls.push(['updateHeroStatus', updatedHero]),
  }
  const host = {
    close: () => calls.push(['close']),
    equippedPanel: makeElement(),
    lootedEquipmentPanel: makeElement(),
    menu,
    renderTools: () => calls.push(['renderTools']),
  }
  const previousDocument = global.document
  global.document = { createElement: () => makeElement() }

  try {
    const { renderInventoryLootedEquipment } = loadTsModule('app/ui/inventory/InventoryEquipmentRenderer.ts', {
      mocks: {
        '../../constants': {
          BUILDING_TYPES: { farm: 'farm' },
          RESOURCE_STORAGE_NAMES: ['wood'],
        },
        '../../lib': { getBuildingAsset: () => ({}) },
        '../../lib/buildings/buildingAge': { getPlayerBuildingConfig: () => null },
        '../../lib/equipment/equipmentLoot': {
          equipHeroInventoryItem: (equippedHero, item) => {
            calls.push(['equipHeroInventoryItem', equippedHero, item])
            equippedHero.inventory.activeWeapons.melee = item
            return true
          },
          getEquipmentSlot: () => null,
          getEquipmentStacks: bag => bag.length ? [{ equipment: 'sword_bronze', count: bag.length }] : [],
          getHeroEquipmentSlotLabelKey: slot => slot,
          getHeroEquippedItemCount: () => 0,
          getWeaponSlot: () => 'melee',
          HERO_EQUIPMENT_SLOTS: [],
          unequipHeroInventorySlot: () => false,
        },
        '../../lib/hero/heroCrafting': {
          getHeroConsumableHealing: () => 0,
          useHeroConsumableItem: () => false,
        },
        '../../lib/hero/placeableInventoryItems': { getPlaceableInventoryBuildingType: () => null },
        '../../lib/lang': { t: key => key },
        './InventoryItemIcons': {
          createInventoryBuildingIcon: () => makeElement(),
          createInventoryResourceIcon: () => makeElement(),
        },
        './InventoryItemRows': {
          createInventoryEquipmentRow: (context, rowMenu, options) => {
            equipAction = options.trailingAction
            deleteEquipmentAction = options.secondaryAction
            return { element: makeElement(), icon: makeElement() }
          },
          createInventoryResourceRow: (_menu, options) => {
            if (options.amount === 99) deleteResourceAction = options.secondaryAction
            return { element: makeElement(), icon: makeElement() }
          },
        },
        './InventorySection': {
          createInventorySection: options => {
            const grid = makeElement()
            options.renderItems(grid)
            return grid
          },
        },
        'pixi.js': { Assets: {} },
      },
    })

    renderInventoryLootedEquipment(host)
    assert.ok(equipAction)

    equipAction.onAction('one')

    assert.equal(hero.inventory.activeWeapons.melee, 'sword_bronze')
    assert.deepEqual(calls, [
      ['equipHeroInventoryItem', hero, 'sword_bronze'],
      ['updateHeroStatus', hero],
      ['setEquippedItem', 'sword'],
      ['setEquippedTool', 'sword'],
      ['renderTools'],
    ])

    assert.equal(deleteEquipmentAction.icon, 'trash')
    deleteEquipmentAction.onAction('one')
    assert.equal(hero.inventory.equipment.length, 2)
    renderInventoryLootedEquipment(host)
    deleteEquipmentAction.onAction('all')
    assert.deepEqual(hero.inventory.equipment, [])
    assert.equal(hero.inventory.activeWeapons.melee, 'sword_bronze')

    deleteResourceAction.onAction('one')
    assert.equal(hero.inventory.resources.wood, 119)
    deleteResourceAction.onAction('all')
    assert.equal(hero.inventory.resources.wood, 20)
    deleteResourceAction.onAction('all')
    assert.equal(hero.inventory.resources.wood, undefined)
    assert.equal(calls.filter(([name]) => name === 'renderTools').length, 6)
    assert.equal(calls.some(([name]) => name === 'close'), false)
  } finally {
    if (previousDocument) global.document = previousDocument
    else delete global.document
  }
})
