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
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const constants = {
  ACTION_TYPES: {
    loadTransport: 'loadTransport',
  },
  FAMILY_TYPES: {
    unit: 'unit',
  },
  SHEET_TYPES: {
    standing: 'standingSheet',
    walking: 'walkingSheet',
  },
  UNIT_TYPES: {
    fishingBoat: 'FishingBoat',
  },
}

function makeGrid(cells, size = 25) {
  const grid = Array.from({ length: size }, () => Array.from({ length: size }))
  for (const cell of cells) grid[cell.i][cell.j] = cell
  return grid
}

test('unloading a transported unit leaves it standing instead of walking', () => {
  const unloadedCell = {
    i: 3,
    j: 4,
    x: 30,
    y: 40,
    z: 2,
    category: 'Grass',
    solid: false,
    border: false,
    inclined: false,
    place(unit) {
      this.has = unit
    },
  }
  const unit = {
    isDead: false,
    isDestroyed: false,
    currentSheet: constants.SHEET_TYPES.walking,
    setTextures(sheet) {
      this.currentSheet = sheet
    },
  }
  const added = []
  const bucketed = []
  const transport = {
    i: 2,
    j: 2,
    family: constants.FAMILY_TYPES.unit,
    transportCapacity: 5,
    currentCell: { waterBorder: true },
    context: {
      map: {
        grid: [],
        addChild: child => added.push(child),
        addToInstanceBucket: child => bucketed.push(child),
      },
    },
    transportedUnits: [unit],
  }
  const { unloadTransport } = loadModule('app/lib/transport.ts', {
    '../constants': constants,
    './grid/cells': {
      getCellsAroundPoint: () => [unloadedCell],
    },
    './grid/movement': {
      getInstancePath: () => [],
    },
    './grid/visibility': {
      updateInstanceVisibility: () => {},
    },
    './maths': {
      getInstanceZIndex: () => 7,
      instancesDistance: () => 1,
    },
  })

  assert.equal(unloadTransport(transport), 1)
  assert.equal(unit.currentSheet, constants.SHEET_TYPES.standing)
  assert.equal(unit.loadedInTransport, null)
  assert.equal(unit.currentCell, unloadedCell)
  assert.equal(unloadedCell.has, unit)
  assert.deepEqual(transport.transportedUnits, [])
  assert.deepEqual(added, [unit])
  assert.deepEqual(bucketed, [unit])
})

test('unloading only works while the transport is on a water border cell', () => {
  const unit = {
    isDead: false,
    isDestroyed: false,
  }
  const transport = {
    i: 2,
    j: 2,
    family: constants.FAMILY_TYPES.unit,
    transportCapacity: 5,
    currentCell: { waterBorder: false },
    context: {
      map: {
        grid: [],
      },
    },
    transportedUnits: [unit],
  }
  const { canUnloadTransport, unloadTransport } = loadModule('app/lib/transport.ts', {
    '../constants': constants,
    './grid/cells': {
      getCellsAroundPoint: () => {
        throw new Error('should not search for unload cells away from water borders')
      },
    },
    './grid/movement': {
      getInstancePath: () => [],
    },
    './grid/visibility': {
      updateInstanceVisibility: () => {},
    },
    './maths': {
      getInstanceZIndex: () => 7,
      instancesDistance: () => 1,
    },
  })

  assert.equal(canUnloadTransport(transport), false)
  assert.equal(unloadTransport(transport), 0)
  assert.deepEqual(transport.transportedUnits, [unit])
})

test('sending a unit to an offshore transport moves both to a reachable shore', () => {
  const shoreCell = {
    i: 3,
    j: 2,
    category: 'Grass',
    waterBorder: false,
    solid: false,
    border: false,
    inclined: false,
  }
  const coastCell = {
    i: 4,
    j: 2,
    category: 'Water',
    waterBorder: false,
    solid: false,
    border: false,
  }
  const sentTransport = []
  const sentUnit = []
  const owner = { label: 'player-1' }
  const map = { grid: makeGrid([shoreCell, coastCell]) }
  const unit = {
    i: 2,
    j: 2,
    family: constants.FAMILY_TYPES.unit,
    category: 'Infantry',
    owner,
    sendToWithCell: (target, cell, action) => {
      sentUnit.push({ target, cell, action })
      return true
    },
  }
  const transport = {
    i: 20,
    j: 20,
    family: constants.FAMILY_TYPES.unit,
    category: 'Boat',
    owner,
    transportCapacity: 5,
    transportedUnits: [],
    context: { map },
    sendTo: cell => sentTransport.push(cell),
  }
  const { sendUnitToTransport } = loadModule('app/lib/transport.ts', {
    '../constants': constants,
    './grid/cells': {
      getCellsAroundPoint: (i, j, _grid, distance) => {
        if (i === transport.i && j === transport.j && distance === 4) return []
        if (i === unit.i && j === unit.j && distance === 1) return [shoreCell]
        if (i === shoreCell.i && j === shoreCell.j && distance === 1) return [coastCell]
        return []
      },
    },
    './grid/movement': {
      getInstancePath: (instance, i, j) => {
        if (instance === unit && i === shoreCell.i && j === shoreCell.j) return [shoreCell]
        if (instance === transport && i === coastCell.i && j === coastCell.j) return [coastCell]
        return []
      },
    },
    './grid/visibility': {
      updateInstanceVisibility: () => {},
    },
    './maths': {
      getInstanceZIndex: () => 7,
      instancesDistance: (a, b) => Math.abs(a.i - b.i) + Math.abs(a.j - b.j),
    },
  })

  assert.equal(sendUnitToTransport(unit, transport), true)
  assert.deepEqual(sentTransport, [coastCell])
  assert.deepEqual(sentUnit, [{ target: transport, cell: shoreCell, action: constants.ACTION_TYPES.loadTransport }])
  assert.equal(unit.transportLoadShoreCell, shoreCell)
  assert.equal(unit.transportLoadCoastCell, coastCell)
})

