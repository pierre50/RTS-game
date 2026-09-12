const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

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
        drawInstanceBlinkingSelection: () => {},
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
        capitalizeFirstLetter: value => value.charAt(0).toUpperCase() + value.slice(1),
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
        AGE_GATE_MAX_UNLOCKABLE_VALUE: 1,
        AGE_UP_ENABLED: false,
        AGE_TECHNOLOGIES: new Set(['ToolAge', 'BronzeAge', 'IronAge']),
        BUILDING_TYPES: { farm: 'Farm', townCenter: 'TownCenter' },
        FAMILY_TYPES: { player: 'player' },
        PLAYER_TYPES: { human: 'human', ai: 'ai', gaia: 'gaia', bandits: 'bandits' },
        POPULATION_MAX: 200,
        RESOURCE_NAMES: [],
        RESOURCE_TYPES: { wheat: 'Wheat' },
        SOUND_CUES: { player: { ageAdvance: 'ageAdvance' }, unit: { militaryCommand: 'militaryCommand' } },
        UNIT_TYPES: { villager: 'Villager' },
        FADE_DURATION_MS: 2000,
      }
    }
    if (request === '../../config/playerConfig') return { createPlayerData: () => ({}) }
    if (request === '../../config/name') return { getRandomUnitName: overrides.getRandomUnitName ?? (() => 'Unit') }
    if (request === '../../lib/entities/entityFade') return { fadeIn: overrides.fadeIn ?? (() => {}) }
    if (request === '../../lib/chief') {
      return {
        hasLivingChief: () => true,
        playerNeedsChiefForCommand: () => false,
      }
    }
    if (request === '../../lib/audio/uiSound') return { playUiSound: () => {} }
    if (request === '../../lib/lang') return { t: key => key }
    if (request === '../../services/VisionGrid') return { VisionGrid: class {} }
    if (request === '../../lib/buildings/walls') {
      return {
        refreshOwnerWalls: () => {},
        updateWallAndNeighbours: () => {},
      }
    }
    if (request === './PlayerInitialization') {
      return loadTsFile(path.join(__dirname, '../app/classes/players/PlayerInitialization.ts'))
    }
    if (request === './PlayerBuildingPlacement') {
      return loadTsFile(path.join(__dirname, '../app/classes/players/PlayerBuildingPlacement.ts'))
    }
    if (request === './PlayerProgression') {
      return loadTsFile(path.join(__dirname, '../app/classes/players/PlayerProgression.ts'))
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
    type: 'Villager', gender: 'male', appearanceVariants: { gender: 'female' }, assetCiv: 'Kemet',
  })
  assert.equal(legacy.name, 'Kemet-female-unit')
  assert.equal(legacy.gender, 'female')
  assert.equal(legacy.appearanceVariants.gender, 'female')
})

test('population objectives follow living villagers without granting technologies', () => {
  const Player = loadPlayer()
  const messages = []
  const player = {
    age: 0,
    technologies: [],
    completedObjectives: [],
    techs: {
      Village: {
        key: 'technologies',
        conditions: [{ key: 'villagerPopulation', op: '>=', value: 20 }],
      },
    },
    units: Array.from({ length: 20 }, (_, index) => ({
      type: 'Villager',
      isDead: index === 3,
      isDestroyed: false,
    })),
    buildings: [],
    context: {
      menu: {
        showMessage: (message, type) => messages.push([message, type]),
        updateActionTarget: () => messages.push(['action-target']),
        updateTopbar: () => messages.push(['topbar']),
        syncObjectiveProgress: () => messages.push(['tech-progress']),
      },
    },
    isPlayed: true,
    updateConfig: () => {},
  }
  Object.setPrototypeOf(player, Player.prototype)

  assert.equal(player.villagerPopulation, 19)
  assert.equal(player.updatePopulationObjectives(), undefined)
  player.units[3].isDead = false

  assert.equal(player.villagerPopulation, 20)
  assert.equal(player.updatePopulationObjectives(), undefined)
  assert.deepEqual(player.completedObjectives, ['reachVillage'])
  assert.deepEqual(player.technologies, [])
  assert.deepEqual(messages, [
    ['Objectif accompli : Village : atteindre 20 villageois', 'success'],
    ['action-target'],
    ['topbar'],
    ['tech-progress'],
  ])
  player.isPlayed = false
  player.units = Array.from({ length: 49 }, () => ({ type: 'Villager' }))
  player.updatePopulationObjectives()
  assert.deepEqual(player.completedObjectives, ['reachVillage'])
  player.units.push({ type: 'Villager' })
  player.updatePopulationObjectives()
  assert.deepEqual(player.completedObjectives, ['reachVillage', 'reachTown'])
  player.units = Array.from({ length: 100 }, () => ({ type: 'Villager' }))
  player.updatePopulationObjectives()
  assert.deepEqual(player.completedObjectives, ['reachVillage', 'reachTown'])
})

