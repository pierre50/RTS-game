const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function element() {
  return {
    children: [],
    listeners: {},
    classList: { contains: name => name === 'selection-info' },
    get childElementCount() {
      return this.children.length
    },
    append(...children) {
      this.children.push(...children)
    },
    appendChild(child) {
      this.children.push(child)
      return child
    },
    replaceChildren(...children) {
      this.children = children
    },
    setAttribute() {},
    addEventListener(name, handler) {
      this.listeners[name] = handler
    },
  }
}

for (const dead of [false, true]) {
  test(`${dead ? 'corpse loot' : 'living NPC bag'} uses the shared screen and transfers without duplicating items`, () => {
    const previousDocument = global.document
    global.document = { createElement: element }
    try {
      const rows = []
      let modalOptions
      let corpseEquipmentPickups = 0
      const hero = { label: 'hero', inventory: { equipment: [], resources: {} } }
      const unit = {
        label: 'npc',
        name: 'Ada',
        isDead: dead,
        inventory: { equipment: ['axe'], resources: { wood: 120 } },
        lootEquipment: ['axe'],
      }
      const menu = { context: { app: {}, controls: { heroUnit: hero } }, updateHeroStatus() {} }
      menu.context.menu = menu
      const { UnitInventoryScreen } = loadTsModule('app/ui/inventory/UnitInventoryScreen.ts', {
        mocks: {
          '../../constants': { RESOURCE_STORAGE_NAMES: ['wood'] },
          '../../lib/lang': { t: (key, params) => params?.count != null ? `${params.count} ${key === 'inventoryItemCountOne' ? 'item' : 'items'}` : key },
          '../utils/entityDisplayName': { getEntityDisplayName: target => target.name },
          '../EntityInfoContent': { createTitledEntityInfoContent: () => element() },
          '../InspectionPanel': {
            createInspectionModal: options => {
              modalOptions = options
              return options
            },
          },
          '../../lib/equipment/equipmentLoot': {
            getUnitCorpseLootEquipment: target => target.lootEquipment,
            getUnitCorpseLootResources: target => target.inventory.resources,
            getEquipmentStacks: items =>
              [...new Set(items)].map(equipment => ({ equipment, count: items.filter(x => x === equipment).length })),
            formatEquipmentStackLabel: (item, count) => `${item} x${count}`,
            pickupCorpseEquipment: (target, receiver, item) => {
              const index = target.lootEquipment.indexOf(item)
              if (index < 0) return false
              target.lootEquipment.splice(index, 1)
              receiver.inventory.equipment.push(item)
              corpseEquipmentPickups++
              return true
            },
            pickupCorpseResource: (target, receiver, resource, requested) => {
              const amount = Math.min(target.inventory.resources[resource] ?? 0, requested ?? Infinity)
              target.inventory.resources[resource] -= amount
              receiver.inventory.resources[resource] = (receiver.inventory.resources[resource] ?? 0) + amount
              return amount
            },
          },
          './InventoryItemRows': {
            createInventoryEquipmentRow: (_context, _menu, options) => {
              rows.push(options)
              return { element: element() }
            },
            createInventoryResourceRow: (_menu, options) => {
              rows.push(options)
              return { element: element() }
            },
          },
        },
      })
      const screen = new UnitInventoryScreen(menu, unit)
      screen.open(() => {})
      assert.equal(modalOptions.title, 'Ada')
      assert.equal(modalOptions.content, screen.element)
      const panel = screen.element.children[0].children[0]
      assert.equal(panel.className, 'inventory-transfer-panel')
      assert.equal(panel.children.length, 2)
      assert.equal(panel.children[0].children[0].children[1].textContent, '3 items')
      assert.equal(panel.children[1].children[0].children[1].textContent, '0 items')
      const wood = rows.find(row => row.id === 'transfer-resource-npc-wood')
      const axe = rows.find(row => row.id === 'transfer-equipment-npc-axe')
      const remainder = rows.find(row => row.resource === 'wood' && row.amount === 21)
      assert.equal(wood.amount, 99)
      remainder.trailingAction.onAction('all')
      wood.trailingAction.onAction('one')
      axe.trailingAction.onAction('all')
      axe.trailingAction.onAction('all')
      assert.deepEqual(hero.inventory, { equipment: ['axe'], resources: { wood: 22 } })
      assert.equal(unit.inventory.resources.wood, 98)
      assert.equal(corpseEquipmentPickups, dead ? 1 : 0)
      screen.render()
      const updatedPanel = screen.element.children[0].children[0]
      assert.equal(updatedPanel.children[0].children[0].children[1].textContent, '1 item')
      const heroAxe = rows.findLast(row => row.id === 'transfer-equipment-hero-axe')
      assert.equal(Boolean(heroAxe.trailingAction), !dead)
      if (!dead) {
        heroAxe.trailingAction.onAction('one')
        assert.deepEqual(hero.inventory.equipment, [])
        assert.deepEqual(unit.inventory.equipment, ['axe'])
      }
    } finally {
      global.document = previousDocument
    }
  })
}
