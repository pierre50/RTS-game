const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadMovement() {
  const filename = path.join(__dirname, '../app/lib/grid/movement.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../../services/Pathfinding': {
      findInstancePath: () => [],
    },
    '../maths': {
      getInstanceDegree: () => 0,
      instancesDistance: (a, b) => Math.hypot((a.i ?? 0) - (b.i ?? 0), (a.j ?? 0) - (b.j ?? 0)),
      pointsDistance: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
      randomItem: items => items[0],
    },
    './cells': {
      getBuildingContactDistance: size => Math.floor(((size ?? 1) - 1) / 2) + 1,
      getCellsAroundPoint: (startX, startY, grid, dist, callback = () => true) => {
        const cells = []
        for (let i = Math.max(startX - dist, 0); i <= Math.min(startX + dist, grid.length - 1); i++) {
          for (let j = Math.max(startY - dist, 0); j <= Math.min(startY + dist, grid[i].length - 1); j++) {
            if (Math.max(Math.abs(i - startX), Math.abs(j - startY)) !== dist) continue
            const cell = grid[i][j]
            if (cell && callback(cell)) cells.push(cell)
          }
        }
        return cells
      },
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function makeGrid(size) {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_cell, j) => ({ i, j, category: 'Land', solid: true }))
  )
}

test('free land spawn around instance starts at the instance size ring', () => {
  const { getFreeLandCellAroundInstance } = loadMovement()
  const grid = makeGrid(7)
  grid[1][3].solid = false
  grid[5][3].solid = false

  const cell = getFreeLandCellAroundInstance({ i: 3, j: 3, size: 2 }, grid, cells => cells[0])

  assert.deepEqual({ i: cell.i, j: cell.j }, { i: 1, j: 3 })
})

test('free land spawn around instance skips blocked terrain classes', () => {
  const { getFreeLandCellAroundInstance } = loadMovement()
  const grid = makeGrid(5)
  grid[1][2] = { i: 1, j: 2, category: 'Water', solid: false }
  grid[2][1] = { i: 2, j: 1, category: 'Land', solid: false, waterBorder: true }
  grid[2][3] = { i: 2, j: 3, category: 'Land', solid: false, border: true }
  grid[3][2] = { i: 3, j: 2, category: 'Land', solid: false }

  const cell = getFreeLandCellAroundInstance({ i: 2, j: 2, size: 1 }, grid, cells => cells[0])

  assert.deepEqual({ i: cell.i, j: cell.j }, { i: 3, j: 2 })
})
