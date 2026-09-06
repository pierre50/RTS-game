const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadHeroMarketBody() {
  return loadTsModule('app/ui/hero-building/HeroMarketBody.ts', {
    mocks: {
      '../../constants': {
        RESOURCE_ICON_IDS: {},
        RESOURCE_STORAGE_NAMES: ['wood', 'berry', 'meat', 'wheat', 'stone', 'gold', 'copper', 'iron'],
      },
      '../../lib': { getIconPath: value => value },
      '../../lib/equipment/equipmentLoot': {
        formatEquipmentStackLabel: equipment => equipment,
        getEquipmentStacks: () => [],
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
      '../equipment/EquipmentAvatar': { renderEquipmentAvatarLazy: () => {} },
      '../inventory/InventorySlotRenderer': {
        createInventorySection: () => ({ tagName: 'section' }),
        createInventorySlot: () => ({ appendChild() {} }),
      },
      '../inventory/InventoryTooltips': {
        createEquipmentTooltip: equipment => ({ title: equipment }),
        createResourceTooltip: resource => ({ title: resource }),
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
    assert.notEqual(createHeroMarketBody({ owner: heroOwner }, menu, () => {}), null)
    assert.notEqual(createHeroMarketBody({ owner: { label: 'ally', team: 1 } }, menu, () => {}), null)
    assert.notEqual(createHeroMarketBody({ owner: { label: 'neutral', factionId: 'tribe' } }, menu, () => {}), null)

    hero.context.getCampaignFactions = () => ({ tribe: { relationState: 'friendly' } })
    assert.notEqual(createHeroMarketBody({ owner: { label: 'friendly', factionId: 'tribe' } }, menu, () => {}), null)

    hero.context.getCampaignFactions = () => ({ tribe: { relationState: 'allied' } })
    assert.notEqual(createHeroMarketBody({ owner: { label: 'allied', factionId: 'tribe' } }, menu, () => {}), null)
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

  assert.equal(createHeroMarketBody({ owner: { label: 'enemy', relation: 'enemy' } }, menu, () => {}), null)
  assert.equal(createHeroMarketBody({ owner: { label: 'hostile', factionId: 'tribe' } }, menu, () => {}), null)

  hero.context.getCampaignFactions = () => ({ tribe: { relationState: 'wary' } })
  assert.equal(createHeroMarketBody({ owner: { label: 'wary', factionId: 'tribe' } }, menu, () => {}), null)
})
