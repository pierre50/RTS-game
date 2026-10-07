const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const condition = loadTsModule('app/lib/equipment/equipmentCondition.ts')
const { withEquipmentDurability: worn, getEquipmentDurability: remaining } = condition

test('old items start pristine, condition is bounded and consumables never gain durability', () => {
  assert.equal(remaining('sword_iron'), 100)
  assert.equal(remaining(worn('bow', 24)), 24)
  assert.equal(remaining(worn('armor_leather', -5)), 0)
  assert.equal(worn('bow', 100), 'bow')
  assert.equal(worn('arrow_iron', 20), 'arrow_iron')
  assert.equal(remaining('arrow_iron'), null)
  assert.equal(condition.equipmentBaseKey(worn('longsword', 50)), 'longsword')
})

test('copies retain their own condition through equipping, swapping, stacking and JSON saves', () => {
  const { equipHeroInventoryItemData } = loadTsModule('app/lib/equipment/heroEquipmentData.ts')
  const { getEquipmentStacks } = loadTsModule('app/lib/equipment/equipmentLoot.ts', { mocks: { '../lpc': {} } })
  const hero = { inventory: { equipment: [worn('sword_iron', 25), worn('sword_iron', 80), 'sword_iron'] } }
  assert.equal(equipHeroInventoryItemData(hero, worn('sword_iron', 25)), true)
  assert.equal(equipHeroInventoryItemData(hero, worn('sword_iron', 80)), true)
  const restored = JSON.parse(JSON.stringify(hero))
  assert.equal(restored.inventory.activeWeapons.melee, worn('sword_iron', 80))
  assert.deepEqual(
    getEquipmentStacks(restored.inventory.equipment)
      .map(row => remaining(row.equipment))
      .sort(),
    [100, 25]
  )
  restored.inventory.equipment.push(worn('armor_leather', 45), worn('armor_leather', 45))
  equipHeroInventoryItemData(restored, worn('armor_leather', 45), 2)
  assert.equal(restored.inventory.equippedCounts.armor, 1, 'only one torso armor can be worn')
  assert.ok(restored.inventory.equipment.includes(worn('armor_leather', 45)))
})

test('weapon and armor wear reaches zero without deleting items and notifies only on break', () => {
  let refreshed = 0
  const messages = []
  const { wearEquippedWeapon, wearEquippedArmor } = loadTsModule('app/lib/equipment/equipmentWear.ts', {
    mocks: {
      './equipmentStats': {
        refreshUnitEquipmentStats: () => refreshed++,
        getConfiguredEntityEquipment: unit => unit.equipment,
      },
      '../lang': { t: key => key },
    },
  })
  const hero = {
    type: 'Hero',
    inventory: {
      activeWeapons: { melee: worn('sword_iron', 1), ranged: 'bow' },
      equipped: { armor: worn('armor_leather', 1) },
    },
    context: { controls: {}, menu: { showMessage: message => messages.push(message) } },
  }
  hero.context.controls.heroUnit = hero
  wearEquippedWeapon(hero, 'melee')
  wearEquippedWeapon(hero, 'melee')
  wearEquippedWeapon(hero, 'ranged')
  wearEquippedArmor(hero)
  assert.equal(remaining(hero.inventory.activeWeapons.melee), 0)
  assert.equal(remaining(hero.inventory.activeWeapons.ranged), 99)
  assert.equal(remaining(hero.inventory.equipped.armor), 0)
  assert.equal(refreshed, 2)
  assert.equal(messages.length, 2)
  const npc = { equipment: [worn('sword_iron', 1)] }
  wearEquippedWeapon(npc, 'melee')
  assert.equal(npc.equipmentDurability.sword_iron, 0)
})

