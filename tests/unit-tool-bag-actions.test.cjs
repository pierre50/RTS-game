const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('tool bag tiles equip and unequip the same item without a separate empty panel', () => {
  let changed = 0
  const unit = { label: 'companion', inventory: { activeWeapons: {}, equipment: ['axe_ceramic'] } }
  const { unitToolBagActions } = loadTsModule('app/ui/inventory/UnitToolEquipment.ts', {
    mocks: {
      '../../lib/units/village/villageWorkEvents': { notifyVillageWorkChanged() {} },
      '../../lib/equipment/equipmentLoot': {
        equipHeroInventoryItem: (actor, item) => {
          const index = actor.inventory.equipment.indexOf(item)
          if (index < 0) return false
          actor.inventory.equipment.splice(index, 1)
          actor.inventory.activeWeapons.tool = item
          return true
        },
        unequipHeroActiveWeaponSlot: actor => {
          actor.inventory.equipment.push(actor.inventory.activeWeapons.tool)
          delete actor.inventory.activeWeapons.tool
          return true
        },
      },
      '../../lib/equipment/workTools': { workToolFamily: item => (item?.startsWith('axe_') ? 'axe' : undefined) },
      '../../lib/equipment/equipmentStats': { refreshUnitEquipmentStats() {} },
      '../../lib/units/visuals/unitSpriteAssets': { applyUnitActivitySpritesheets() {} },
      '../../lib/lang': { t: key => key },
      './InventoryItemRows': { createInventoryEquipmentRow: (_context, options) => ({ element: options }) },
    },
  })
  const actions = unitToolBagActions({ context: {} }, unit, () => changed++)
  assert.deepEqual(actions.equippedItems(), [])
  assert.equal(actions.equipmentAction('bow'), undefined)
  actions.equipmentAction('axe_ceramic').onClick()
  const tiles = actions.equippedItems()
  assert.equal(tiles.length, 1)
  assert.equal(tiles[0].equipment, 'axe_ceramic')
  assert.equal(tiles[0].badge, 'inventoryEquippedEquipment')
  assert.deepEqual(unit.inventory.equipment, [])
  tiles[0].trailingAction.onClick()
  assert.deepEqual(actions.equippedItems(), [])
  assert.deepEqual(unit.inventory.equipment, ['axe_ceramic'])
  assert.equal(changed, 2)
})
