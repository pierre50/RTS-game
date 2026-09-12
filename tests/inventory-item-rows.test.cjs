const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('inventory items share a separate stack value while retaining combat details', () => {
  const rows = []
  const { createInventoryEquipmentRow, createInventoryResourceRow } = loadTsModule(
    'app/ui/inventory/InventoryItemRows.ts',
    {
      mocks: {
        './InventoryActionRow': {
          appendInventoryEmptyIcon() {},
          createInventoryActionRow: (_menu, options) => {
            rows.push(options)
            return { element: {}, icon: { appendChild() {} } }
          },
        },
        './InventoryItemIcons': { createInventoryResourceIcon: () => ({}) },
        '../../lib/equipment/equipmentLoot': {
          formatEquipmentLootLabel: item => item,
          formatEquipmentStackLabel: item => item,
          getEquipmentSlot: () => null,
          getWeaponSlot: () => 'melee',
        },
        '../../lib/equipment/equipmentMarket': {
          getEquipmentGoldValue: () => 185,
          getResourceGoldValue: () => 1,
        },
        '../../lib/equipment/equipmentStats': {
          getEquipmentCombatStats: () => ({ weaponPower: 6, meleeArmor: 0, pierceArmor: 0 }),
        },
        '../../lib/lang': {
          t: (key, params) => (key === 'goldShort' ? 'or' : `${key}${params ? JSON.stringify(params) : ''}`),
        },
      },
    }
  )
  createInventoryEquipmentRow(undefined, {}, { id: 'bag', equipment: 'sword', count: 2 })
  createInventoryEquipmentRow(undefined, {}, { id: 'equipped', equipment: 'sword' })
  createInventoryResourceRow({}, { id: 'loot', resource: 'gold', amount: 3 })
  assert.deepEqual(
    rows.map(row => row.value),
    ['370 or', '185 or', '3 or']
  )
  assert.match(rows[0].meta, /detailsDamage/)
  assert.ok(rows.every(row => !row.meta.includes('detailsValue')))
  createInventoryEquipmentRow(undefined, {}, { id: 'market', equipment: 'sword', showValue: false })
  assert.equal(rows.at(-1).value, undefined)
})
