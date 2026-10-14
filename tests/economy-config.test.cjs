const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('changing market configuration updates offers, UI prices and shared daily gold together', () => {
  const config = loadTsModule('app/config/market.ts')
  const options = {
    moduleCache: new Map(),
    mocks: {
      '../../config/market': {
        ...config,
        MARKET_RESOURCE_BUY_MULTIPLIER: 7,
        MARKET_GOLD_TARGETS: [100, 200, 300],
        MARKET_DAILY_GOLD_FRACTION: 0.2,
        MARKET_RESOURCE_COUNTS: { wood: [5, 10, 15] },
      },
    },
  }
  const market = loadTsModule('app/lib/equipment/equipmentMarket.ts', options)
  const { createResourceRowInfo } = loadTsModule('app/ui/inventory/InventoryDetails.ts', options)
  const { replenishSettlementMarketGold } = loadTsModule('app/lib/equipment/marketSettlementGold.ts', options)
  // Markets are two-level buildings (TWO_LEVEL_BUILDING_MAX), so the configured third tier is never reached.
  const building = { type: 'Market', isBuilt: true, buildingLevel: 2, marketGold: 0 }
  assert.equal(market.getMarketLevel(building), 1)
  assert.deepEqual(market.getMarketResourceOffers(building), [{ resource: 'wood', count: 10, goldValue: 7 }])
  assert.equal(createResourceRowInfo('wood', 2, 'market-buy').goldValue, 14)
  const hero = { controlMode: 'hero', inventory: { equipment: [], resources: { gold: 14 } } }
  assert.equal(market.buyMarketResource(hero, building, 'wood', 2), 2)
  assert.equal(hero.inventory.resources.gold, 0)
  assert.equal(building.marketGold, 14)
  // Level-1 target 200 * daily fraction 0.2 = 40 gold added to the 14 received from the sale.
  replenishSettlementMarketGold({ buildings: [building] })
  assert.equal(building.marketGold, 54)
})
