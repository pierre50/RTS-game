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
      return { BUILDING_TYPES: { campBedroll: 'CampBedroll' }, FAMILY_TYPES: { building: 'building' }, LABEL_TYPES: {} }
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
        getBuildingFootprintCells:
          require('./helpers/loadTsModule.cjs').loadTsModule('app/lib/grid/cells.ts').getBuildingFootprintCells,
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
    return requireFromTsFile(request, filename, {})
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

test('every catalogue furnishing rejects neighbouring walls in both orientations', () => {
  const { loadTsModule } = require('./helpers/loadTsModule.cjs')
  const { INTERIOR_FURNITURE_TYPES } = loadTsModule('app/lib/buildings/interiorFurnitureCatalog.ts')
  const configs = require('../public/assets/data/gameplay/buildings.json')
  for (const type of INTERIOR_FURNITURE_TYPES) {
    if (type === 'CampBedroll') continue
    assert.ok(configs[type], `missing furniture config: ${type}`)
    for (const placementMirrored of [false, true]) {
      const building = { ...configs[type], type, placementMirrored }
      const options = { allowBorder: true }
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue
          const grid = createGrid(5, (i, j) => createCell(i, j))
          assert.equal(canPlaceBuildingAt(grid, 2, 2, building, options), true, type)
          grid[2 + di][2 + dj].solid = true
          assert.equal(canPlaceBuildingAt(grid, 2, 2, building, options), false, `${type}: wall ${di},${dj}`)
          grid[2 + di][2 + dj].solid = false
          grid[2 + di][2 + dj].category = 'Water'
          assert.equal(canPlaceBuildingAt(grid, 2, 2, building, options), false, `${type}: void ${di},${dj}`)
        }
      }
      const grid = createGrid(5, (i, j) => createCell(i, j))
      for (const [i, j] of [
        [0, 2],
        [4, 2],
        [2, 0],
        [2, 4],
      ]) {
        assert.equal(canPlaceBuildingAt(grid, i, j, building, options), false, `${type}: missing floor`)
      }
    }
  }
})

test('furniture margin uses interior floor and passage restrictions without changing other buildings', () => {
  const grid = createGrid(5, (i, j) => createCell(i, j))
  const options = { allowBorder: true, canUseCell: cell => !cell.terrainHidden && !cell.reservedPassage }
  grid[1][2].terrainHidden = true
  assert.equal(canPlaceBuildingAt(grid, 2, 2, { type: 'CampTable', size: 1 }, options), false)
  grid[1][2].terrainHidden = false
  grid[1][2].reservedPassage = true
  assert.equal(canPlaceBuildingAt(grid, 2, 2, { type: 'CampRug', size: 1 }, options), false)
  assert.equal(canPlaceBuildingAt(grid, 2, 2, { type: 'Trap', size: 1 }, options), true)
  assert.equal(canPlaceBuildingAt(grid, 2, 2, tower, options), true)
})

test('bed placement checks the rear artwork against walls even when interior borders are allowed', () => {
  const bed = { type: 'CampBedroll', size: 2 }
  for (const placementMirrored of [false, true]) {
    for (const [i, j] of [
      [1, 1],
      [1, 2],
      [2, 1],
    ]) {
      const grid = createGrid(5, (i, j) => createCell(i, j))
      const options = { allowBorder: true }
      grid[2][2].border = true
      assert.equal(canPlaceBuildingAt(grid, 2, 2, { ...bed, placementMirrored }, options), true)
      grid[i][j].solid = true
      assert.equal(canPlaceBuildingAt(grid, 2, 2, { ...bed, placementMirrored }, options), false)
      grid[i][j].solid = false
      grid[i][j].z = 1
      assert.equal(canPlaceBuildingAt(grid, 2, 2, { ...bed, placementMirrored }, options), false)
    }
  }
})

test('bed rear support must exist and pass the caller placement restrictions', () => {
  const grid = createGrid(5, (i, j) => createCell(i, j))
  const bed = { type: 'CampBedroll', size: 2 }
  assert.equal(canPlaceBuildingAt(grid, 0, 2, bed), false)
  assert.equal(canPlaceBuildingAt(grid, 2, 0, bed), false)
  assert.equal(canPlaceBuildingAt(grid, 2, 2, bed, { canUseCell: cell => cell !== grid[1][2] }), false)
  assert.equal(canPlaceBuildingAt(grid, 2, 2, { type: 'CampTable', size: 1 }), true)
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