test('repair is atomic, requires a usable nearby forge, and preserves the other copy', () => {
  let nearby = true
  const { getEquipmentRepairTargets, getEquipmentRepairCost, repairEquipment } = loadTsModule(
    'app/lib/equipment/equipmentRepair.ts',
    {
      mocks: {
        '../hero/heroActionRange': { isHeroInteractionTargetReachable: () => nearby },
        './equipmentStats': { refreshUnitEquipmentStats() {} },
        '../resources/playerResourceTotals': {
          getMissingPlayerResources: (_player, cost, { hero }) =>
            Object.fromEntries(
              Object.entries(cost).filter(([key, amount]) => (hero.inventory.resources[key] ?? 0) < amount)
            ),
          withdrawChestResources: (_player, cost, { hero }) => {
            for (const [key, amount] of Object.entries(cost)) hero.inventory.resources[key] -= amount
            return true
          },
        },
      },
    }
  )
  const hero = {
    inventory: { resources: { wood: 4, ironIngot: 4 }, equipment: [worn('sword_iron', 0), worn('sword_iron', 75)] },
  }
  const forge = { type: 'Forge', isBuilt: true }
  const target = getEquipmentRepairTargets(hero)[0]
  assert.deepEqual(getEquipmentRepairCost(target.item), { ironIngot: 2, wood: 2 })
  nearby = false
  assert.equal(repairEquipment({}, hero, forge, target), false)
  nearby = true
  forge.isDestroyed = true
  assert.equal(repairEquipment({}, hero, forge, target), false)
  forge.isDestroyed = false
  hero.inventory.resources.ironIngot = 0
  assert.equal(repairEquipment({}, hero, forge, target), false)
  assert.equal(hero.inventory.resources.wood, 4)
  hero.inventory.resources.ironIngot = 4
  assert.equal(repairEquipment({}, hero, forge, target), true)
  assert.deepEqual(hero.inventory.equipment, ['sword_iron', worn('sword_iron', 75)])
  assert.deepEqual(hero.inventory.resources, { wood: 2, ironIngot: 2 })
  assert.equal(repairEquipment({}, hero, forge, target), false, 'stale repair cannot charge twice')
})

test('condition and breakage are readable in inventory details without leaking the serialized suffix', () => {
  const { createEquipmentRowInfo } = loadTsModule('app/ui/inventory/InventoryDetails.ts', {
    mocks: {
      '../../lib/lang': { t: (key, values) => (values ? `${key}:${values.value}` : key) },
      '../../lib/equipment/equipmentMarket': { getEquipmentGoldValue: () => 0 },
      '../../lib/equipment/equipmentStats': {
        getEquipmentCombatStats: () => ({ weaponPower: 0, armor: 0 }),
      },
      '../../lib/equipment/equipmentLoot': loadTsModule('app/lib/equipment/equipmentSlots.ts'),
    },
  })
  const info = createEquipmentRowInfo(worn('sword_iron', 0))
  assert.equal(info.title, 'Sword Iron')
  assert.equal(info.durability, 0)
  assert.doesNotMatch(info.meta, /equipmentCondition/)
  assert.equal(createEquipmentRowInfo('sword_iron').durability, 100)
  assert.equal(createEquipmentRowInfo(worn('sword_iron', 37)).durability, 37)
  assert.equal(createEquipmentRowInfo('arrow').durability, null)
  assert.match(info.meta, /equipmentBrokenDescription/)
  assert.ok(!info.title.includes('~'))
})

test('unit serialization preserves NPC wear and separate hero item conditions', () => {
  const { unitData } = loadTsModule('app/serialization/entity/EntitySaveData.ts', {
    mocks: {
      '../../lib': {
        filterObject: (object, keys) =>
          Object.fromEntries(keys.filter(key => object[key] !== undefined).map(key => [key, object[key]])),
        getEntityMapSpace: () => null,
      },
    },
  })
  const unit = {
    label: 'hero',
    type: 'Hero',
    i: 0,
    j: 0,
    inventory: { equipment: [worn('bow', 42)], activeWeapons: { melee: worn('sword_iron', 0) } },
    equipmentDurability: { armor_leather: 30 },
  }
  const saved = JSON.parse(JSON.stringify(unitData(unit)))
  assert.deepEqual(saved.inventory, unit.inventory)
  assert.deepEqual(saved.equipmentDurability, unit.equipmentDurability)
})
