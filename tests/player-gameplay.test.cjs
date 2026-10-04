const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { loadTsModule, requireFromTsFile } = require('./helpers/loadTsModule.cjs')

test('offscreen attack warnings only play for a chief hero and retain their cooldown', () => {
  const sounds = []
  const Player = loadPlayer({ playUiSound: cue => sounds.push(cue) })
  const previousDocument = global.document
  global.document = { visibilityState: 'hidden', hasFocus: () => false }
  try {
    const hero = { isChief: false }
    const player = {
      label: 'player',
      isPlayed: true,
      type: 'human',
      lastUnderAttackAlertAt: 0,
      context: { controls: { heroUnit: hero, instanceInCamera: () => false } },
    }
    const target = { owner: player }
    Player.prototype.reportThreat.call(player, target, {})
    assert.deepEqual(sounds, [])
    assert.equal(player.lastUnderAttackAlertAt, 0)
    hero.isChief = true
    Player.prototype.reportThreat.call(player, target, {})
    assert.deepEqual(sounds, ['attack-warning'])
    Player.prototype.reportThreat.call(player, target, {})
    assert.equal(sounds.length, 1)
  } finally {
    if (previousDocument === undefined) delete global.document
    else global.document = previousDocument
  }
})

function loadPlayer(overrides = {}) {
  const filename = path.join(__dirname, '../app/classes/players/Player.ts')
  const compileTs = tsFilename => {
    const source = fs.readFileSync(tsFilename, 'utf8')
    return babel.transformSync(source, {
      filename: tsFilename,
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        '@babel/preset-typescript',
      ],
    }).code
  }

  const moduleCache = new Map()
  const loadTsFile = tsFilename => {
    if (moduleCache.has(tsFilename)) return moduleCache.get(tsFilename).exports
    const loadedModule = { exports: {} }
    moduleCache.set(tsFilename, loadedModule)
    new Function('module', 'exports', 'require', compileTs(tsFilename))(
      loadedModule,
      loadedModule.exports,
      localRequire
    )
    return loadedModule.exports
  }
  const localRequire = request => {
    if (request === 'pixi.js') return { Assets: { cache: { get: () => ({}) } } }
    if (request === '../../lib') {
      return {
        canAfford: () => true,
        payCost: () => {},
        uuidv4: () => 'player-1',
        getHexColor: () => '#fff',
        updateObject: () => {},
        getActionCondition: () => true,
        canUpdateMinimap: () => false,
        isValidCondition: (condition, values) => {
          const expectedValue = values[condition.key]
          switch (condition.op) {
            case '>=':
              return expectedValue >= condition.value
            case 'includes':
              return expectedValue.includes(condition.value)
            default:
              throw new Error(`Unsupported op in test: ${condition.op}`)
          }
        },
        canPlaceBuildingAt: () => true,
        hasBuildingPlacementClearance: (grid, i, j, building, options = {}) =>
          (overrides.getBuildingFootprintCells ?? ((cellI, cellJ, cells) => [cells[cellI][cellJ]]))(
            i,
            j,
            grid,
            building.size
          ).every(cell => options.canUseCell?.(cell) !== false),
        playSoundCue: () => {},
        updateInstanceVisibility: () => {},
        isBuildingLimitReached: () => false,
        getBuildingFootprintCells: overrides.getBuildingFootprintCells ?? ((i, j, grid) => [grid[i][j]]),
      }
    }
    if (request === '../building/Building') {
      return {
        Building: class {
          constructor(options) {
            Object.assign(this, options)
          }
        },
      }
    }
    if (request === '../Resource') {
      return {
        Resource: class {
          constructor(options) {
            Object.assign(this, options)
          }
        },
      }
    }
    if (request === '../unit/Unit') {
      return {
        Unit: class {
          constructor(options) {
            Object.assign(this, options)
          }
        },
      }
    }
    if (request === '../../constants') {
      return {
        ACTION_TYPES: {},
        AGE_UP_ENABLED: false,
        AGE_TECHNOLOGIES: new Set(['ToolAge', 'BronzeAge', 'IronAge']),
        BUILDING_TYPES: { farm: 'Farm', townCenter: 'TownCenter' },
        FAMILY_TYPES: { player: 'player' },
        PLAYER_TYPES: { human: 'human', ai: 'ai', gaia: 'gaia', bandits: 'bandits' },
        RESOURCE_NAMES: [],
        RESOURCE_TYPES: { wheat: 'Wheat' },
        SOUND_CUES: {
          ui: { underAttack: 'attack-warning' },
          player: { ageAdvance: 'ageAdvance' },
          unit: { militaryCommand: 'militaryCommand' },
        },
        UNIT_TYPES: { villager: 'Villager' },
        FADE_DURATION_MS: 2000,
      }
    }
    if (request === '../../config/playerConfig') return { createPlayerData: () => ({}) }
    if (request === '../../config/name') return { getRandomUnitName: overrides.getRandomUnitName ?? (() => 'Unit') }
    if (request === '../../lib/entities/entityFade') return { fadeIn: overrides.fadeIn ?? (() => {}) }
    if (request === '../../lib/chief') {
      return {
        heroCanCommand: hero => Boolean(hero?.isChief),
        hasLivingChief: () => true,
        playerNeedsChiefForCommand: () => false,
      }
    }
    if (request === '../../lib/audio/uiSound') return { playUiSound: overrides.playUiSound ?? (() => {}) }
    if (request === '../../lib/lang') return { t: key => key }
    if (request === '../../services/visibility/VisionGrid') return { VisionGrid: class {} }
    if (request === '../../lib/buildings/walls') {
      return {
        refreshOwnerWalls: () => {},
        updateWallAndNeighbours: () => {},
      }
    }
    if (request === './PlayerUnitCreation')
      return loadTsFile(path.join(__dirname, '../app/classes/players/PlayerUnitCreation.ts'))
    if (request === './PlayerInitialization') {
      return loadTsFile(path.join(__dirname, '../app/classes/players/PlayerInitialization.ts'))
    }
    if (request === './PlayerBuildingPlacement') {
      return loadTsFile(path.join(__dirname, '../app/classes/players/PlayerBuildingPlacement.ts'))
    }
    if (request === './PlayerBuildingEligibility') {
      return loadTsFile(path.join(__dirname, '../app/classes/players/PlayerBuildingEligibility.ts'))
    }
    return requireFromTsFile(request, filename, {}, moduleCache)
  }

  return loadTsFile(filename).Player
}