test('sending a unit already standing on shore to an offshore transport uses its current cell', () => {
  const shoreCell = {
    i: 2,
    j: 2,
    category: 'Grass',
    waterBorder: false,
    solid: false,
    border: false,
    inclined: false,
  }
  const coastCell = {
    i: 3,
    j: 2,
    category: 'Water',
    waterBorder: false,
    solid: false,
    border: false,
  }
  const sentTransport = []
  const sentUnit = []
  const owner = { label: 'player-1' }
  const map = { grid: makeGrid([shoreCell, coastCell]) }
  const unit = {
    i: shoreCell.i,
    j: shoreCell.j,
    family: constants.FAMILY_TYPES.unit,
    category: 'Infantry',
    owner,
    sendToWithCell: (target, cell, action) => {
      sentUnit.push({ target, cell, action })
      return true
    },
  }
  const transport = {
    i: 20,
    j: 20,
    family: constants.FAMILY_TYPES.unit,
    category: 'Boat',
    owner,
    transportCapacity: 5,
    transportedUnits: [],
    context: { map },
    sendTo: cell => sentTransport.push(cell),
  }
  const { sendUnitToTransport } = loadModule('app/lib/transport.ts', {
    '../constants': constants,
    './grid/cells': {
      getCellsAroundPoint: (i, j, _grid, distance) => {
        if (i === transport.i && j === transport.j && distance === 4) return []
        if (i === unit.i && j === unit.j && distance === 0) return [shoreCell]
        if (i === shoreCell.i && j === shoreCell.j && distance === 1) return [coastCell]
        return []
      },
    },
    './grid/movement': {
      getInstancePath: (instance, i, j) =>
        instance === transport && i === coastCell.i && j === coastCell.j ? [coastCell] : [],
    },
    './grid/visibility': {
      updateInstanceVisibility: () => {},
    },
    './maths': {
      getInstanceZIndex: () => 7,
      instancesDistance: (a, b) => Math.abs(a.i - b.i) + Math.abs(a.j - b.j),
    },
  })

  assert.equal(sendUnitToTransport(unit, transport), true)
  assert.deepEqual(sentTransport, [coastCell])
  assert.deepEqual(sentUnit, [{ target: transport, cell: shoreCell, action: constants.ACTION_TYPES.loadTransport }])
})

test('transport loading accepts water border cells as boat coast destinations', () => {
  const shoreCell = {
    i: 2,
    j: 2,
    category: 'Grass',
    waterBorder: false,
    solid: false,
    border: false,
    inclined: false,
  }
  const coastCell = {
    i: 3,
    j: 2,
    category: 'Ground',
    waterBorder: true,
    solid: false,
    border: true,
  }
  const sentTransport = []
  const sentUnit = []
  const owner = { label: 'player-1' }
  const map = { grid: makeGrid([shoreCell, coastCell]) }
  const unit = {
    i: shoreCell.i,
    j: shoreCell.j,
    family: constants.FAMILY_TYPES.unit,
    category: 'Infantry',
    owner,
    sendToWithCell: (target, cell, action) => {
      sentUnit.push({ target, cell, action })
      return true
    },
  }
  const transport = {
    i: 20,
    j: 20,
    family: constants.FAMILY_TYPES.unit,
    category: 'Boat',
    owner,
    transportCapacity: 5,
    transportedUnits: [],
    context: { map },
    sendTo: cell => sentTransport.push(cell),
  }
  const { sendUnitToTransport } = loadModule('app/lib/transport.ts', {
    '../constants': constants,
    './grid/cells': {
      getCellsAroundPoint: (i, j, _grid, distance) => {
        if (i === transport.i && j === transport.j && distance === 4) return []
        if (i === shoreCell.i && j === shoreCell.j && distance === 1) return [coastCell]
        return []
      },
    },
    './grid/movement': {
      getInstancePath: (instance, i, j) =>
        instance === transport && i === coastCell.i && j === coastCell.j ? [coastCell] : [],
    },
    './grid/visibility': {
      updateInstanceVisibility: () => {},
    },
    './maths': {
      getInstanceZIndex: () => 7,
      instancesDistance: (a, b) => Math.abs(a.i - b.i) + Math.abs(a.j - b.j),
    },
  })

  assert.equal(sendUnitToTransport(unit, transport), true)
  assert.deepEqual(sentTransport, [coastCell])
  assert.deepEqual(sentUnit, [{ target: transport, cell: shoreCell, action: constants.ACTION_TYPES.loadTransport }])
})
