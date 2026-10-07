const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadHeroToolEquipment() {
  return loadTsModule('app/lib/hero/heroToolEquipment.ts', {
    mocks: {
      '../constants': {
        SHEET_TYPES: { standing: 'standingSheet', walking: 'walkingSheet' },
        WORK_TYPES: { attacker: 'attacker', hunter: 'hunter' },
      },
      '../lpc/baked': {
        refreshBakedLpcUnitAssets: () => {},
      },
      '../equipment/equipmentStats': {
        getUnitWorkEquipment: work => (work === 'attacker' ? ['axe_iron'] : []),
        refreshUnitEquipmentStats: () => {},
      },
      '../units/visuals/unitWorkAppearance': {
        applyUnitActionFrameSequence: () => {},
      },
    },
  })
}

test('hero interact is bare hands even when attacker work has fallback equipment', () => {
  const { getHeroPowerChargeToolForEquippedItem, getHeroToolEquipment } = loadHeroToolEquipment()
  const hero = {
    owner: { age: 3 },
    inventory: {
      activeWeapons: { melee: 'axe_iron' },
      equipped: { offhand: 'round_shield_iron_slash' },
    },
  }

  assert.deepEqual(getHeroToolEquipment(hero, 'interact'), [])
  assert.deepEqual(getHeroToolEquipment(hero, 'sword'), ['axe_iron', 'round_shield_iron_slash'])

  hero.inventory.activeWeapons.melee = 'catchingPole'
  assert.deepEqual(getHeroToolEquipment(hero, 'sword'), ['catchingPole', 'round_shield_iron_slash'])
  assert.equal(getHeroPowerChargeToolForEquippedItem(hero, 'sword'), 'catchingPole')
})

test('broken swords and bows stay equipped but cannot be used until repaired', () => {
  const { isHeroToolAvailable, getEquippedItemWeapon } = loadHeroToolEquipment()
  const hero = { inventory: { activeWeapons: { melee: 'sword_iron~condition:0', ranged: 'bow~condition:0' } } }
  assert.equal(isHeroToolAvailable(hero, 'sword'), false)
  assert.equal(isHeroToolAvailable(hero, 'bow'), false)
  assert.equal(getEquippedItemWeapon('sword', hero), 'sword_iron~condition:0')
  hero.inventory.activeWeapons.melee = 'sword_iron'
  assert.equal(isHeroToolAvailable(hero, 'sword'), true)
})

test('bows automatically display a quiver while inventory icons still use only the bow', () => {
  const { getHeroToolEquipment, getEquippedItemWeapon } = loadHeroToolEquipment()
  for (const bow of ['bow', 'bow_great', 'bow_recurve~condition:77']) {
    const hero = { inventory: { activeWeapons: { ranged: bow }, equipped: {} } }
    assert.deepEqual(getHeroToolEquipment(hero, 'bow'), [bow, 'quiver'])
    assert.equal(getEquippedItemWeapon('bow', hero), bow)
    assert.deepEqual(getHeroToolEquipment(hero, 'interact'), [])
    assert.deepEqual(getHeroToolEquipment(hero, 'sword'), [])
    delete hero.inventory.activeWeapons.ranged
    assert.deepEqual(getHeroToolEquipment(hero, 'bow'), [])
  }
})

test('legacy quivers are removed from inventories and cannot be added or equipped as items', () => {
  const { getHeroInventory, addHeroInventoryItem } = loadTsModule('app/lib/equipment/heroInventory.ts')
  const { getWeaponSlot } = loadTsModule('app/lib/equipment/equipmentSlots.ts')
  const hero = {
    inventory: { equipment: ['quiver', 'bow', 'quiver'], activeWeapons: { ranged: 'bow', quiver: 'quiver' } },
  }
  const inventory = getHeroInventory(hero)
  assert.deepEqual(inventory.equipment, ['bow'])
  assert.deepEqual(inventory.activeWeapons, { ranged: 'bow' })
  assert.equal(addHeroInventoryItem(hero, 'quiver'), false)
  assert.equal(getWeaponSlot('quiver'), null)
})