test('unit creation passes unit gender to random civilization names', () => {
  const calls = []
  const Player = loadPlayer({
    getRandomUnitName: (civ, gender, random) => {
      calls.push({ civ, gender, sample: random() })
      return `${civ}-${gender}-unit`
    },
  })
  const player = {
    civ: 'Latium',
    gender: 'male',
    isPlayed: false,
    units: [],
    context: {
      map: {
        random: () => 0.25,
        addChild: unit => unit,
      },
      menu: {
        updatePlayerMiniMapEvt: () => {},
      },
      player: null,
    },
  }
  Object.setPrototypeOf(player, Player.prototype)

  const unit = player.createUnit({ type: 'Villager', gender: 'female' })

  assert.equal(unit.name, 'Latium-female-unit')
  assert.deepEqual(calls, [{ civ: 'Latium', gender: 'female', sample: 0.25 }])
  assert.equal(unit.gender, 'female')
  assert.equal(unit.appearanceVariants.gender, 'female')
  assert.equal(unit.assetCiv, 'Latium')

  const legacy = player.createUnit({
    type: 'Villager',
    gender: 'male',
    appearanceVariants: { gender: 'female' },
    assetCiv: 'Kemet',
  })
  assert.equal(legacy.name, 'Kemet-female-unit')
  assert.equal(legacy.gender, 'female')
  assert.equal(legacy.appearanceVariants.gender, 'female')
})

test('population counts living villagers without age objectives', () => {
  const Player = loadPlayer()
  const player = { units: [{ type: 'Villager' }, { type: 'Villager', isDead: true }, { type: 'Hero' }] }
  Object.setPrototypeOf(player, Player.prototype)
  assert.equal(player.villagerPopulation, 1)
  assert.equal(player.updatePopulationObjectives, undefined)
})

test('building prerequisites require the configured prerequisite building', () => {
  const Player = loadPlayer()
  const player = {
    age: 1,
    hasBuilt: [],
    config: {
      buildings: {
        ArcheryRange: {
          conditions: [{ key: 'hasBuilt', op: 'includes', value: 'Barracks' }],
        },
      },
    },
  }

  Object.setPrototypeOf(player, Player.prototype)

  assert.equal(player.isBuildingEligible('ArcheryRange'), false)
})

