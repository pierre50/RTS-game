const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadSpawnActions(sharedOverrides = {}) {
  const filename = path.join(__dirname, '../app/dev-console/actions/spawn.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  const module = { exports: {} }
  const mocks = {}
  const localRequire = request => {
    if (request === './shared') {
      return {
        findKey(source, value) {
          const wanted = String(value || '').toLowerCase()
          return Object.keys(source).find(key => key.toLowerCase() === wanted)
        },
        normalize(value) {
          return String(value || '').toLowerCase()
        },
        getAmount(value, fallback = 1) {
          const amount = Number(value ?? fallback)
          return Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : fallback
        },
        addDevEntityToMapSpaceContainer: (context, entity) => context.map?.addChild?.(entity),
        getDevMapSpace: () => null,
        getSpawnCell: () => ({ i: 12, j: 34, category: 'Grass', solid: false, has: null }),
        ...sharedOverrides,
      }
    }
    if (request === '../../classes/Resource') {
      return {
        Resource: class {
          constructor(options) {
            Object.assign(this, options)
          }
        },
      }
    }
    if (request === '../../classes/players/Player') {
      return {
        Player: class {
          constructor(options, context) {
            Object.assign(this, options)
            this.label = 'bandit-owner'
            this.config = context.player.config
            this.units = []
            this.buildings = []
            this.corpses = []
            this.techs = {}
            this.population = 0
            this.populationMax = Number.POSITIVE_INFINITY
            this.age = 0
            this.cellViewed = 0
            this.wood = 0
            this.food = 0
            this.stone = 0
            this.gold = 0
            this.copper = 0
            this.iron = 0
            this.colorHex = '#ff0000'
          }

          createUnit(unit) {
            const created = { ...unit, owner: this }
            this.units.push(created)
            return created
          }
        },
      }
    }
    if (request === '../../constants') {
      return {
        BUILDING_TYPES: { farm: 'Farm' },
        PLAYER_TYPES: { ai: 'AI' },
        RESOURCE_TYPES: { gold: 'Gold', wheat: 'Wheat' },
        UNIT_TYPES: {
          banditChief: 'BanditChief',
          banditSword: 'BanditSword',
          banditArcher: 'BanditArcher',
        },
      }
    }
    if (request === '../../lib') {
      return {
        getBuildingFootprintCells(i, j) {
          const cells = []
          for (let x = i - 1; x <= i + 2; x++) {
            for (let y = j - 1; y <= j + 2; y++) {
              cells.push({ i: x, j: y })
            }
          }
          return cells
        },
      }
    }
    return requireFromTsFile(request, filename, mocks)
  }

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('spawn can target another player by index', () => {
  const { spawnUnits } = loadSpawnActions()
  const created = []
  const currentPlayer = {
    config: { units: { Villager: { category: 'Civilian' } } },
    population: 0,
    createUnit: unit => created.push({ owner: 'current', unit }),
  }
  const enemyPlayer = {
    config: { units: { Trebuchet: { category: 'Siege' } } },
    population: 0,
    createUnit: unit => created.push({ owner: 'enemy', unit }),
  }
  const context = {
    player: currentPlayer,
    players: [currentPlayer, enemyPlayer],
    menu: {
      updateTopbar: () => {},
      updatePlayerMiniMapEvt: () => {},
    },
  }

  const result = spawnUnits(context, 'Trebuchet', 2, 1)

  assert.deepEqual(result, { ok: true, message: 'Spawned 2 Trebuchet for player 1' })
  assert.equal(currentPlayer.population, 0)
  assert.equal(enemyPlayer.population, 2)
  assert.deepEqual(created, [
    { owner: 'enemy', unit: { i: 12, j: 34, type: 'Trebuchet' } },
    { owner: 'enemy', unit: { i: 12, j: 34, type: 'Trebuchet' } },
  ])
})

test('bandit aliases spawn on a hidden hostile owner', () => {
  const { spawnUnits } = loadSpawnActions()
  const currentPlayer = {
    label: 'player',
    civ: 'Greek',
    config: { units: { BanditChief: { category: 'Bandit' } } },
    population: 0,
    isEnemy: () => false,
    enemyPlayers: () => [],
  }
  const context = {
    player: currentPlayer,
    players: [currentPlayer],
    menu: {
      updateTopbar: () => {},
      updatePlayerMiniMapEvt: () => {},
    },
  }

  const result = spawnUnits(context, 'bandit1', 2)
  const banditOwner = context.players[1]

  assert.deepEqual(result, { ok: true, message: 'Spawned 2 BanditChief for bandits' })
  assert.equal(banditOwner.devConsoleBanditOwner, true)
  assert.equal(banditOwner.isEnemy(currentPlayer), true)
  assert.equal(banditOwner.isEnemy(banditOwner), false)
  assert.equal(currentPlayer.isEnemy(banditOwner), true)
  assert.deepEqual(currentPlayer.enemyPlayers(), [banditOwner])
  assert.equal(banditOwner.population, 2)
  assert.deepEqual(
    banditOwner.units.map(unit => ({
      type: unit.type,
      gender: unit.gender,
      appearanceVariants: unit.appearanceVariants,
    })),
    [
      { type: 'BanditChief', gender: 'male', appearanceVariants: { gender: 'male' } },
      { type: 'BanditChief', gender: 'male', appearanceVariants: { gender: 'male' } },
    ]
  )
})

test('building farm spawns a mature wheat field instead of a building entity', () => {
  const { spawnBuilding } = loadSpawnActions()
  const spawned = []
  const currentPlayer = {
    config: { buildings: { Farm: { size: 4 } } },
    createBuilding: () => {
      throw new Error('Farm should not create a building')
    },
  }
  const context = {
    player: currentPlayer,
    players: [currentPlayer],
    map: {
      grid: [],
      resources: new Set(),
      addChild: resource => {
        spawned.push(resource)
        return resource
      },
    },
    menu: {
      updateTopbar: () => {},
      updateResourcesMiniMapEvt: () => {},
    },
  }

  const result = spawnBuilding(context, 'farm')

  assert.deepEqual(result, { ok: true, message: 'Spawned Wheat Field' })
  assert.equal(spawned.length, 16)
  assert.equal(context.map.resources.size, 16)
  assert.deepEqual(
    spawned.map(resource => [resource.type, resource.startsMature]),
    Array.from({ length: 16 }, () => ['Wheat', true])
  )
})

test('spawn rejects an invalid player index', () => {
  const { spawnUnits } = loadSpawnActions()
  const context = {
    player: { config: { units: { Villager: { category: 'Civilian' } } } },
    players: [],
    menu: {
      updateTopbar: () => {},
      updatePlayerMiniMapEvt: () => {},
    },
  }

  const result = spawnUnits(context, 'Villager', 1, 'enemy')

  assert.deepEqual(result, { ok: false, message: 'Player index must be a non-negative integer' })
})