test('building prerequisites still apply without tech all', () => {
  const Player = loadPlayer()
  const player = {
    age: 1,
    hasBuilt: [],
    autoTechnologyByAge: false,
    config: {
      buildings: {
        ArcheryRange: {
          conditions: [
            { key: 'age', op: '>=', value: 1 },
            { key: 'hasBuilt', op: 'includes', value: 'Barracks' },
          ],
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

test('existing buildings keep their construction age and HP when their owner advances', () => {
  const Player = loadPlayer()
  const calls = []
  const player = {
    age: 3,
    autoTechnologyByAge: false,
    buildings: [
      {
        buildingAge: 1,
        totalHitPoints: 125,
        hitPoints: 70,
        assetAge: 1,
        assetCiv: 'Kemet',
        finalTexture() {
          calls.push(['captured', this.assetCiv, this.assetAge])
        },
        isBuilt: true,
        isDead: false,
      },
      {
        finalTexture() {
          calls.push(['native', this.assetCiv, this.assetAge])
        },
        isBuilt: true,
        isDead: false,
      },
    ],
    context: {
      menu: {},
      players: [],
    },
    isPlayed: false,
  }
  player.context.players = [player]
  Object.setPrototypeOf(player, Player.prototype)

  player.onAgeChange()

  assert.equal(player.buildings[0].assetAge, 1)
  assert.equal(player.buildings[0].buildingAge, 1)
  assert.equal(player.buildings[0].totalHitPoints, 125)
  assert.equal(player.buildings[0].hitPoints, 70)
  assert.equal(player.buildings[0].assetCiv, 'Kemet')
  assert.equal(player.buildings[1].assetAge, undefined)
  assert.deepEqual(calls, [
    ['captured', 'Kemet', 1],
    ['native', undefined, undefined],
  ])
})

test('planting wheat fields refreshes each planted cell before fading resources in', () => {
  const updated = []
  const faded = []
  const randomValues = [0, 0.25, 0.75, 1]
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
    isPlayed: true,
    technologies: ['Farming'],
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
  assert.deepEqual(player.completedObjectives, ['createWheatField'])
  assert.deepEqual(updated, ['0,0', '0,1', '1,0', '1,1'])
  assert.deepEqual(faded, ['0,0', '0,1', '1,0', '1,1'])
  assert.deepEqual(
    [...player.context.map.resources].map(wheat => wheat.quantity),
    [8, 9, 11, 12]
  )
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

test('placing a town center waits for finished construction before completing the objective', () => {
  const Player = loadPlayer()
  const messages = []
  const player = {
    age: 0,
    buildings: [],
    completedObjectives: [],
    config: { buildings: { TownCenter: { cost: {}, size: 3 } }, units: { Villager: { sounds: {} } } },
    context: {
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
  assert.ok(messages.some(message => message[0] === 'hero-build-order' && message[1] === 'TownCenter'))
  player.buildings[0].isBuilt = true
  player.updatePopulationObjectives = Player.prototype.updatePopulationObjectives
  player.updatePopulationObjectives()
  assert.equal(player.completedObjectives.includes('buildTownCenter'), true)
  assert.ok(messages.some(message => message[0] === 'Objectif accompli : Colonie : construire un forum'))
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
