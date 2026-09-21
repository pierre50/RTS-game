const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadEquipmentMarket() {
  return loadTsModule('app/lib/equipment/equipmentMarket.ts', {
    mocks: {
      '../../constants': {
        RESOURCE_STORAGE_NAMES: [
          'wood',
          'berry',
          'meat',
          'wheat',
          'herb',
          'toxicHerb',
          'fiber',
          'feather',
          'leather',
          'sinew',
          'stone',
          'gold',
          'copper',
          'iron',
        ],
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
        DYNAMIC_EQUIPMENT_KEYS: [
          'axe_ceramic',
          'axe_iron',
          'arrow_ceramic',
          'arrow_copper',
          'arrow_bronze',
          'arrow_iron',
          'bow',
          'quiver',
          'bow_recurve',
          'sword_ceramic',
          'sword_iron',
          'helmet_barbuta_iron',
          'helmet_legion_bronze',
          'centurion_crest',
          'centurion_plumage',
          'cape_solid',
        ],
        dynamicEquipmentForUnit: (unitType, age, _level, civilization) => {
          if (unitType === 'Chief') return [age >= 2 ? 'sword_iron' : 'sword_ceramic']
          if (unitType === 'Fantassin' && civilization === 'Hellas') return ['helmet_barbuta_iron', 'centurion_crest']
          if (unitType === 'Fantassin' && civilization === 'Latium')
            return ['helmet_legion_bronze', 'centurion_plumage']
          if (unitType === 'Bowman') return [age >= 1 ? 'bow_recurve' : 'bow', 'quiver', 'arrow_copper']
          return []
        },
        dynamicEquipmentForWork: (work, age) => {
          if (work === 'woodcutter') return [age >= 2 ? 'axe_iron' : 'axe_ceramic']
          return []
        },
      },
      './equipmentLoot': {
        getHeroInventory: hero => {
          hero.inventory = hero.inventory ?? {}
          hero.inventory.resources = hero.inventory.resources ?? {}
          hero.inventory.equipment = hero.inventory.equipment ?? []
          return hero.inventory
        },
        addHeroInventoryItem: (hero, item, count = 1) => {
          for (let index = 0; index < count; index++) hero.inventory.equipment.push(item)
          return true
        },
        removeHeroInventoryItem: (hero, item) => {
          const index = hero.inventory.equipment.indexOf(item)
          if (index < 0) return false
          hero.inventory.equipment.splice(index, 1)
          return true
        },
      },
    },
  })
}

test('market equipment purchase spends hero gold and adds the item', () => {
  const { buyMarketEquipment } = loadEquipmentMarket()
  const hero = { owner: { age: 2 }, inventory: { equipment: [], resources: { gold: 500 } } }

  assert.equal(buyMarketEquipment(hero, 'sword_ceramic'), 1)

  assert.deepEqual(hero.inventory.equipment, ['sword_ceramic'])
  assert.equal(hero.inventory.resources.gold, 315)
})

test('repeated market purchases and sales cannot exceed the available stock or inventory', () => {
  const { buyMarketEquipment, sellHeroEquipment } = loadEquipmentMarket()
  const hero = { owner: { age: 2 }, inventory: { equipment: [], resources: { gold: 500 } } }
  const stock = ['sword_ceramic']
  assert.equal(buyMarketEquipment(hero, 'sword_ceramic', 1, stock), 1)
  for (let i = 0; i < 20; i++) assert.equal(buyMarketEquipment(hero, 'sword_ceramic', 1, stock), 0)
  assert.deepEqual(hero.inventory.equipment, ['sword_ceramic'])
  assert.equal(hero.inventory.resources.gold, 315)
  assert.equal(sellHeroEquipment(hero, 'sword_ceramic'), 1)
  const gold = hero.inventory.resources.gold
  for (let i = 0; i < 20; i++) assert.equal(sellHeroEquipment(hero, 'sword_ceramic'), 0)
  assert.deepEqual(hero.inventory.equipment, [])
  assert.equal(hero.inventory.resources.gold, gold)
})

