const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function controller(activeWeapons, equippedItem = 'interact') {
  const equipment = loadTsModule('app/lib/hero/heroToolEquipment.ts')
  const { HeroEquipmentController } = loadTsModule('app/controllers/HeroEquipmentController.ts', {
    mocks: {
      '../lib/hero/heroTools': {
        ...equipment,
        applyToolAppearance: () => {},
        isHeroPowerChargeActiveForTool: () => true,
        isHeroCatchingPoleEquipped: () => true,
      },
    },
  })
  return new HeroEquipmentController({
    equippedItem,
    heroUnit: { inventory: { activeWeapons } },
    controls: { context: {} },
  })
}

test('cycling skips missing melee weapon to reach the bow', () => {
  const input = controller({ ranged: 'bow' })
  assert.equal(input.cycleTool(1), true)
  assert.equal(input.host.equippedItem, 'bow')
  assert.equal(input.cycleTool(1), true)
  assert.equal(input.host.equippedItem, 'interact')
})

test('cycling skips broken weapons in either direction', () => {
  const input = controller({ melee: 'sword_iron', ranged: 'bow~condition:0' }, 'sword')
  assert.equal(input.cycleTool(1), true)
  assert.equal(input.host.equippedItem, 'interact')
  assert.equal(input.cycleTool(-1), true)
  assert.equal(input.host.equippedItem, 'sword')
})

test('cycling with no usable weapon leaves bare hands selected', () => {
  const input = controller({})
  assert.equal(input.cycleTool(1), false)
  assert.equal(input.cycleTool(-1), false)
  assert.equal(input.host.equippedItem, 'interact')
})
