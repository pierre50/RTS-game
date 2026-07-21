const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadPlacementModule() {
  const filename = path.join(__dirname, '../app/lib/grid/placement.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (request === '../maths') {
      return { instancesDistance: () => 0 }
    }
    if (request === '../../constants') {
      return { LABEL_TYPES: {} }
    }
    if (request === './cells') {
      return {
        getPlainCellsAroundPoint(startX, startY, grid, dist = 0) {
          const result = []
          const minX = Math.max(startX - dist, 0)
          const maxX = Math.min(startX + dist, grid.length - 1)

          for (let i = minX; i <= maxX; i++) {
            const row = grid[i]
            if (!row) continue
            const minY = Math.max(startY - dist, 0)
            const maxY = Math.min(startY + dist, row.length - 1)

            for (let j = minY; j <= maxY; j++) {
              const cell = row[j]
              if (cell) result.push(cell)
            }
          }

          return result
        },
        getBuildingFootprintRadius(size) {
          return Math.floor((size - 1) / 2)
        },
        getRandomZoneInGridWithCondition() {
          return null
        },
        getZoneInGridWithCondition() {
          return null
        },
      }
    }
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function createCell(i, j, overrides = {}) {
  return {
    i,
    j,
    z: 0,
    solid: false,
    border: false,
    inclined: false,
    visible: true,
    waterBorder: false,
    category: 'Grass',
    ...overrides,
  }
}

function createGrid(size, factory) {
  return Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => factory(i, j)))
}

const { canPlaceBuildingAt } = loadPlacementModule()
const dock = { type: 'Dock', size: 3, buildOnWater: true }
const barracks = { type: 'Barracks', size: 3, buildOnWater: false }

test('dock can only anchor on a coastal water cell', () => {
  const grid = createGrid(5, (i, j) => {
    if (i === 2 && j >= 1 && j <= 3) return createCell(i, j, { waterBorder: true })
    if (i >= 3 && i <= 4 && j >= 1 && j <= 3) return createCell(i, j, { category: 'Water' })
    return createCell(i, j)
  })

  assert.equal(canPlaceBuildingAt(grid, 3, 2, dock), true)
})

test('dock placement is rejected in open water even when the full footprint is water', () => {
  const grid = createGrid(5, (i, j) => createCell(i, j, { category: 'Water' }))

  assert.equal(canPlaceBuildingAt(grid, 2, 2, dock), false)
})

test('dock placement is rejected when the footprint includes normal land cells', () => {
  const grid = createGrid(5, (i, j) => {
    if (i === 2 && j === 2) return createCell(i, j, { category: 'Water' })
    if (i === 1 && j === 2) return createCell(i, j, { waterBorder: true })
    return createCell(i, j)
  })

  assert.equal(canPlaceBuildingAt(grid, 2, 2, dock), false)
})

test('building placement is rejected when any footprint cell is unexplored', () => {
  const grid = createGrid(5, (i, j) => createCell(i, j))
  const explored = new Set(['1,1', '1,2', '1,3', '2,1', '2,2', '2,3', '3,1', '3,2'])

  assert.equal(
    canPlaceBuildingAt(grid, 2, 2, barracks, {
      requireExplored: true,
      isExplored: cell => explored.has(`${cell.i},${cell.j}`),
    }),
    false
  )
})

test('building placement is allowed on explored fogged terrain', () => {
  const grid = createGrid(5, (i, j) => createCell(i, j, { visible: true }))
  const explored = new Set(['1,1', '1,2', '1,3', '2,1', '2,2', '2,3', '3,1', '3,2', '3,3'])

  assert.equal(
    canPlaceBuildingAt(grid, 2, 2, barracks, {
      requireVisible: true,
      requireExplored: true,
      isExplored: cell => explored.has(`${cell.i},${cell.j}`),
    }),
    true
  )
})
