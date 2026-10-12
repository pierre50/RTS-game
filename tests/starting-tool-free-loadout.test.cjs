const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { startingHeroInventory, startingCompanionInventory, startingVillagerInventory } = loadTsModule(
  'app/lib/economy/startingProvisions.ts'
)
const { initializeNpcWeapons } = loadTsModule('app/lib/units/combat/npcWeapons.ts')
const { initializeNpcArrows } = loadTsModule('app/lib/units/combat/unitArrows.ts')
const { initializeWorkTools } = loadTsModule('app/lib/equipment/workToolMigration.ts')
for (const [type, factory] of [
  ['Hero', startingHeroInventory],
  ['Villager', startingCompanionInventory],
]) {
  test(`${type} opening loadout stays tool-free after initialization`, () => {
    const inventory = factory()
    const before = JSON.stringify(inventory)
    initializeWorkTools({ type, inventory })
    initializeNpcWeapons({ type, inventory }, ['bow'])
    initializeNpcArrows({ type, inventory })
    assert.equal(JSON.stringify(inventory), before)
    assert.equal(inventory.activeWeapons?.tool, undefined)
    assert.ok(!inventory.equipment.some(item => /^(axe|pickaxe|hammer|scythe)_/.test(item)))
    assert.equal(inventory.toolsInitialized, true)
    assert.equal(inventory.activeWeapons?.ranged, undefined)
    assert.equal(inventory.equipped?.arrow, undefined)
    assert.equal(inventory.equippedCounts?.arrow ?? 0, 0)
    assert.ok(!inventory.equipment.some(item => item.startsWith('bow') || item.startsWith('arrow_')))
  })
}
test('ordinary villagers retain their starting tools', () => {
  assert.ok(startingVillagerInventory().activeWeapons.tool)
})
