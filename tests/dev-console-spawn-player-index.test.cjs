const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadSpawnActions(sharedOverrides = {}) {
  const filename = path.join(__dirname, '../app/dev-console/actions/spawn.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  const module = { exports: {} }
  const localRequire = request => {
    if (request === './shared') {
      return {
        findKey(source, value) {
          const wanted = String(value || '').toLowerCase()
          return Object.keys(source).find(key => key.toLowerCase() === wanted)
        },
        getAmount(value, fallback = 1) {
          const amount = Number(value ?? fallback)
          return Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : fallback
        },
        getSpawnCell: () => ({ i: 12, j: 34, category: 'Grass', solid: false, has: null }),
        ...sharedOverrides,
      }
    }
    if (request === '../../classes/FloatingItem') return { FloatingItem: class {} }
    if (request === '../../classes/Resource') {
      return {
        Resource: class {
          constructor(options) {
            Object.assign(this, options)
          }
        },
      }
    }
    if (request === '../../constants') {
      return {
        BUILDING_TYPES: { farm: 'Farm' },
        RESOURCE_TYPES: { gold: 'Gold', wheat: 'Wheat' },
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
    return require(request)
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
