const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { createInventoryContents } = loadTsModule('app/ui/inventory/InventoryContents.ts', {
  mocks: {
    '../../constants': { RESOURCE_STORAGE_NAMES: ['wood'] },
    '../../lib/equipment/equipmentLoot': {
      getEquipmentStacks: equipment => equipment.length ? [{ equipment: 'arrow', count: equipment.length }] : [],
    },
    './InventorySection': {
      createInventorySection: options => {
        const rows = []
        options.renderItems({ appendChild: row => rows.push(row) })
        return rows
      },
    },
  },
})

for (const [quantity, expected] of [[0, []], [99, [99]], [100, [99, 1]], [198, [99, 99]], [200, [99, 99, 2]]]) {
  test(`resources and equipment split ${quantity} into stacks of at most 99 without loss`, () => {
    const inventory = { resources: { wood: quantity }, equipment: Array(quantity).fill('arrow') }
    const rows = createInventoryContents({
      inventory, title: 'Bag', emptyText: 'Empty',
      renderResource: (item, count) => ({ id: `resource-${item}`, kind: 'resource', count }),
      renderEquipment: (item, count) => ({ id: `equipment-${item}`, kind: 'equipment', count }),
    })
    for (const kind of ['resource', 'equipment']) {
      const stacks = rows.filter(row => row.kind === kind)
      assert.deepEqual(stacks.map(row => row.count), expected)
      assert.equal(stacks.reduce((sum, row) => sum + row.count, 0), quantity)
    }
    assert.equal(new Set(rows.map(row => row.id)).size, rows.length)
    assert.equal(inventory.resources.wood, quantity)
    assert.equal(inventory.equipment.length, quantity)
  })
}
