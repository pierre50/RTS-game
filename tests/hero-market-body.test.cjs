const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadHeroMarketBody(overrides = {}) {
  return loadTsModule('app/ui/hero-building/HeroMarketBody.ts', {
    mocks: {
      '../../constants': {
        RESOURCE_ICON_IDS: {},
        RESOURCE_STORAGE_NAMES: ['wood', 'berry', 'meat', 'wheat', 'stone', 'gold', 'copper', 'iron'],
      },
      '../../lib': { getIconPath: value => value },
      '../../lib/equipment/equipmentLoot': {
        formatEquipmentLootLabel: equipment => equipment,
        formatEquipmentStackLabel: equipment => equipment,
        getEquipmentSlot: () => null,
        getEquipmentStacks: () => [],
        getWeaponSlot: () => null,
      },
      '../../lib/equipment/equipmentMarket': {
        buyMarketEquipment: () => false,
        ensureMarketEquipmentStock: () => [],
        getEquipmentGoldValue: () => 0,
        getHeroGold: hero => hero?.inventory?.resources?.gold ?? 0,
        getMarketEquipmentOffers: () => [],
        getResourceGoldValue: () => 0,
        sellHeroEquipment: () => 0,
        sellHeroResource: () => 0,
      },
      '../../lib/lang': { t: key => key },
      '../inventory/InventoryActionRow': {
        createInventoryActionRow: () => ({
          element: { appendChild() {}, setAttribute() {} },
          icon: { appendChild() {} },
        }),
      },
      '../inventory/InventoryItemRows': {
        createInventoryEquipmentRow: () => ({
          element: { appendChild() {}, setAttribute() {} },
          icon: { appendChild() {} },
        }),
        createInventoryResourceRow: () => ({
          element: { appendChild() {}, setAttribute() {} },
          icon: { appendChild() {} },
        }),
      },
      '../inventory/InventoryItemIcons': {
        createInventoryEquipmentIcon: () => ({}),
        createInventoryResourceIcon: () => ({}),
      },
      '../inventory/InventorySection': {
        createInventorySection: () => ({ tagName: 'section' }),
      },
      ...overrides,
      '../inventory/InventoryDetails': {
        createEquipmentRowInfo: equipment => ({
          title: equipment,
          description: '',
          meta: '',
        }),
        createResourceRowInfo: resource => ({
          title: resource,
          description: '',
          meta: '',
        }),
        formatGold: value => `${value} gold`,
      },
    },
  })
}

function installMockDocument() {
  const previousDocument = global.document
  global.document = {
    createElement(tagName) {
      return {
        tagName,
        children: [],
        className: '',
        dataset: {},
        textContent: '',
        appendChild(child) {
          this.children.push(child)
          return child
        },
      }
    },
  }
  return () => {
    global.document = previousDocument
  }
}

test('hero market allows own, allied, neutral and friendly markets', () => {
  const { createHeroMarketBody } = loadHeroMarketBody()
  const restoreDocument = installMockDocument()
  const heroOwner = {
    label: 'player',
    isEnemy: owner => owner?.relation === 'enemy',
  }
  const hero = { owner: heroOwner, context: { getCampaignFactions: () => ({ tribe: { relationState: 'neutral' } }) } }
  const menu = { context: { app: {}, controls: { heroUnit: hero } }, playUiClick() {} }

  try {
    assert.notEqual(
      createHeroMarketBody({ owner: heroOwner }, menu, () => {}),
      null
    )
    assert.notEqual(
      createHeroMarketBody({ owner: { label: 'ally', team: 1 } }, menu, () => {}),
      null
    )
    assert.notEqual(
      createHeroMarketBody({ owner: { label: 'neutral', factionId: 'tribe' } }, menu, () => {}),
      null
    )

    hero.context.getCampaignFactions = () => ({ tribe: { relationState: 'friendly' } })
    assert.notEqual(
      createHeroMarketBody({ owner: { label: 'friendly', factionId: 'tribe' } }, menu, () => {}),
      null
    )

    hero.context.getCampaignFactions = () => ({ tribe: { relationState: 'allied' } })
    assert.notEqual(
      createHeroMarketBody({ owner: { label: 'allied', factionId: 'tribe' } }, menu, () => {}),
      null
    )
  } finally {
    restoreDocument()
  }
})

test('hero market blocks hostile, wary and enemy markets', () => {
  const { createHeroMarketBody } = loadHeroMarketBody()
  const heroOwner = {
    label: 'player',
    isEnemy: owner => owner?.relation === 'enemy',
  }
  const hero = { owner: heroOwner, context: { getCampaignFactions: () => ({ tribe: { relationState: 'hostile' } }) } }
  const menu = { context: { app: {}, controls: { heroUnit: hero } }, playUiClick() {} }

  assert.equal(
    createHeroMarketBody({ owner: { label: 'enemy', relation: 'enemy' } }, menu, () => {}),
    null
  )
  assert.equal(
    createHeroMarketBody({ owner: { label: 'hostile', factionId: 'tribe' } }, menu, () => {}),
    null
  )

  hero.context.getCampaignFactions = () => ({ tribe: { relationState: 'wary' } })
  assert.equal(
    createHeroMarketBody({ owner: { label: 'wary', factionId: 'tribe' } }, menu, () => {}),
    null
  )
})


test('market tiles show unit transaction prices and lot totals, with unaffordable purchases marked', () => {
  const rows = []
  const makeRow = options => {
    rows.push(options)
    return { element: { setAttribute() {} } }
  }
  const { createHeroMarketBody } = loadHeroMarketBody({
    '../../lib/lang': { t: (key, params) => `${key}:${params?.gold ?? ''}` },
    '../../lib/equipment/equipmentLoot': {
      formatEquipmentStackLabel: item => item,
      getEquipmentStacks: () => [{ equipment: 'sword', count: 2 }],
    },
    '../../lib/equipment/equipmentMarket': {
      getHeroGold: hero => hero.inventory.resources.gold,
      ensureMarketEquipmentStock: () => [],
      getMarketEquipmentOffers: () => [{ equipment: 'sword', count: 3, goldValue: 20 }],
      getEquipmentResaleGoldValue: () => 8,
      getResourceGoldValue: () => 2,
    },
    '../inventory/InventoryItemRows': {
      createInventoryEquipmentRow: (_context, _menu, options) => makeRow(options),
      createInventoryResourceRow: (_menu, options) => makeRow(options),
    },
    '../inventory/InventorySection': {
      createInventorySection: options => {
        options.renderItems({ appendChild() {} })
        return {}
      },
    },
  })
  const restore = installMockDocument()
  const owner = { label: 'player' }
  const hero = { owner, inventory: { resources: { gold: 19, wood: 5 }, equipment: [] } }
  const menu = { context: { controls: { heroUnit: hero } } }
  try {
    createHeroMarketBody({ owner }, menu, () => {})
    assert.deepEqual(rows.map(row => row.value), [
      '20 gold', '2 gold', '8 gold',
    ])
    assert.deepEqual(rows.map(row => row.metaParts[0].text), [
      'marketLotTotal:60 gold', 'marketLotTotal:10 gold', 'marketLotTotal:16 gold',
    ])
    assert.equal(rows[0].disabled, true)
    assert.equal(rows[0].metaParts[0].className, 'inventory-cost-is-missing')
    hero.inventory.resources.gold = 20
    rows.length = 0
    createHeroMarketBody({ owner }, menu, () => {})
    assert.equal(rows[0].disabled, false)
    assert.equal(rows[0].metaParts[0].className, '')
  } finally {
    restore()
  }
})
