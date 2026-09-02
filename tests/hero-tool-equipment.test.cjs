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
        applyBakedLpcUnitAssets: () => {},
      },
      '../equipment/equipmentStats': {
        getUnitWorkEquipment: work => (work === 'attacker' ? ['axe_iron'] : []),
        refreshUnitEquipmentStats: () => {},
      },
      '../units/unitWorkAppearance': {
        applyUnitWorkAssets: () => {},
      },
    },
  })
}

test('hero interact is bare hands even when attacker work has fallback equipment', () => {
  const { getHeroToolEquipment } = loadHeroToolEquipment()
  const hero = {
    owner: { age: 3 },
    inventory: {
      activeWeapons: { melee: 'axe_iron' },
      equipped: { offhand: 'round_shield_iron_slash' },
    },
  }

  assert.deepEqual(getHeroToolEquipment(hero, 'interact'), [])
  assert.deepEqual(getHeroToolEquipment(hero, 'sword'), ['axe_iron', 'round_shield_iron_slash'])
})