test('market equipment retains civilization selection but is independent of age', () => {
  const { getMarketEquipmentOffers, buyMarketEquipment } = loadEquipmentMarket()
  for (const civilization of ['Hellas', 'Latium']) {
    const keys = age => getMarketEquipmentOffers({ age, civilization }).map(offer => offer.equipment)
    assert.deepEqual(keys(0), keys(2))
    assert.ok(keys(0).includes('sword_iron'))
    assert.ok(keys(0).includes('bow_recurve'))
    assert.equal(keys(0).includes('quiver'), false)
    assert.equal(keys(0).includes('axe_iron'), false)
  }
  const hero = { owner: { age: 0 }, inventory: { equipment: [], resources: { gold: 1000 } } }
  assert.equal(buyMarketEquipment(hero, 'sword_iron'), 1)
})

test('arrow material increases unit prices, stock offers and resale proceeds', () => {
  const {
    getEquipmentGoldValue,
    getEquipmentResaleGoldValue,
    getMarketEquipmentOffers,
    buyMarketEquipment,
    sellHeroEquipment,
  } = loadEquipmentMarket()
  const arrows = ['arrow_ceramic', 'arrow_copper', 'arrow_bronze', 'arrow_iron']
  const prices = [4, 6, 9, 12]
  const resalePrices = [1, 2, 3, 4]

  assert.deepEqual(arrows.map(getEquipmentGoldValue), prices)
  assert.deepEqual(arrows.map(getEquipmentResaleGoldValue), resalePrices)
  assert.deepEqual(
    getMarketEquipmentOffers({ age: 2 }, arrows).map(offer => offer.goldValue),
    prices
  )

  for (const [index, arrow] of arrows.entries()) {
    const hero = { owner: { age: 2 }, inventory: { equipment: [], resources: { gold: 100 } } }
    const stock = [arrow, arrow]
    assert.equal(buyMarketEquipment(hero, arrow, 2, stock), 2)
    assert.equal(hero.inventory.resources.gold, 100 - prices[index] * 2)
    assert.deepEqual(stock, [])
    assert.equal(sellHeroEquipment(hero, arrow, 2), 2)
    assert.equal(hero.inventory.resources.gold, 100 - prices[index] * 2 + resalePrices[index] * 2)
    assert.deepEqual(hero.inventory.equipment, [])
  }
})

test('market offers arrow stacks but buys one or all like chest transfers', () => {
  const { buyMarketEquipment, getMarketEquipmentOffers } = loadEquipmentMarket()
  const arrowOffer = getMarketEquipmentOffers({ age: 2, civilization: 'Hellas' }).find(
    offer => offer.equipment === 'arrow_copper'
  )
  assert.equal(arrowOffer.count, 20)

  const hero = { owner: { age: 2 }, inventory: { equipment: [], resources: { gold: 150 } } }
  assert.equal(buyMarketEquipment(hero, 'arrow_copper'), 1)
  assert.equal(buyMarketEquipment(hero, 'arrow_copper', arrowOffer.count), 20)

  assert.equal(hero.inventory.equipment.filter(item => item === 'arrow_copper').length, 21)
  assert.equal(hero.inventory.resources.gold, 24)
})

test('market purchase consumes stock quantities', () => {
  const { buyMarketEquipment, getMarketEquipmentOffers, resetMarketEquipmentStock } = loadEquipmentMarket()
  const market = {}
  const stock = resetMarketEquipmentStock(market, { age: 2, civilization: 'Hellas' })
  const hero = { owner: { age: 2 }, inventory: { equipment: [], resources: { gold: 100 } } }

  assert.equal(
    getMarketEquipmentOffers({ age: 2, civilization: 'Hellas' }, stock).find(
      offer => offer.equipment === 'arrow_copper'
    ).count,
    20
  )
  assert.equal(buyMarketEquipment(hero, 'arrow_copper', 7, stock), 7)

  assert.equal(hero.inventory.equipment.filter(item => item === 'arrow_copper').length, 7)
  assert.equal(stock.filter(item => item === 'arrow_copper').length, 13)
  assert.equal(stock.includes('axe_ceramic'), false)
  assert.equal(stock.includes('quiver'), false)
})

