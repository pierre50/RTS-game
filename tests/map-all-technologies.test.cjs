const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadMapGeneration() {
  const filename = path.join(__dirname, '../app/classes/map/MapGeneration.js')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })

  const module = { exports: {} }
  const localRequire = request => {
    if (request === 'pixi.js') return { Assets: {}, Sprite: class {} }
    if (request === '../resource') return { Resource: class {} }
    if (request === '../players') return { Human: class {}, AI: class {}, Gaia: class {} }
    if (request === '../../lib') {
      return {
        colors: [],
        getCellsAroundPoint: () => [],
        getZoneInGridWithCondition: () => [],
        updateInstanceVisibility: () => {},
        rehydrateAIKnowledge: () => {},
      }
    }
    if (request === '../../constants') {
      return {
        BUILDING_TYPES: {},
        FAMILY_TYPES: {},
        LABEL_TYPES: {},
        PLAYER_TYPES: {},
        RESOURCE_TYPES: {},
        UNIT_TYPES: {},
      }
    }
    if (request === '../cell') return { Cell: class {} }
    if (request === '../../lib/buildings/walls') return { refreshOwnerWalls: () => {} }
    return require(request)
  }

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.MapGeneration
}

test('all technologies keeps the configured starting age and enables age-based auto techs', () => {
  const MapGeneration = loadMapGeneration()
  const context = {
    map: {
      startingAge: 2,
      allTechnologies: true,
    },
  }
  const player = {
    age: 0,
    technologies: [],
    applyEligibleTechnologies() {
      this.technologies.push('ResearchSmallWall', 'UpgradeMediumWall')
    },
  }

  MapGeneration.prototype.applyStartingBonuses.call(context, player)

  assert.equal(player.age, 2)
  assert.equal(player.autoTechnologyByAge, true)
  assert.deepEqual(player.technologies, ['ResearchSmallWall', 'UpgradeMediumWall'])
})

test('a player-specific age overrides the global starting age', () => {
  const MapGeneration = loadMapGeneration()
  const context = {
    map: {
      startingAge: 1,
      allTechnologies: false,
    },
  }
  const player = { age: 0 }

  MapGeneration.prototype.applyStartingBonuses.call(context, player, 3)

  assert.equal(player.age, 3)
})
