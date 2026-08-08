const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const constants = {
  FAMILY_TYPES: { animal: 'animal' },
  SHEET_TYPES: {
    walking: 'walkingSheet',
    running: 'runningSheet',
    flying: 'flyingSheet',
    standing: 'standingSheet',
  },
  STEP_TIME: 100,
}

const locomotion = loadModule('app/classes/animal/locomotion.ts', { '../../constants': constants })

test('an animal with altitude is airborne', () => {
  assert.equal(locomotion.isAirborne({ altitude: 5, currentSheet: 'walkingSheet' }), true)
})

test('an animal on the flying sheet is airborne even at altitude zero', () => {
  assert.equal(locomotion.isAirborne({ altitude: 0, currentSheet: 'flyingSheet' }), true)
})

test('a grounded animal is not airborne', () => {
  assert.equal(locomotion.isAirborne({ altitude: 0, currentSheet: 'walkingSheet' }), false)
})

test('an airborne animal keeps its flying sheet whatever sheet is requested', () => {
  const grouse = { altitude: 20, currentSheet: 'flyingSheet', flyingSheet: {} }
  assert.equal(locomotion.resolveMovementSheet(grouse), 'flyingSheet')
  assert.equal(locomotion.resolveMovementSheet(grouse, 'walkingSheet'), 'flyingSheet')
})

test('a grounded animal resolves to the requested sheet or walking', () => {
  const grouse = { altitude: 0, currentSheet: 'standingSheet', flyingSheet: {} }
  assert.equal(locomotion.resolveMovementSheet(grouse), 'walkingSheet')
  assert.equal(locomotion.resolveMovementSheet(grouse, 'flyingSheet'), 'flyingSheet')
  assert.equal(locomotion.resolveMovementSheet(grouse, 'runningSheet'), 'runningSheet')
})

test('an airborne animal without a flying sheet falls back to the requested sheet', () => {
  assert.equal(locomotion.resolveMovementSheet({ altitude: 5, currentSheet: 'walkingSheet' }), 'walkingSheet')
})

function createMovement(animalOverrides = {}) {
  const calls = []
  const grid = []
  for (let i = 0; i < 12; i++) {
    grid[i] = []
    for (let j = 0; j < 12; j++) {
      grid[i][j] = { i, j, x: i * 10, y: j * 10, z: 0, solid: false, has: null }
    }
  }
  const animal = {
    i: 5,
    j: 5,
    x: 50,
    y: 50,
    label: 'grouse-1',
    speed: 1,
    sight: 6,
    degree: 0,
    action: null,
    path: [],
    dest: null,
    realDest: null,
    altitude: 0,
    currentSheet: 'walkingSheet',
    sprite: {
      playing: true,
      playCalls: 0,
      stopCalls: 0,
      play() {
        this.playing = true
        this.playCalls++
      },
      stop() {
        this.playing = false
        this.stopCalls++
      },
    },
    context: { map: { grid } },
    stop: () => calls.push(['stop']),
    stopInterval: () => {},
    setDest: dest => calls.push(['setDest', dest.i, dest.j]),
    setPath: (path, sheet) => calls.push(['setPath', sheet]),
    getAction: name => calls.push(['getAction', name]),
    affectNewDest: () => calls.push(['affectNewDest']),
    sendTo: () => calls.push(['sendTo']),
    ...animalOverrides,
  }
  const lib = {
    cartesianToIsometric: (i, j) => [i * 10, j * 10],
    degreeToDirection: () => 'south',
    getInstanceClosestFreeCellPath: () => [grid[6][6]],
    getInstanceDegree: () => 0,
    getInstancePath: (_animal, i, j) => [grid[i][j]],
    getInstanceZIndex: () => 0,
    instanceContactInstance: () => false,
    instancesDistance: () => 1,
    moveTowardPoint: () => {},
    updateInstanceVisibility: () => {},
  }
  const { AnimalMovement } = loadModule('app/classes/animal/AnimalMovement.ts', {
    '../../constants': constants,
    '../../lib': lib,
    './locomotion': locomotion,
  })
  return { movement: new AnimalMovement(animal), animal, grid, calls }
}

function blockNextCell(grid, animal) {
  const nextCell = grid[5][6]
  nextCell.has = {
    family: 'animal',
    label: 'other-animal',
    hasPath: () => true,
    sprite: { playing: true },
  }
  animal.path = [nextCell]
  animal.dest = grid[9][9]
}

test('a flying animal blocked by another animal keeps animating', () => {
  const { movement, animal, grid } = createMovement({
    altitude: 20,
    currentSheet: 'flyingSheet',
    flyingSheet: {},
  })
  blockNextCell(grid, animal)
  animal.sprite.playing = false

  movement.moveToPath()

  assert.equal(animal.sprite.playing, true)
  assert.equal(animal.sprite.stopCalls, 0)
})

test('a walking animal blocked by another animal pauses its animation', () => {
  const { movement, animal, grid } = createMovement()
  blockNextCell(grid, animal)

  movement.moveToPath()

  assert.equal(animal.sprite.playing, false)
  assert.equal(animal.sprite.stopCalls, 1)
})

test('a repath while flying keeps the flying sheet instead of walking', () => {
  const { movement, animal, grid, calls } = createMovement({
    altitude: 20,
    currentSheet: 'flyingSheet',
    flyingSheet: {},
  })

  movement.sendTo(grid[8][8], null, { forceRepath: true })

  assert.deepEqual(calls, [
    ['setDest', 8, 8],
    ['setPath', 'flyingSheet'],
  ])
})

test('a repath on the ground still defaults to the walking sheet', () => {
  const { movement, grid, calls } = createMovement()

  movement.sendTo(grid[8][8], null, { forceRepath: true })

  assert.deepEqual(calls, [
    ['setDest', 8, 8],
    ['setPath', 'walkingSheet'],
  ])
})
