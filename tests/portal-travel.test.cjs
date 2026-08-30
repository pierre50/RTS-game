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
      '../../lib': { playerColors: ['blue', 'red'] },
      '../../lib/combat/factions': {
        createFactionSave: ({ id, initialScore }) => ({ id, name: 'Faction', relationScore: initialScore }),
        FACTION_SCORE: { allied: 1, hostile: -1, neutral: 0 },
      },
    },
  })
}

function loadGamePortalTravel(overrides = {}) {
  return loadTsModule('app/screens/game/GamePortalTravel.ts', {
    mocks: {
      '../../lib': {
        getFreeLandCellAroundInstance: overrides.getFreeLandCellAroundInstance ?? (() => null),
        getReliefOffset: () => 0,
        teleportRuntimeUnitToCell: () => {},
        updateInstanceVisibility: () => {},
      },
      '../../lib/buildings/passageCells': {
        createNonReservedPassageCellCondition: () => () => true,
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
        playerColors: ['blue', 'red'],
        getFreeLandCellAroundInstance: overrides.getFreeLandCellAroundInstance ?? (() => null),
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

test('portal colors select debug encounter destinations', () => {
  const { configForPortalWorld } = loadGameStateHelpers()
  const map = {
    allTechnologies: false,
    difficulty: 'normal',
    environment: 'Temperate',
    instantMode: false,
    mapType: 'continent',
    random: () => 0.5,
    revealTerrain: false,
    size: 144,
    startingAge: 1,
    startingResources: { food: 100, wood: 100, stone: 0, gold: 0 },
    resourceDensity: 'normal',
  }
  const player = {
    civ: 'Greek',
    color: 'green',
    factionId: 'human-faction',
    gender: 'female',
    name: 'Hero',
    team: 7,
  }

  const yellow = configForPortalWorld({ color: 'yellow', map, now: 1000, player, worldId: 'yellow-world' })
  const blue = configForPortalWorld({ color: 'blue', map, now: 1000, player, worldId: 'blue-world' })
  const red = configForPortalWorld({ color: 'red', map, now: 1000, player, worldId: 'red-world' })

  assert.equal(yellow.config.portalEncounter, 'bandit')
  assert.equal(yellow.config.players[1].diplomacy, null)
  assert.equal(yellow.faction.relationScore, -1)

  assert.equal(blue.config.portalEncounter, 'village')
  assert.equal(blue.config.players[1].diplomacy, 'neutral')
  assert.equal(blue.faction.relationScore, 0)

  assert.equal(red.config.portalEncounter, 'village')
  assert.equal(red.config.players[1].diplomacy, null)
  assert.equal(red.faction.relationScore, -1)
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

test('portal follower spawn preserves gendered appearance before initialization', () => {
  const { applyPortalPartyToRuntime } = loadGamePortalTravel({
    getFreeLandCellAroundInstance: () => ({ i: 4, j: 5 }),
  })
  const hero = {
    controlMode: 'hero',
    currentCell: null,
    inventory: { equipped: {} },
    isDestroyed: false,
    type: 'Hero',
    visibleCells: new Set(),
  }
  const created = []
  const game = {
    _gameContext() {
      return {
        controls: {
          context: { menu: { updateHeroStatus: () => {}, updatePlayerMiniMapEvt: () => {} } },
          init: () => {},
        },
        map: { revealEverything: true },
        menu: {},
        player: {
          createUnit(options) {
            created.push(options)
            return { ...options, currentCell: null, visibleCells: new Set() }
          },
          units: [hero],
          views: { removeViewerEverywhere: () => [], coordinates: () => [0, 0] },
        },
      }
    },
  }

  applyPortalPartyToRuntime(game, {
    hero: null,
    followers: [
      {
        i: 1,
        j: 1,
        label: 'follower-1',
        type: 'Villager',
        name: 'Livia',
        gender: 'female',
        appearanceVariants: { gender: 'female' },
      },
    ],
  })

  assert.equal(created[0].gender, 'female')
  assert.deepEqual(created[0].appearanceVariants, { gender: 'female' })
  assert.equal(created[0].label, 'follower-1')
})
