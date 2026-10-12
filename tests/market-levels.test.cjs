const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const market = loadTsModule('app/lib/equipment/equipmentMarket.ts')
const { replenishSettlementMarketGold } = loadTsModule('app/lib/equipment/marketSettlementGold.ts')

test('market tiers control materials, ranged weapons and stock counts', () => {
  for (const buildingLevel of [0, 1, 2]) {
    const offers = market.getMarketEquipmentOffers({ buildingLevel, civilization: 'Hellas' })
    const count = key => offers.find(offer => offer.equipment === key)?.count ?? 0
    assert.equal(count('axe_ceramic'), [2, 4, 4][buildingLevel])
    assert.equal(count('arrow_ceramic'), [20, 40, 40][buildingLevel])
    assert.equal(count('axe_bronze') > 0, true)
    assert.equal(count('axe_iron') > 0, buildingLevel >= 1)
    assert.equal(count('bow') > 0, true)
    assert.equal(count('bow_recurve') > 0, buildingLevel >= 1)
    assert.equal(market.getMarketGold({ buildingLevel }), [250, 600, 600][buildingLevel])
    const resources = market.getMarketResourceOffers({ buildingLevel })
    assert.equal(resources.find(offer => offer.resource === 'wood').count, [30, 60, 60][buildingLevel])
    assert.equal(
      resources.some(offer => offer.resource === 'bronzeIngot'),
      true
    )
    assert.equal(
      resources.some(offer => offer.resource === 'ironIngot'),
      buildingLevel >= 1
    )
  }
})

test('selling advanced loot and reloading cannot bypass the market level', () => {
  const building = { buildingLevel: 0, marketGold: 1200, marketStock: [] }
  const hero = { type: 'Hero', inventory: { resources: {}, equipment: ['sword_iron'] } }
  assert.equal(market.sellHeroEquipment(hero, building, 'sword_iron'), 1)
  assert.equal(hero.inventory.resources.gold, 100)
  const saved = JSON.parse(JSON.stringify(building))
  assert.deepEqual(market.getMarketEquipmentOffers({ buildingLevel: 0 }, saved.marketStock), [])
  assert.equal(market.buyMarketEquipment(hero, saved, 'sword_iron'), 0)
  assert.equal(market.buyMarketEquipment(hero, saved, 'sword_iron', 1, ['sword_iron']), 0)
})

test('upgrading preserves money and sold stock until replenishment', () => {
  const building = { buildingLevel: 0, marketGold: 0 }
  market.resetMarketEquipmentStock(building)
  building.marketResourceStock.wood = 0
  building.marketStock = []
  building.buildingLevel = 2
  assert.equal(market.getMarketGold(building), 0)
  assert.deepEqual(market.ensureMarketEquipmentStock(building), [])
  assert.equal(
    market.getMarketResourceOffers(building).some(offer => offer.resource === 'iron'),
    false
  )
  market.resetMarketEquipmentStock(building)
  assert.equal(building.marketResourceStock.wood, 60)
  assert.equal(building.marketResourceStock.iron, 10)
})

test('resource purchases charge three times resale, consume stock and respect bag space after payment', () => {
  const building = { buildingLevel: 0, marketGold: 0, marketResourceStock: { wood: 30 } }
  const hero = { type: 'Hero', controlMode: 'hero', inventory: { resources: { gold: 30 }, equipment: [] } }
  assert.equal(market.buyMarketResource(hero, building, 'wood', 50), 10)
  assert.equal(hero.inventory.resources.gold, 0)
  assert.equal(hero.inventory.resources.wood, 10)
  assert.equal(building.marketGold, 30)
  assert.equal(building.marketResourceStock.wood, 20)
  assert.equal(market.sellHeroResource(hero, building, 'wood', 10), 10)
  assert.equal(hero.inventory.resources.gold, 10)
  assert.equal(building.marketGold, 20)
  assert.equal(market.buyMarketResource(hero, building, 'iron', 1), 0)
  assert.equal(market.buyMarketResource(hero, building, 'wood', NaN), 0)
  hero.inventory.resources = { stone: 50, gold: 3 }
  assert.equal(market.buyMarketResource(hero, building, 'wood', 1), 0)
  assert.deepEqual(hero.inventory.resources, { stone: 50, gold: 3 })
})

test('each village shares one allowance and trade receipts above the target are preserved', () => {
  const create = (i, buildingLevel) => ({ type: 'Market', isBuilt: true, i, j: 0, buildingLevel, marketGold: 0 })
  const a = create(0, 0),
    b = create(1, 2),
    distant = create(1000, 1)
  const owner = { buildings: [a, b, distant] }
  replenishSettlementMarketGold(owner)
  assert.equal(a.marketGold + b.marketGold, 60)
  assert.equal(distant.marketGold, 60)
  for (let day = 1; day < 10; day++) replenishSettlementMarketGold(owner)
  assert.equal(a.marketGold + b.marketGold, 600)
  assert.equal(distant.marketGold, 600)
  b.marketGold = 2000
  replenishSettlementMarketGold(owner)
  assert.equal(b.marketGold, 2000)
})

test('starter markets offer bronze and a simple bow, keep iron gated, and keep leather as a one-piece reserve', () => {
  for (const buildingLevel of [0, 1]) {
    const offers = market.getMarketEquipmentOffers({ buildingLevel, civilization: 'Hellas' })
    assert.equal(offers.find(offer => offer.equipment === 'armor_leather').count, 1)
    assert.ok(offers.some(offer => offer.equipment === 'sword_bronze'))
    assert.ok(offers.some(offer => offer.equipment === 'arrow_bronze'))
    const resources = market.getMarketResourceOffers({ buildingLevel })
    const count = resource => resources.find(offer => offer.resource === resource)?.count ?? 0
    assert.equal(count('copper'), [10, 20][buildingLevel])
    assert.equal(count('tin'), [10, 20][buildingLevel])
    assert.equal(count('bronzeIngot'), [3, 5][buildingLevel])
    assert.equal(count('ironIngot'), [0, 4][buildingLevel])
  }
})

test('buying craftable new gear costs more than buying its recipe ingredients', () => {
  const { HERO_CRAFT_RECIPES } = loadTsModule('app/lib/hero/heroCraftRecipes.ts')
  for (const recipe of HERO_CRAFT_RECIPES) {
    if (!['equipment', 'arrows'].includes(recipe.category)) continue
    const price = market.getEquipmentGoldValue(recipe.outputEquipment)
    if (price <= 0) continue
    const ingredientCost =
      Object.entries(recipe.cost).reduce(
        (sum, [key, quantity]) => sum + quantity * market.getMarketResourceBuyPrice(key),
        0
      ) / recipe.outputCount
    assert.ok(price > ingredientCost, recipe.id)
  }
})
