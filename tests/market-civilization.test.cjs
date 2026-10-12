const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const {
  resetMarketEquipmentStock,
  ensureMarketEquipmentStock,
  getMarketEquipmentOffers,
  buyMarketEquipment,
  sellHeroEquipment,
} = loadTsModule('app/lib/equipment/equipmentMarket.ts')

test('market owner determines helmets and decorations regardless of visitor or supplied fallback', () => {
  const market = { buildingLevel: 2, owner: { civ: 'Nord' }, marketGold: 1000 }
  const stock = resetMarketEquipmentStock(market, { civilization: 'Alba' })
  const helmets = stock.filter(item => item.startsWith('helmet_'))
  assert.ok(helmets.some(item => item.includes('~decor:upward_horns_white')))
  assert.ok(helmets.some(item => !item.includes('~decor:')))
  assert.ok(helmets.every(item => !item.includes('helmet_wings')))
  const decorated = helmets.find(item => item.includes('~decor:'))
  const initialCount = stock.filter(item => item === decorated).length
  const hero = { type: 'Hero', owner: { civ: 'Alba' }, inventory: { resources: { gold: 10000 }, equipment: [] } }
  assert.ok(
    getMarketEquipmentOffers({ buildingLevel: 2, civilization: market.owner.civ }, stock).some(
      offer => offer.equipment === decorated
    )
  )
  assert.equal(buyMarketEquipment(hero, market, decorated, 1, stock), 1)
  assert.deepEqual(hero.inventory.equipment, [decorated])
  assert.equal(
    ensureMarketEquipmentStock(market).filter(item => item === decorated).length,
    initialCount - 1,
    'opening again must not replenish a sold helmet'
  )
})

test('market resets generate only their civilization helmet models', () => {
  const models = {
    Hellas: 'barbuta',
    Latium: 'legion',
    Sumeria: 'nasal',
    Nobatia: 'nasal',
    Kemet: 'bascinet_round',
    Xia: 'bascinet_round',
    Alba: 'bascinet_round',
    Nord: 'norman',
  }
  for (const [civ, model] of Object.entries(models)) {
    const market = { buildingLevel: 2, owner: { civ }, marketGold: 1000 }
    const stock = resetMarketEquipmentStock(market, { civilization: civ === 'Nord' ? 'Hellas' : 'Nord' })
    const helmets = stock.filter(item => item.startsWith('helmet_'))
    assert.ok(helmets.length > 0, civ)
    assert.ok(
      helmets.every(item => item.startsWith(`helmet_${model}_`) || item.startsWith('helmet_pointed_leather')),
      civ
    )
  }
})

test('foreign helmets sold to a market remain visible and purchasable until stock reset', () => {
  for (const equipment of ['helmet_barbuta_iron', 'helmet_barbuta_iron~decor:centurion_crest']) {
    const market = { buildingLevel: 2, owner: { civ: 'Nord' }, marketGold: 10000 }
    const stock = resetMarketEquipmentStock(market)
    assert.ok(!stock.includes(equipment))
    const seller = { type: 'Hero', inventory: { resources: {}, equipment: [equipment, equipment] } }
    assert.equal(sellHeroEquipment(seller, market, equipment, 2), 2)
    assert.equal(stock.filter(item => item === equipment).length, 2)
    assert.equal(ensureMarketEquipmentStock(market), stock)
    const saved = JSON.parse(JSON.stringify(market))
    const offers = getMarketEquipmentOffers(
      { buildingLevel: 2, civilization: 'Nord' },
      ensureMarketEquipmentStock(saved)
    )
    assert.equal(offers.find(offer => offer.equipment === equipment).count, 2)
    const buyer = { type: 'Hero', owner: { civ: 'Alba' }, inventory: { resources: { gold: 10000 }, equipment: [] } }
    assert.equal(buyMarketEquipment(buyer, saved, equipment), 1)
    assert.deepEqual(buyer.inventory.equipment, [equipment])
    assert.equal(saved.marketStock.filter(item => item === equipment).length, 1)
    assert.ok(!resetMarketEquipmentStock(saved).includes(equipment))
    assert.equal(buyMarketEquipment(buyer, saved, equipment), 0)
  }
})
