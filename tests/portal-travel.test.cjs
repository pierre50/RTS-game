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
      '../../config/civilizations': { CIVILIZATIONS: [{ value: 'Greek' }, { value: 'Roman' }, { value: 'Egyptian' }] },
      '../../config/environments': { getEnvironmentForCiv: () => 'Temperate' },
      '../../config/mapTypes': { DEFAULT_MAP_TYPE: 'continent' },
      '../../constants': constants,
      '../../lib': { playerColors: ['blue', 'red'] },
      '../../lib/combat/factions': {
        createFactionSave: ({ civilization, homeWorldId, id, initialScore, name, now }) => ({
          civilization,
          discoveredAt: now,
          homeWorldId,
          id,
          knownWorldIds: [homeWorldId],
          name: name || 'Faction',
          relationScore: initialScore,
          relationState: initialScore < 0 ? 'hostile' : 'neutral',
          updatedAt: now,
        }),
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
      '../../config/civilizations': { CIVILIZATIONS: [{ value: 'Greek' }, { value: 'Roman' }, { value: 'Egyptian' }] },
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
        createFactionSave: ({ civilization, homeWorldId, id, initialScore, name, now }) => ({
          civilization,
          discoveredAt: now,
          homeWorldId,
          id,
          knownWorldIds: [homeWorldId],
          name: name || 'Faction',
          relationScore: initialScore,
          relationState: initialScore < 0 ? 'hostile' : 'neutral',
          updatedAt: now,
        }),
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
  assert.equal(yellow.config.players[1].factionId, 'bandits')
  assert.equal(yellow.config.players[1].name, 'Bandits')
  assert.equal(yellow.faction.relationState, 'hostile')

  assert.equal(blue.config.portalEncounter, 'village')

  assert.equal(red.config.portalEncounter, 'village')
})

test('campaign roster creates one global faction per non-hero civilization plus bandits', () => {
  const { ensureCampaignPlayerRoster } = loadGameStateHelpers()
  const campaign = {
    currentWorldId: 'root',
    factions: {},
    worlds: {
      root: {
        state: {
          players: [{ civ: 'Greek', color: 'green', isPlayed: true }],
        },
      },
    },
    worldGraph: { rootWorldId: 'root', nodes: {} },
  }

  const next = ensureCampaignPlayerRoster(campaign, 1000)

  assert.equal(next.factions['civ-greek'], undefined)
  assert.equal(next.factions['civ-roman'].civilization, 'Roman')
  assert.equal(next.factions['civ-roman'].relationState, 'neutral')
  assert.notEqual(next.factions['civ-roman'].color, 'green')
  assert.notEqual(next.factions['civ-roman'].color, 'grey')
  assert.equal(next.factions['civ-egyptian'].civilization, 'Egyptian')
  assert.equal(next.factions['civ-egyptian'].relationState, 'hostile')
  assert.notEqual(next.factions['civ-egyptian'].color, 'green')
  assert.notEqual(next.factions['civ-egyptian'].color, 'grey')
  assert.notEqual(next.factions['civ-roman'].color, next.factions['civ-egyptian'].color)
  assert.equal(next.factions.bandits.name, 'Bandits')
  assert.equal(next.factions.bandits.relationState, 'hostile')
  assert.equal(next.factions.bandits.color, 'grey')
  assert.deepEqual(next.factions['civ-roman'].knownWorldIds, [])
})

test('portal config reuses an undiscovered campaign roster faction', () => {
  const { ensureCampaignPlayerRoster, configForPortalWorld } = loadGameStateHelpers()
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
  const player = { civ: 'Greek', color: 'green', factionId: 'human-faction', gender: 'female', name: 'Hero', team: 7 }
  const campaign = ensureCampaignPlayerRoster(
    {
      currentWorldId: 'root',
      factions: {},
      worlds: {
        root: {
          state: {
            players: [{ civ: 'Greek', isPlayed: true }],
          },
        },
      },
      worldGraph: { rootWorldId: 'root', nodes: {} },
    },
    1000
  )

  const portalWorld = configForPortalWorld({ campaign, color: 'blue', map, now: 2000, player, worldId: 'egyptian-world' })

  assert.equal(portalWorld.factionId, 'civ-egyptian')
  assert.equal(portalWorld.config.players[1].civ, 'Egyptian')
  assert.equal(portalWorld.config.players[1].color, portalWorld.faction.color)
  assert.deepEqual(portalWorld.faction.knownWorldIds, ['egyptian-world'])
  assert.equal(portalWorld.faction.relationState, 'hostile')
  assert.equal(portalWorld.config.players[1].diplomacy, null)
})

test('portal config keeps neutral relation from the global roster', () => {
  const { ensureCampaignPlayerRoster, configForPortalWorld } = loadGameStateHelpers()
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
  const player = { civ: 'Greek', color: 'green', factionId: 'human-faction', gender: 'female', name: 'Hero', team: 7 }
  const campaign = ensureCampaignPlayerRoster(
    {
      currentWorldId: 'root',
      factions: {},
      worlds: {
        root: {
          state: {
            players: [{ civ: 'Greek', isPlayed: true }],
          },
        },
      },
      worldGraph: { rootWorldId: 'root', nodes: {} },
    },
    1000
  )

  const portalWorld = configForPortalWorld({ campaign, color: 'red', map, now: 2000, player, worldId: 'roman-world' })

  assert.equal(portalWorld.factionId, 'civ-roman')
  assert.equal(portalWorld.faction.relationState, 'neutral')
  assert.equal(portalWorld.config.players[1].color, portalWorld.faction.color)
  assert.equal(portalWorld.config.players[1].diplomacy, 'neutral')
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
