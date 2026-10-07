const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function element() {
  return {
    children: [],
    dataset: {},
    classList: { add() {} },
    append(...children) {
      this.children.push(...children)
    },
    appendChild(child) {
      this.children.push(child)
      return child
    },
    replaceChildren() {
      this.children = []
    },
    setAttribute() {},
  }
}

test('animal loot count and hero bag load update after a partial pickup without exceeding capacity', () => {
  const previous = global.document
  global.document = { createElement: element }
  try {
    let panel
    const hero = { label: 'hero', controlMode: 'hero', inventory: { resources: { wood: 49 } } }
    const animal = { label: 'deer', type: 'Deer', isDead: true, inventory: { resources: { meat: 5, leather: 1 } } }
    const menu = { context: { controls: { heroUnit: hero } } }
    const { AnimalInventoryScreen } = loadTsModule('app/ui/inventory/AnimalInventoryScreen.ts', {
      mocks: {
        '../../lib/lang': { t: (key, params) => (params ? `${key}:${params.count ?? params.name}` : key) },
        '../utils/entityDisplayName': { getEntityDisplayName: animal => animal.type },
        '../inspection/EntityInfoContent': { createTitledEntityInfoContent: element },
        '../inspection/InspectionPanel': {},
        './InventoryTransferPanel': {
          InventoryTransferPanel: class {
            constructor(options) {
              panel = options
              this.element = element()
            }
          },
        },
      },
    })
    new AnimalInventoryScreen(menu, animal)
    assert.equal(panel.destination.label, 'animalLootCount:6')
    assert.equal(panel.canTransfer(panel.source), true)
    assert.equal(panel.moveResource(panel.destination, panel.source, 'meat', 5), 1)
    panel.onChange()
    assert.equal(panel.destination.label, 'animalLootCount:5')
    assert.match(panel.source.label, /50\/50/)
    assert.equal(animal.inventory.resources.meat, 4)
    assert.equal(panel.moveResource(panel.destination, panel.source, 'leather', 1), 0)
    assert.equal(animal.inventory.resources.leather, 1)
    assert.equal(panel.moveResource(panel.source, panel.destination, 'meat', 1), 1)
    panel.onChange()
    assert.equal(animal.quantity, 5)
    assert.equal(panel.destination.label, 'animalLootCount:6')
    assert.match(panel.source.label, /49\/50/)
    assert.equal(panel.moveResource(panel.destination, panel.source, 'meat', 1), 1)
    animal.isDestroyed = true
    assert.equal(panel.canTransfer(panel.source), false)
  } finally {
    global.document = previous
  }
})

test('item quantity badges only appear for stacks of two or more', () => {
  const previous = global.document
  global.document = { createElement: element }
  try {
    const { createInventoryActionRow } = loadTsModule('app/ui/inventory/InventoryActionRow.ts', {
      mocks: { '../ValueBadge': {}, '../entity/CombatStatInfo': { createCombatStatInfo: element } },
    })
    for (const quantity of [0, 1, 2, 12]) {
      const { element: row } = createInventoryActionRow({}, { id: 'loot', title: 'Leather', quantity })
      const badge = row.children.find(child => child.className === 'inventory-quantity-badge')
      if (quantity < 2) assert.equal(badge, undefined)
      else assert.equal(badge.textContent, `x${quantity}`)
    }
  } finally {
    global.document = previous
  }
})
