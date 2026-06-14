const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadPlayer() {
  const filename = path.join(__dirname, '../app/classes/players/player.js')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })

  const module = { exports: {} }
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
        playSoundCue: () => {},
        capitalizeFirstLetter: value => value.charAt(0).toUpperCase() + value.slice(1),
      }
    }
    if (request === '../building') return { Building: class {} }
    if (request === '../unit') return { Unit: class {} }
    if (request === '../../constants') {
      return {
        ACTION_TYPES: {},
        FAMILY_TYPES: { player: 'player' },
        PLAYER_TYPES: { human: 'human' },
        POPULATION_MAX: 200,
        SOUND_CUES: { player: { ageAdvance: 'ageAdvance' } },
        UNIT_TYPES: { villager: 'Villager' },
      }
    }
    if (request === '../../config/playerConfig') return { createPlayerData: () => ({ config: {}, techs: {} }) }
    if (request === '../../lib/uiSound') return { playUiSound: () => {} }
    if (request === '../../services/VisionGrid') return { VisionGrid: class {} }
    if (request === '../../lib/buildings/walls') {
      return {
        refreshOwnerWalls: () => {},
        updateWallAndNeighbours: () => {},
      }
    }
    if (request === '../../lib/buildings/towers') {
      return { refreshOwnerTowers: () => {} }
    }
    return require(request)
  }

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.Player
}

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
