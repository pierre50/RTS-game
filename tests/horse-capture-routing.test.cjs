const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadHorseCapture(calls) {
  const filename = path.join(__dirname, '../app/lib/horseCapture.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (request === '../constants') return { BUILDING_TYPES: { stable: 'Stable' }, STEP_TIME: 20 }
    if (request === './stableHorses') {
      return {
        canStoreStableHorse: building => (building.stableHorses?.length ?? 0) < 5,
        storeStableHorse: (building, horse) => {
          if ((building.stableHorses?.length ?? 0) >= 5) return false
          building.stableHorses = building.stableHorses ?? []
          building.stableHorses.push({ horseColor: horse.horseColor })
          return true
        },
      }
    }
    if (request === './maths') return { instancesDistance: (a, b) => Math.hypot(a.i - b.i, a.j - b.j) }
    if (request === './grid/movement') {
      return { instanceContactInstance: (a, b) => a.i === b.i && a.j === b.j }
    }
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('owner-contact routing waits for the owner timeout before failing', () => {
  const calls = []
  const { routeCapturedHorseToStableWithOwnerContact } = loadHorseCapture(calls)
  const stable = {
    type: 'Stable',
    label: 'stable-1',
    i: 20,
    j: 0,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    stableHorses: [],
  }
  const owner = {
    label: 'villager-1',
    i: 0,
    j: 0,
    owner: { buildings: [stable] },
  }
  const horse = {
    label: 'horse-1',
    i: 5,
    j: 0,
    isDead: false,
    isDestroyed: false,
    sendTo: () => calls.push(['horse.sendTo']),
  }
  const scheduler = {
    elapsedMs: 0,
    tasks: [],
    add(callback) {
      this.tasks.push(callback)
      return this.tasks.length
    },
    remove: id => calls.push(['removeTask', id]),
  }

  routeCapturedHorseToStableWithOwnerContact({
    gameContext: { scheduler },
    owner,
    horse,
    ownerContactTimeoutMs: 30000,
    onStored: () => calls.push(['stored']),
    onFailure: () => calls.push(['failure']),
  })

  scheduler.elapsedMs = 20000
  scheduler.tasks[0]()
  assert.equal(calls.some(call => call[0] === 'failure'), false)

  scheduler.elapsedMs = 30000
  scheduler.tasks[0]()
  assert.equal(calls.some(call => call[0] === 'failure'), true)
})
