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
      presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
    }).code
  }

  const moduleCache = new Map()
  const loadTsFile = tsFilename => {
    if (moduleCache.has(tsFilename)) return moduleCache.get(tsFilename).exports
    const loadedModule = { exports: {} }
    moduleCache.set(tsFilename, loadedModule)
    new Function('module', 'exports', 'require', compileTs(tsFilename))(loadedModule, loadedModule.exports, localRequire)
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
        getBuildingFootprintCells:
          overrides.getBuildingFootprintCells ?? ((i, j, grid) => [grid[i][j]]),
        capitalizeFirstLetter: value => value.charAt(0).toUpperCase() + value.slice(1),
      }
    }
    if (request === '../building/Building') return { Building: class {} }
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
        BUILDING_TYPES: { farm: 'Farm' },
        FAMILY_TYPES: { player: 'player' },
        PLAYER_TYPES: { human: 'human' },
        POPULATION_MAX: 200,
        RESOURCE_NAMES: [],
        RESOURCE_TYPES: { wheat: 'Wheat' },
        SOUND_CUES: { player: { ageAdvance: 'ageAdvance' } },
        UNIT_TYPES: { villager: 'Villager' },
        FADE_DURATION_MS: 2000,
      }
    }
    if (request === '../../config/playerConfig') return { createPlayerData: () => ({ config: {}, techs: {} }) }
    if (request === '../../config/name') return { getRandomUnitName: overrides.getRandomUnitName ?? (() => 'Unit') }
    if (request === '../../lib/entities/entityFade') return { fadeIn: overrides.fadeIn ?? (() => {}) }
    if (request === '../../lib/chief') {
      return {
        hasLivingChief: () => true,
        playerNeedsChiefForCommand: () => false,
      }
    }
    if (request === '../../lib/audio/uiSound') return { playUiSound: () => {} }
    if (request === '../../services/VisionGrid') return { VisionGrid: class {} }
    if (request === '../../lib/buildings/walls') {
      return {
        refreshOwnerWalls: () => {},
        updateWallAndNeighbours: () => {},
      }
    }
    if (request === './PlayerTechnologies') {
      return loadTsFile(path.join(__dirname, '../app/classes/players/PlayerTechnologies.ts'))
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
    civ: 'Roman',
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

  assert.equal(unit.name, 'Roman-female-unit')
  assert.deepEqual(calls, [{ civ: 'Roman', gender: 'female', sample: 0.25 }])
})

test('age-based auto technologies stop before age 3 wall upgrades', () => {
  const Player = loadPlayer()
  const player = {
    age: 2,
    technologies: [],
    techs: {
      ToolAge: { key: 'age', value: 1 },
      BronzeAge: { key: 'age', value: 2 },
      IronAge: { key: 'age', value: 3 },
      ResearchSmallWall: {
        key: 'technologies',
        conditions: [{ key: 'age', op: '>=', value: 1 }],
      },
      UpgradeMediumWall: {
        key: 'technologies',
        conditions: [
          { key: 'age', op: '>=', value: 2 },
          { key: 'technologies', op: 'includes', value: 'ResearchSmallWall' },
        ],
      },
      UpgradeFortification: {
        key: 'technologies',
        conditions: [
          { key: 'age', op: '>=', value: 3 },
          { key: 'technologies', op: 'includes', value: 'UpgradeMediumWall' },
        ],
      },
    },
    units: [],
    buildings: [],
    updateConfig: () => {},
  }

  Object.setPrototypeOf(player, Player.prototype)

  const unlocked = player.applyEligibleTechnologies()

  assert.deepEqual(unlocked, ['ResearchSmallWall', 'UpgradeMediumWall'])
  assert.deepEqual(player.technologies, ['ResearchSmallWall', 'UpgradeMediumWall'])
})

test('tech all ignores building prerequisites but keeps age requirements', () => {
  const Player = loadPlayer()
  const player = {
    age: 1,
    hasBuilt: [],
    autoTechnologyByAge: true,
    config: {
      buildings: {
        ArcheryRange: {
          conditions: [
            { key: 'age', op: '>=', value: 1 },
            { key: 'hasBuilt', op: 'includes', value: 'Barracks' },
          ],
        },
        GovernmentCenter: {
          conditions: [
            { key: 'age', op: '>=', value: 2 },
            { key: 'hasBuilt', op: 'includes', value: 'Market' },
          ],
        },
      },
    },
  }

  Object.setPrototypeOf(player, Player.prototype)

  assert.equal(player.isBuildingEligible('ArcheryRange'), true)
  assert.equal(player.isBuildingEligible('GovernmentCenter'), false)
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

test('captured buildings keep their civ but advance visual age on owner age changes', () => {
  const Player = loadPlayer()
  const calls = []
  const player = {
    age: 3,
    autoTechnologyByAge: false,
    buildings: [
      {
        assetAge: 1,
        assetCiv: 'Egyptian',
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

  assert.equal(player.buildings[0].assetAge, 3)
  assert.equal(player.buildings[0].assetCiv, 'Egyptian')
  assert.equal(player.buildings[1].assetAge, undefined)
  assert.deepEqual(calls, [
    ['captured', 'Egyptian', 3],
    ['native', undefined, undefined],
  ])
})

test('unlocking age technology calls age change handler with player context', () => {
  const Player = loadPlayer()
  const calls = []
  const player = {
    age: 0,
    technologies: [],
    techs: {
      ToolAge: { key: 'age', value: 1 },
    },
    buildings: [
      {
        finalTexture() {
          calls.push(['building', this.assetAge])
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

  assert.equal(player.unlockTechnology('ToolAge'), true)

  assert.equal(player.age, 1)
  assert.equal(player.buildings[0].assetAge, undefined)
  assert.deepEqual(calls, [['building', undefined]])
})

test('planting wheat fields refreshes each planted cell before fading resources in', () => {
  const updated = []
  const faded = []
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
  assert.deepEqual(updated, ['0,0', '0,1', '1,0', '1,1'])
  assert.deepEqual(faded, ['0,0', '0,1', '1,0', '1,1'])
})
