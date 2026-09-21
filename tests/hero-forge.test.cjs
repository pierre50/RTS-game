const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('forge crafts into the hero bag and rechecks proximity, construction and destruction on click', () => {
  const previousDocument = global.document
  global.document = { createElement: () => ({ appendChild() {}, textContent: '' }) }
  let reachable = true
  const rows = []
  const { HeroForgeBody } = loadTsModule('app/ui/hero-building/HeroForgeBody.ts', {
    mocks: {
      '../../lib/avatar': {},
      '../inventory/InventoryCostMeta': { inventoryCostMetaParts: () => [] },
      '../../lib/graphics/assets': { getIconPath: () => '' },
      '../../lib/hero/heroActionRange': { isHeroInteractionTargetReachable: () => reachable },
      '../../lib/hero/placeableInventoryItems': { getPlaceableInventoryBuildingType: () => null },
      '../../lib/lang': { t: key => key },
      '../inventory/InventoryItemIcons': { createInventoryEquipmentIcon: () => ({}) },
      '../inventory/InventoryActionRow': {
        createInventoryActionRow: (_, options) => {
          rows.push(options)
          return { element: {}, icon: { appendChild() {} } }
        },
      },
      '../equipment/equipmentLoot': {
        addHeroInventoryItem: (hero, item) => hero.inventory.equipment.push(item),
        removeHeroInventoryItem: () => false,
      },
    },
  })
  try {
    const hero = { type: 'Hero', inventory: { resources: { wood: 10, feather: 4, stone: 4 }, equipment: [] } }
    const menu = { context: { player: { age: 0 }, controls: { heroUnit: hero } }, showMessage() {}, updateTopbar() {} }
    const forge = { type: 'Forge', isBuilt: true }
    new HeroForgeBody(menu, forge)
    const arrows = rows.find(row => row.id === 'craft-arrow_ceramic')
    assert.equal(arrows.disabled, false)
    arrows.trailingAction.onClick()
    assert.equal(hero.inventory.equipment.length, 20)
    assert.deepEqual(hero.inventory.resources, { wood: 5, feather: 2, stone: 2 })
    for (const state of ['distant', 'unfinished', 'destroyed']) {
      reachable = state !== 'distant'
      forge.isBuilt = state !== 'unfinished'
      forge.isDestroyed = state === 'destroyed'
      arrows.trailingAction.onClick()
      assert.equal(hero.inventory.equipment.length, 20)
      assert.deepEqual(hero.inventory.resources, { wood: 5, feather: 2, stone: 2 })
    }
  } finally {
    global.document = previousDocument
  }
})

test('forge remains exterior and uses its atlas sprite across ages and civilizations', () => {
  const { isBuildingInteriorSupported } = loadTsModule('app/lib/buildings/interiors.ts')
  const { getBuildingAsset } = loadTsModule('app/lib/graphics/assets.ts')
  const fs = require('node:fs')
  const path = require('node:path')
  const directory = path.join(__dirname, '../public/assets/data/civilizations')
  assert.equal(isBuildingInteriorSupported({ type: 'Forge', isBuilt: true }), false)
  for (const filename of fs.readdirSync(directory).filter(name => name.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'))
    for (const age of [0, 1, 2]) {
      assert.deepEqual(getBuildingAsset('Forge', { age }, { cache: { get: () => data } }).images.final, {
        sheet: 'buildings/age-0',
        frame: 10,
      })
    }
  }
})
