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
          'arrow_copper',
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
          if (unitType === 'Chief') return [age >= 3 ? 'sword_iron' : 'sword_ceramic']
          if (unitType === 'Fantassin' && civilization === 'Hellas') return ['helmet_barbuta_iron', 'centurion_crest']
          if (unitType === 'Fantassin' && civilization === 'Latium')
            return ['helmet_legion_bronze', 'centurion_plumage']
          if (unitType === 'Bowman') return [age >= 2 ? 'bow_recurve' : 'bow', 'quiver', 'arrow_copper']
          return []
        },
        dynamicEquipmentForWork: (work, age) => {
          if (work === 'woodcutter') return [age >= 3 ? 'axe_iron' : 'axe_ceramic']
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
  const hero = { inventory: { equipment: [], resources: { gold: 500 } } }

  assert.equal(buyMarketEquipment(hero, 'sword_ceramic'), 1)

  assert.deepEqual(hero.inventory.equipment, ['sword_ceramic'])
  assert.equal(hero.inventory.resources.gold, 315)
})

test('market equipment catalog follows market civilization and age without tools or quivers', () => {
  const { getMarketEquipmentOffers } = loadEquipmentMarket()

  assert.deepEqual(
    getMarketEquipmentOffers({ age: 3, civilization: 'Hellas' }).map(offer => offer.equipment),
    ['sword_iron', 'helmet_barbuta_iron', 'centurion_crest', 'bow_recurve', 'arrow_copper']
  )
  assert.deepEqual(
    getMarketEquipmentOffers({ age: 2, civilization: 'Latium' }).map(offer => offer.equipment),
    ['sword_ceramic', 'helmet_legion_bronze', 'centurion_plumage', 'bow_recurve', 'arrow_copper']
  )
})

test('market offers arrow stacks but buys one or all like chest transfers', () => {
  const { buyMarketEquipment, getMarketEquipmentOffers } = loadEquipmentMarket()
  const arrowOffer = getMarketEquipmentOffers({ age: 2, civilization: 'Hellas' }).find(
    offer => offer.equipment === 'arrow_copper'
  )
  assert.equal(arrowOffer.count, 20)

  const hero = { inventory: { equipment: [], resources: { gold: 100 } } }
  assert.equal(buyMarketEquipment(hero, 'arrow_copper'), 1)
  assert.equal(buyMarketEquipment(hero, 'arrow_copper', arrowOffer.count), 20)

  assert.equal(hero.inventory.equipment.filter(item => item === 'arrow_copper').length, 21)
  assert.equal(hero.inventory.resources.gold, 16)
})

test('market purchase consumes stock quantities', () => {
  const { buyMarketEquipment, getMarketEquipmentOffers, resetMarketEquipmentStock } = loadEquipmentMarket()
  const market = {}
  const stock = resetMarketEquipmentStock(market, { age: 2, civilization: 'Hellas' })
  const hero = { inventory: { equipment: [], resources: { gold: 100 } } }

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
  const hero = { inventory: { equipment: [], resources: { gold: 5 } } }

  assert.equal(buyMarketEquipment(hero, 'arrow_copper', 20), 1)

  assert.deepEqual(hero.inventory.equipment, ['arrow_copper'])
  assert.deepEqual(hero.inventory.resources, { gold: 1 })
})

test('market equipment purchase fails when gold is missing', () => {
  const { buyMarketEquipment } = loadEquipmentMarket()
  const hero = { inventory: { equipment: [], resources: { gold: 399 } } }

  assert.equal(buyMarketEquipment(hero, 'sword_iron'), 0)

  assert.deepEqual(hero.inventory.equipment, [])
})

test('market sales credit gold for bag equipment and resources', () => {
  const { sellHeroEquipment, sellHeroResource } = loadEquipmentMarket()
  const hero = { inventory: { equipment: ['bow', 'bow'], resources: { wood: 5, gold: 2 } } }

  assert.equal(sellHeroEquipment(hero, 'bow', 2), 2)
  assert.equal(sellHeroResource(hero, 'wood', 3), 3)

  assert.deepEqual(hero.inventory.equipment, [])
  assert.deepEqual(hero.inventory.resources, { wood: 2, gold: 131 })
})

test('market sells gathered feathers as a rare resource', () => {
  const { getResourceGoldValue, sellHeroResource } = loadEquipmentMarket()
  const hero = { inventory: { equipment: [], resources: { feather: 3, gold: 1 } } }

  assert.equal(getResourceGoldValue('feather'), 4)
  assert.equal(sellHeroResource(hero, 'feather'), 3)

  assert.deepEqual(hero.inventory.resources, { gold: 13 })
})

test('market sells gathered leather as a valuable animal resource', () => {
  const { getResourceGoldValue, sellHeroResource } = loadEquipmentMarket()
  const hero = { inventory: { equipment: [], resources: { leather: 2, gold: 1 } } }

  assert.equal(getResourceGoldValue('leather'), 6)
  assert.equal(sellHeroResource(hero, 'leather'), 2)

  assert.deepEqual(hero.inventory.resources, { gold: 13 })
})

test('market sells gathered sinew as a prized animal resource', () => {
  const { getResourceGoldValue, sellHeroResource } = loadEquipmentMarket()
  const hero = { inventory: { equipment: [], resources: { sinew: 2, gold: 1 } } }

  assert.equal(getResourceGoldValue('sinew'), 8)
  assert.equal(sellHeroResource(hero, 'sinew'), 2)

  assert.deepEqual(hero.inventory.resources, { gold: 17 })
})

test('market sells gathered plant resources', () => {
  const { getResourceGoldValue, sellHeroResource } = loadEquipmentMarket()
  const hero = { inventory: { equipment: [], resources: { herb: 2, toxicHerb: 2, fiber: 2, gold: 0 } } }

  assert.equal(getResourceGoldValue('herb'), 3)
  assert.equal(getResourceGoldValue('toxicHerb'), 5)
  assert.equal(getResourceGoldValue('fiber'), 2)
  assert.equal(sellHeroResource(hero, 'herb', 2), 2)
  assert.equal(sellHeroResource(hero, 'toxicHerb', 2), 2)
  assert.equal(sellHeroResource(hero, 'fiber', 2), 2)

  assert.deepEqual(hero.inventory.resources, { gold: 20 })
})
