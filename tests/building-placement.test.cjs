const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

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
      return { FAMILY_TYPES: { building: 'building' }, LABEL_TYPES: {} }
    }
    if (request === './cells') {
      const getPlainCellsAroundPoint = (startX, startY, grid, dist = 0) => {
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
      }
      return {
        getPlainCellsAroundPoint,
        getBuildingFootprintCells(startX, startY, grid, size = 1) {
          const result = []
          const footprintSize = Math.max(1, Math.floor(size))
          const before = Math.floor((footprintSize - 1) / 2)
          const after = footprintSize - before - 1

          for (let i = startX - before; i <= startX + after; i++) {
            const row = grid[i]
            if (!row) continue

            for (let j = startY - before; j <= startY + after; j++) {
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
    return requireFromTsFile(request, filename, mocks)
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
    reservedPassage: false,
    ...overrides,
  }
}

function createGrid(size, factory) {
  return Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => factory(i, j)))
}

const { canPlaceBuildingAt, hasBuildingPlacementClearance } = loadPlacementModule()
const barracks = { type: 'Barracks', size: 3 }
const tower = { type: 'WatchTower', size: 2 }

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

test('size 2 building placement validates all four footprint cells', () => {
  const grid = createGrid(5, (i, j) => createCell(i, j))
  grid[2][3].solid = true

  assert.equal(canPlaceBuildingAt(grid, 2, 2, tower), false)

  grid[2][3].solid = false
  assert.equal(canPlaceBuildingAt(grid, 2, 2, tower), true)
})

test('size 2 building placement is rejected when footprint leaves the grid', () => {
  const grid = createGrid(5, (i, j) => createCell(i, j))

  assert.equal(canPlaceBuildingAt(grid, 4, 4, tower), false)
})

test('building placement rejects reserved passage cells in its extra clearance', () => {
  const grid = createGrid(7, (i, j) => createCell(i, j))
  grid[4][4].reservedPassage = true

  assert.equal(canPlaceBuildingAt(grid, 2, 2, barracks), true)
  assert.equal(
    hasBuildingPlacementClearance(grid, 2, 2, barracks, {
      canUseCell: cell => !cell.reservedPassage,
    }),
    false
  )
})

test('building placement rejects buildings in its extra clearance', () => {
  const grid = createGrid(7, (i, j) => createCell(i, j))
  grid[4][4].solid = true
  grid[4][4].has = { family: 'building' }

  assert.equal(canPlaceBuildingAt(grid, 2, 2, barracks), true)
  assert.equal(
    hasBuildingPlacementClearance(grid, 2, 2, barracks, {
      canUseCell: cell => !cell.reservedPassage,
    }),
    false
  )
})

test('building placement allows units in its extra clearance', () => {
  const grid = createGrid(7, (i, j) => createCell(i, j))
  grid[4][4].solid = true
  grid[4][4].has = { family: 'unit' }

  assert.equal(canPlaceBuildingAt(grid, 2, 2, barracks), true)
  assert.equal(
    hasBuildingPlacementClearance(grid, 2, 2, barracks, {
      canUseCell: cell => !cell.reservedPassage,
    }),
    true
  )
})
