const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadSpawnActions(sharedOverrides = {}) {
  const filename = path.join(__dirname, '../app/dev-console/actions/spawn.js')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
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
        getSpawnCell: () => ({ i: 12, j: 34, category: 'Water', solid: false, has: null }),
        ...sharedOverrides,
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
    config: { units: { Boat: { category: 'Boat' } } },
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

  const result = spawnUnits(context, 'Boat', 2, 1)

  assert.deepEqual(result, { ok: true, message: 'Spawned 2 Boat for player 1' })
  assert.equal(currentPlayer.population, 0)
  assert.equal(enemyPlayer.population, 2)
  assert.deepEqual(created, [
    { owner: 'enemy', unit: { i: 12, j: 34, type: 'Boat' } },
    { owner: 'enemy', unit: { i: 12, j: 34, type: 'Boat' } },
  ])
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
