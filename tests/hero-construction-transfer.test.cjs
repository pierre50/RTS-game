const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('construction transfer shows only useful cargo and never takes more than the remaining recipe', () => {
  let options
  const { createHeroConstructionBody } = loadTsModule('app/ui/hero-building/HeroConstructionBody.ts', {
    mocks: {
      '../inventory/InventoryTransferPanel': {
        InventoryTransferPanel: class {
          constructor(value) {
            options = value
            this.element = { classList: { add() {} } }
          }
        },
      },
      '../inventory/HeroBagContainer': {
        createHeroBagContainer: hero => ({ id: hero.label, inventory: hero.inventory }),
      },
      '../../lib/inventory/inventoryContainers': {
        createInventoryContainer: (target, config) => ({ ...config, inventory: target.inventory ?? { resources: {} } }),
      },
      '../../lib/units/village/villageWorkEvents': { notifyVillageWorkChanged() {} },
    },
  })
  const owner = { label: 'player' }
  const hero = {
    label: 'hero',
    owner,
    inventory: { resources: { wood: 20, stone: 3, gold: 9 }, equipment: ['hammer_ceramic'] },
  }
  const building = {
    label: 'house',
    owner,
    isBuilt: false,
    hitPoints: 10,
    constructionMaterials: { cost: { wood: 10, stone: 5 }, delivered: { wood: 8 }, consumed: {} },
  }
  const menu = { context: { controls: { heroUnit: hero } }, showMessage() {} }

  createHeroConstructionBody(building, menu, () => {})
  const visible = options.visibleInventory(options.source)
  assert.deepEqual(visible.resources, { wood: 20, stone: 3 })
  assert.deepEqual(visible.equipment, [])
  assert.equal(options.moveResource(options.source, options.destination, 'wood'), 2)
  assert.equal(hero.inventory.resources.wood, 18)
  assert.equal(options.moveResource(options.source, options.destination, 'stone'), 3)
  assert.equal(hero.inventory.resources.stone, undefined)
  assert.deepEqual(building.constructionMaterials.delivered, { wood: 10, stone: 3 })
  assert.deepEqual(options.visibleInventory(options.source).resources, {})
  assert.equal(options.moveResource(options.source, options.destination, 'gold'), 0)
  assert.equal(hero.inventory.resources.gold, 9)
})