test('neutral Gaia owner is never considered an enemy relation', () => {
  const Player = loadPlayer()
  const player = {
    label: 'player',
    team: null,
    diplomacy: null,
    factionId: null,
    context: {},
  }
  const neutral = {
    label: 'neutral',
    type: 'Gaia',
    diplomacy: 'neutral',
    team: null,
    factionId: null,
  }
  Object.setPrototypeOf(player, Player.prototype)

  assert.equal(player.isEnemy(neutral), false)
})

test('village defenders can attack bandits regardless of their campaign relation with the hero', () => {
  const Player = loadPlayer()
  const { PLAYER_TYPES, FAMILY_TYPES, UNIT_TYPES } = loadTsModule('app/constants/index.ts')
  const { getActionCondition } = loadTsModule('app/lib/combat/combatActionConditions.ts', {
    mocks: { '../equipment/equipmentStats': { getEntityWeaponPower: () => 10 } },
  })
  for (const relationState of ['neutral', 'friendly', 'hostile']) {
    const context = { getCampaignFactions: () => ({ village: { relationState } }) }
    const village = Object.assign(Object.create(Player.prototype), {
      label: 'village',
      type: PLAYER_TYPES.ai,
      factionId: 'village',
      context,
      team: null,
    })
    const heroOwner = Object.assign(Object.create(Player.prototype), {
      label: 'hero',
      type: PLAYER_TYPES.human,
      context,
      team: null,
    })
    for (const patch of [
      { type: PLAYER_TYPES.bandits },
      { banditCampOwner: true },
      { banditRaidOwner: true, diplomacy: 'neutral' },
      { devConsoleBanditOwner: true },
    ]) {
      const owner = Object.assign(Object.create(Player.prototype), {
        label: 'bandits',
        type: PLAYER_TYPES.ai,
        context,
        team: null,
        ...patch,
      })
      assert.equal(village.isEnemy(owner), true)
      assert.equal(owner.isEnemy(village), true)
      assert.equal(owner.isEnemy(owner), false)
      assert.equal(owner.isEnemy({ label: 'gaia', type: PLAYER_TYPES.gaia, diplomacy: 'neutral' }), false)
      const bandit = { owner, family: FAMILY_TYPES.unit, type: UNIT_TYPES.banditSword, hitPoints: 50 }
      for (const family of [FAMILY_TYPES.unit, FAMILY_TYPES.building]) {
        const defender = { owner: village, family, hitPoints: 100 }
        assert.equal(getActionCondition(defender, bandit, 'attack'), true)
        assert.equal(
          getActionCondition(defender, { ...bandit, owner: heroOwner }, 'attack'),
          relationState === 'hostile'
        )
      }
    }
    assert.equal(village.isEnemy(heroOwner), relationState === 'hostile')
    assert.equal(heroOwner.isEnemy(village), relationState === 'hostile')
  }
})

test('placing a wheat parcel creates pending seed sites without unlocking the sowing objective', () => {
  const updated = []
  const faded = []
  const randomValues = [0, 0.25, 0.75, 1]
  const sites = []
  const grid = Array.from({ length: 2 }, (_, i) =>
    Array.from({ length: 2 }, (_, j) => ({
      i,
      j,
      updateVisible() {
        updated.push(`${i},${j}`)
      },
    }))
  )
  const Player = loadPlayer({
    fadeIn: resource => faded.push(`${resource.i},${resource.j}`),
    getBuildingFootprintCells: () => [grid[0][0], grid[0][1], grid[1][0], grid[1][1]],
  })
  const player = {
    spawnBuilding: options => sites.push(options),
    isPlayed: true,
    config: {
      buildings: {
        Farm: {
          size: 2,
          cost: { wood: 75 },
        },
      },
    },
    context: {
      map: {
        grid,
        resources: new Set(),
        addChild: resource => resource,
        random: () => randomValues.shift() ?? 0,
      },
      menu: {
        updateTopbar: () => {},
        updateResourcesMiniMap: () => {},
      },
    },
    foundedWheats: new Set(),
    foundedResources: { Wheat: new Set() },
  }
  Object.setPrototypeOf(player, Player.prototype)

  assert.equal(player.plantWheatField(0, 0), true)
  assert.equal(player.completedObjectives, undefined)
  assert.equal(sites.length, 4)
  assert.ok(sites.every(site => !site.isBuilt && site.constructionMaterials.cost.wheat === 1))
  assert.equal(player.context.map.resources.size, 0)
})

