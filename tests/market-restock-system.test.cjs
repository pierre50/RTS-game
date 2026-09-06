const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadMarketRestockSystem() {
  return loadTsModule('app/services/world/MarketRestockSystem.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: { market: 'Market' },
        RESOURCE_STORAGE_NAMES: ['wood', 'berry', 'meat', 'wheat', 'stone', 'gold', 'copper', 'iron'],
        UNIT_TYPES: { chief: 'Chief', infantry: 'Fantassin', bowman: 'Bowman', priest: 'Priest' },
        WORK_TYPES: {
          woodcutter: 'woodcutter',
          stoneminer: 'stoneminer',
          goldminer: 'goldminer',
          builder: 'builder',
          farmer: 'farmer',
          hunter: 'hunter',
        },
      },
      '../lpc/equipment': {
        DYNAMIC_EQUIPMENT_KEYS: ['axe_ceramic', 'arrow_copper', 'bow', 'quiver'],
        dynamicEquipmentForUnit: unitType => (unitType === 'Bowman' ? ['bow', 'quiver', 'arrow_copper'] : []),
        dynamicEquipmentForWork: work => (work === 'woodcutter' ? ['axe_ceramic'] : []),
      },
      './equipmentLoot': {
        addHeroInventoryItem: () => true,
        getHeroInventory: hero => hero.inventory,
        removeHeroInventoryItem: () => true,
      },
    },
  })
}

test('market restock resets built market stock on interval days only', () => {
  const { MarketRestockSystem } = loadMarketRestockSystem()
  const market = { type: 'Market', isBuilt: true, marketStock: ['old_item'], owner: { age: 1, civ: 'Hellas' } }
  const menuRefreshes = []
  const reportEntries = []
  const system = new MarketRestockSystem({
    menu: { refreshHeroBuildingMenu: () => menuRefreshes.push('refresh') },
    players: [{ age: 1, buildings: [market], civ: 'Hellas', isPlayed: true }],
  })

  system.handleDailyWorldEvent({ day: 2, previousDay: 1 })
  assert.deepEqual(market.marketStock, ['old_item'])

  system.handleDailyWorldEvent({
    day: 3,
    previousDay: 2,
    report: { add: entry => reportEntries.push(entry) },
  })
  assert.equal(market.marketStock.filter(item => item === 'arrow_copper').length, 20)
  assert.equal(market.marketStock.includes('axe_ceramic'), false)
  assert.equal(market.marketStock.includes('quiver'), false)
  assert.deepEqual(menuRefreshes, ['refresh'])
  assert.deepEqual(reportEntries, [
    { count: 1, player: system.context.players[0], type: 'market-restocked' },
  ])
})
