const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const constants = {
  CELL_HEIGHT: 32,
  CELL_WIDTH: 64,
  ENVIRONMENT_IDS: ['Temperate', 'Desert'],
}

function loadGameStateHelpers() {
  return loadTsModule('app/screens/game/GameStateHelpers.ts', {
    mocks: {
      '../../config/civilizations': { CIVILIZATIONS: [{ value: 'Greek' }] },
      '../../config/environments': { getEnvironmentForCiv: () => 'Temperate' },
      '../../config/mapTypes': { DEFAULT_MAP_TYPE: 'continent' },
      '../../constants': constants,
      '../../lib': { colors: ['blue', 'red'] },
      '../../lib/combat/factions': {
        createFactionSave: ({ id }) => ({ id, name: 'Faction' }),
        FACTION_SCORE: { allied: 1, hostile: -1, neutral: 0 },
      },
    },
  })
}

function loadGamePortalTravel() {
  return loadTsModule('app/screens/game/GamePortalTravel.ts', {
    mocks: {
      '../../lib': {
        getFreeLandCellAroundInstance: () => null,
        getReliefOffset: () => 0,
        teleportRuntimeUnitToCell: () => {},
        updateInstanceVisibility: () => {},
      },
      '../../lib/equipment/equipmentStats': { refreshUnitEquipmentStats: () => {} },
      '../../serialization/CampaignSave': {
        addChildWorldToCampaign: () => ({}),
        createInitialCampaignSave: () => ({}),
        enterCampaignWorld: () => ({}),
        getCurrentWorldState: () => ({}),
        returnToParentWorld: () => ({}),
        updateCurrentWorldState: () => ({}),
      },
      '../../serialization/SaveSerializer': { serializeGame: () => ({ players: [] }) },
      '../../ui/PortalTravelTransition': {
        PortalTravelTransition: class {},
      },
      '../../config/civilizations': { CIVILIZATIONS: [{ value: 'Greek' }] },
      '../../config/environments': { getEnvironmentForCiv: () => 'Temperate' },
      '../../config/mapTypes': { DEFAULT_MAP_TYPE: 'continent' },
      '../../constants': constants,
      '../../lib': {
        colors: ['blue', 'red'],
        getFreeLandCellAroundInstance: () => null,
        getReliefOffset: () => 0,
        teleportRuntimeUnitToCell: () => {},
        updateInstanceVisibility: () => {},
      },
      '../../lib/combat/factions': {
        createFactionSave: ({ id }) => ({ id, name: 'Faction' }),
        FACTION_SCORE: { allied: 1, hostile: -1, neutral: 0 },
      },
    },
  })
}

test('portal travel sprite sources include customized hero hair', () => {
  const { heroTravelSpriteSources } = loadGameStateHelpers()

  const sources = heroTravelSpriteSources({
    civ: 'Nordic',
    gender: 'female',
    heroAppearance: { hairStyle: 'wavy', hairColor: 'blond' },
  })

  assert.equal(sources.body, 'assets/graphics/lpc-baked/hero/nordic/female/texture.png')
  assert.equal(sources.bodyAtlas, 'assets/graphics/lpc-baked/hero/nordic/female/texture.json')
  assert.equal(sources.hairFront, 'assets/graphics/lpc-hero/hair/wavy/female/texture.png')
  assert.equal(sources.hairFrontAtlas, 'assets/graphics/lpc-hero/hair/wavy/female/texture.json')
  assert.equal(sources.hairColor, 'blond')
  assert.equal(sources.hairBack, null)
  assert.equal(sources.hairBackAtlas, null)
})

test('applying a portal party restores the selected hero tool after controls init', () => {
  const { applyPortalPartyToRuntime } = loadGamePortalTravel()
  const hero = {
    controlMode: 'hero',
    currentCell: null,
    inventory: { activeWeapons: { melee: 'sword_ceramic' }, equipped: {} },
    isDestroyed: false,
    type: 'Hero',
    visibleCells: new Set(),
  }
  const calls = []
  const game = {
    _gameContext() {
      return {
        controls: {
          context: { menu: { updateHeroStatus: () => {}, updatePlayerMiniMapEvt: () => {} } },
          init: () => calls.push(['init']),
          setEquippedItem: item => calls.push(['setEquippedItem', item]),
        },
        map: { revealEverything: true },
        menu: {},
        player: {
          units: [hero],
          views: { removeViewerEverywhere: () => [], coordinates: () => [0, 0] },
        },
      }
    },
  }

  applyPortalPartyToRuntime(game, { hero: null, followers: [] }, null, { equippedItem: 'sword' })

  assert.deepEqual(calls, [['init'], ['setEquippedItem', 'sword']])
})