test('missing building definitions reject purchases and wheat fields before any payment or spawn', () => {
  const Player = loadPlayer()
  const player = {
    config: { buildings: {} },
    context: { map: { grid: [[]] }, menu: {} },
    spawnBuilding: () => assert.fail('must not spawn an unknown building'),
  }
  Object.setPrototypeOf(player, Player.prototype)
  assert.equal(player.buyBuilding(0, 0, 'Unknown'), false)
  assert.equal(player.buyBuilding(0, 0, 'Farm'), false)
  assert.equal(player.plantWheatField(0, 0), false)
})

test('placing a town center creates a construction site without ordering inspected units', () => {
  const Player = loadPlayer()
  const messages = []
  const player = {
    age: 0,
    buildings: [],
    completedObjectives: [],
    config: { buildings: { TownCenter: { cost: {}, size: 3 } }, units: { Villager: { sounds: {} } } },
    context: {
      controls: { heroUnit: { type: 'Hero', isChief: true } },
      map: {
        grid: [[{ i: 0, j: 0 }]],
        addChild: child => child,
      },
      menu: {
        showMessage: (message, type) => messages.push([message, type]),
        updateActionTarget: () => messages.push(['action-target']),
        updateTopbar: () => messages.push(['topbar']),
        syncObjectiveProgress: () => messages.push(['objective-progress']),
        isMiniMapActive: () => false,
      },
      player: null,
    },
    isPlayed: true,
    hasBuilt: [],
    units: [],
    selectedUnits: [{ type: 'Hero', sendTo: target => messages.push(['hero-build-order', target.type]) }],
    populationMax: 0,
    isBuildingEligible: () => true,
    updatePopulationObjectives() {},
  }
  player.context.player = player
  Object.setPrototypeOf(player, Player.prototype)

  assert.equal(player.buyBuilding(0, 0, 'TownCenter'), true)
  assert.equal(player.completedObjectives.includes('buildTownCenter'), false)
  assert.equal(
    messages.some(message => message[0] === 'hero-build-order'),
    false
  )
  player.buildings[0].isBuilt = true
  assert.deepEqual(player.completedObjectives, [])
  assert.equal(
    messages.some(message => String(message[0]).includes('Objectif accompli')),
    false
  )
})

test('player initialization normalizes relations and retains restored resource overrides', () => {
  const Player = loadPlayer()
  for (const [team, expected] of [
    [undefined, null],
    ['', null],
    ['invalid', null],
    ['2', 2],
    [0, 0],
  ]) {
    const player = new Player(
      { team, diplomacy: 'neutral', factionId: 'Hellas', herb: 8 },
      {
        map: { startingResources: { herb: 3, sinew: 7 }, size: 1 },
        menu: {},
      }
    )
    assert.equal(player.team, expected)
    assert.equal(player.diplomacy, 'neutral')
    assert.equal(player.factionId, 'Hellas')
    assert.equal(player.herb, 8)
    assert.equal(player.sinew, 7)
  }
  const player = new Player(
    { diplomacy: 'invalid', factionId: 3 },
    {
      map: { startingResources: {}, size: 1 },
      menu: {},
    }
  )
  assert.equal(player.diplomacy, null)
  assert.equal(player.factionId, null)
})

test('restored AI uses campaign faction color while human, neutral and bandit colors remain their own', () => {
  const Player = loadPlayer()
  const context = {
    map: { startingResources: {}, size: 1 },
    menu: {},
    getCampaignFactions: () => ({ 'civ-hellas': { id: 'civ-hellas', color: 'green' } }),
  }
  for (const [type, color, expected] of [
    ['ai', 'grey', 'green'],
    ['ai', 'red', 'green'],
    ['human', 'red', 'red'],
    ['gaia', 'grey', 'grey'],
    ['bandits', 'black', 'black'],
  ]) {
    const player = new Player({ type, civ: 'Hellas', color }, context)
    assert.equal(player.color, expected)
  }
})

test('placing a building returns it without issuing orders to inspected units', () => {
  const Player = loadPlayer()
  const building = { type: 'House' }
  const inspected = {
    type: 'Villager',
    sendToBuilding: () => assert.fail('inspection must not assign construction work'),
    sendTo: () => assert.fail('inspection must not issue movement orders'),
  }
  const player = { isPlayed: true, selectedUnits: [inspected], createBuilding: () => building }
  Object.setPrototypeOf(player, Player.prototype)
  assert.equal(player.spawnBuilding({ type: 'House', i: 1, j: 1 }), building)
})
