const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { getMiningPickaxe } = loadTsModule('app/lib/resources/miningEquipment.ts')
const { canMineIronResource, showIronMiningBlockedMessage } = loadTsModule('app/lib/resources/ironMining.ts')

for (const age of [0, 1, 2]) {
  test(`iron depends on the carried pickaxe at age ${age}, while copper is unrestricted`, () => {
    for (const [pickaxe, allowed] of [
      ['pickaxe_ceramic', false],
      ['pickaxe_copper', false],
      ['pickaxe_bronze', true],
      ['pickaxe_iron', true],
    ]) {
      for (const type of ['Hero', 'Villager']) {
        const unit = { type, owner: { age }, inventory: { equipment: [pickaxe] } }
        assert.equal(getMiningPickaxe(unit), pickaxe)
        assert.equal(canMineIronResource(unit, { type: 'Iron' }), allowed)
        assert.equal(canMineIronResource(unit, { type: 'Copper' }), true)
      }
    }
  })
}

test('the best carried pickaxe is used and iron reports the required tool', () => {
  const messages = []
  const hero = {
    type: 'Hero',
    owner: { age: 0, isPlayed: true },
    inventory: { equipment: ['pickaxe_ceramic'] },
    context: { menu: { showMessage: (...args) => messages.push(args) } },
  }
  showIronMiningBlockedMessage(hero, { type: 'Iron' })
  assert.deepEqual(messages, [['Une pioche en bronze ou en fer est nécessaire pour extraire le fer.', 'warning']])
  hero.inventory.equipment.push('pickaxe_bronze')
  assert.equal(getMiningPickaxe(hero), 'pickaxe_bronze')
  showIronMiningBlockedMessage(hero, { type: 'Iron' })
  showIronMiningBlockedMessage(hero, { type: 'Copper' })
  assert.equal(messages.length, 1)
})

test('mining contact uses the carried pickaxe instead of the age default', () => {
  const { getActionContactTool } = loadTsModule('app/lib/actions/contactActions.ts')
  const unit = { type: 'Hero', owner: { age: 0 }, inventory: { equipment: ['pickaxe_bronze'] } }
  assert.equal(getActionContactTool(unit, 'mineiron'), 'pickaxe_bronze')
})

test('offline iron gathering uses the saved pickaxe', () => {
  const { offlineResourceWork } = loadTsModule('app/services/world/OfflineWorldWork.ts')
  const player = { age: 0 }
  const resource = { type: 'Iron', quantity: 20, hitPoints: 20 }
  const worker = { type: 'Villager', autonomousJob: 'iron', inventory: { equipment: ['pickaxe_bronze'] } }
  assert.ok(offlineResourceWork(player, worker, resource, 3))
  worker.inventory.equipment = ['pickaxe_ceramic']
  assert.equal(offlineResourceWork(player, worker, resource, 3), undefined)
})

test('bronze and iron pickaxes can be bought at an age-zero market', () => {
  const { getMarketEquipmentOffers, buyMarketEquipment } = loadTsModule('app/lib/equipment/equipmentMarket.ts')
  const offers = getMarketEquipmentOffers({ age: 0, civilization: 'Hellas' })
  for (const equipment of ['pickaxe_bronze', 'pickaxe_iron'])
    assert.ok(offers.some(offer => offer.equipment === equipment))
  const hero = { type: 'Hero', owner: { age: 0 }, inventory: { equipment: [], resources: { gold: 300 } } }
  // The purchase must fit the inventory as well as the gold budget.
  hero.inventory.resources.gold = offers.find(offer => offer.equipment === 'pickaxe_bronze').goldValue
  const stock = ['pickaxe_bronze']
  assert.equal(buyMarketEquipment(hero, 'pickaxe_bronze', 1, stock), 1)
  assert.equal(canMineIronResource(hero, { type: 'Iron' }), true)
})

test('the displayed mining layer matches the carried pickaxe at any age', () => {
  const sheet = { textures: { '0': { label: 'pickaxe-frame' } } }
  const cache = new Map()
  const { getLayerRenderState } = loadTsModule('app/classes/unit/appearance/UnitAppearanceRenderState.ts', {
    mocks: {
      'pixi.js': { Assets: { cache } },
      '../../../lib': { getSpriteFrameSelection: textures => ({ textures: Object.values(textures), mirrored: false }) },
    },
  })
  const layer = { equipmentKey: 'pickaxe_ceramic', workTypes: ['stoneminer'], walkingSheet: 'equipments/pickaxe_ceramic/front/walking', zIndex: 1 }
  for (const pickaxe of ['pickaxe_copper', 'pickaxe_bronze', 'pickaxe_iron']) {
    cache.clear()
    cache.set(`equipments/${pickaxe}/front/walking`, sheet)
    const unit = { owner: { age: 0 }, work: 'stoneminer', sprite: { currentFrame: 0 }, inventory: { equipment: [pickaxe] }, context: { map: { ready: false } } }
    const state = getLayerRenderState(unit, layer, 'walkingSheet')
    assert.equal(state?.spritesheet, sheet, pickaxe)
  }
})