test('market stack purchase is capped by available gold', () => {
  const { buyMarketEquipment } = loadEquipmentMarket()
  const hero = { owner: { age: 2 }, inventory: { equipment: [], resources: { gold: 7 } } }

  assert.equal(buyMarketEquipment(hero, 'arrow_copper', 20), 1)

  assert.deepEqual(hero.inventory.equipment, ['arrow_copper'])
  assert.deepEqual(hero.inventory.resources, { gold: 1 })
})

test('market equipment purchase fails when gold is missing', () => {
  const { buyMarketEquipment } = loadEquipmentMarket()
  const hero = { owner: { age: 2 }, inventory: { equipment: [], resources: { gold: 399 } } }

  assert.equal(buyMarketEquipment(hero, 'sword_iron'), 0)

  assert.deepEqual(hero.inventory.equipment, [])
})

test('market sales credit gold for bag equipment and resources', () => {
  const { sellHeroEquipment, sellHeroResource } = loadEquipmentMarket()
  const hero = { owner: { age: 2 }, inventory: { equipment: ['bow', 'bow'], resources: { wood: 5, gold: 2 } } }

  assert.equal(sellHeroEquipment(hero, 'bow', 2), 2)
  assert.equal(sellHeroResource(hero, 'wood', 3), 3)

  assert.deepEqual(hero.inventory.equipment, [])
  assert.deepEqual(hero.inventory.resources, { wood: 2, gold: 131 })
})

test('market sells gathered feathers as a rare resource', () => {
  const { getResourceGoldValue, sellHeroResource } = loadEquipmentMarket()
  const hero = { owner: { age: 2 }, inventory: { equipment: [], resources: { feather: 3, gold: 1 } } }

  assert.equal(getResourceGoldValue('feather'), 4)
  assert.equal(sellHeroResource(hero, 'feather'), 3)

  assert.deepEqual(hero.inventory.resources, { gold: 13 })
})

test('market sells gathered leather as a valuable animal resource', () => {
  const { getResourceGoldValue, sellHeroResource } = loadEquipmentMarket()
  const hero = { owner: { age: 2 }, inventory: { equipment: [], resources: { leather: 2, gold: 1 } } }

  assert.equal(getResourceGoldValue('leather'), 6)
  assert.equal(sellHeroResource(hero, 'leather'), 2)

  assert.deepEqual(hero.inventory.resources, { gold: 13 })
})

test('market sells gathered sinew as a prized animal resource', () => {
  const { getResourceGoldValue, sellHeroResource } = loadEquipmentMarket()
  const hero = { owner: { age: 2 }, inventory: { equipment: [], resources: { sinew: 2, gold: 1 } } }

  assert.equal(getResourceGoldValue('sinew'), 8)
  assert.equal(sellHeroResource(hero, 'sinew'), 2)

  assert.deepEqual(hero.inventory.resources, { gold: 17 })
})

test('market sells gathered plant resources', () => {
  const { getResourceGoldValue, sellHeroResource } = loadEquipmentMarket()
  const hero = {
    owner: { age: 2 },
    inventory: { equipment: [], resources: { herb: 2, toxicHerb: 2, fiber: 2, gold: 0 } },
  }

  assert.equal(getResourceGoldValue('herb'), 3)
  assert.equal(getResourceGoldValue('toxicHerb'), 5)
  assert.equal(getResourceGoldValue('fiber'), 2)
  assert.equal(sellHeroResource(hero, 'herb', 2), 2)
  assert.equal(sellHeroResource(hero, 'toxicHerb', 2), 2)
  assert.equal(sellHeroResource(hero, 'fiber', 2), 2)

  assert.deepEqual(hero.inventory.resources, { gold: 20 })
})
