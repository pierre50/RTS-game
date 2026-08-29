const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadBuildingPlacer() {
  const filename = path.join(__dirname, '../app/controllers/BuildingPlacer.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    'pixi.js': {
      Assets: {},
      Container: class {
        addChild() {}
        destroy() {}
      },
      Sprite: class {
        static from() {
          return new this()
        }
      },
    },
    '../lib': {
      cartesianToIsometric: (i, j) => [i * 32 - j * 32, i * 16 + j * 16],
      isometricToCartesian: () => [0, 0],
      canAfford: () => true,
      canPlaceBuildingAt: () => true,
      hasBuildingPlacementClearance: (grid, i, j, building, options = {}) =>
        mocks['../lib']
          .getBuildingFootprintCells(i, j, grid, building.size)
          .every(cell => options.canUseCell?.(cell) !== false),
      changeSpriteColor: () => {},
      getBuildingFootprintCells(startX, startY, grid, size = 1) {
        const result = []
        const footprintSize = Math.max(1, Math.floor(size))
        const before = Math.floor((footprintSize - 1) / 2)
        const after = footprintSize - before - 1
        for (let i = startX - before; i <= startX + after; i++) {
          if (!grid[i]) continue
          for (let j = startY - before; j <= startY + after; j++) {
            if (!grid[i][j]) continue
            result.push(grid[i][j])
          }
        }
        return result
      },
      getTexture: () => ({}),
      isBuildingLimitReached: () => false,
      payCost: () => {},
    },
    '../constants': {
      BUILDING_TYPES: { farm: 'Farm', smallWall: 'SmallWall' },
      COLOR_GREEN: 0x00ff00,
      COLOR_RED: 0xff0000,
      LABEL_TYPES: { sprite: 'sprite' },
      RESOURCE_TYPES: { wheat: 'Wheat' },
      UNIT_TYPES: { villager: 'Villager' },
    },
    '../classes/Resource': {
      Resource: class {
        constructor(options) {
          Object.assign(this, options)
        }
      },
    },
    '../lib/buildings/walls': {
      getWallTexture: () => ({}),
      isWall: () => false,
    },
    './WallPlacementController': {
      WallPlacementController: class {
        cancel() {
          return false
        }
      },
    },
    '../lib/lang': { t: value => value },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.BuildingPlacer
}

function createGrid(size) {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => ({
      i,
      j,
      visible: true,
      solid: false,
      category: 'Grass',
      has: null,
    }))
  )
}

test('hero building preview rejects footprints overlapping the hero cell', () => {
  const BuildingPlacer = loadBuildingPlacer()
  const grid = createGrid(5)
  const controls = {
    context: { map: { grid } },
    mouseBuilding: { type: 'House', size: 3 },
    isHeroControlActive: () => true,
    heroUnit: { i: 2, j: 2 },
  }
  const placer = new BuildingPlacer(controls)

  assert.equal(placer.canPlaceMouseBuilding(grid[2][2]), false)
  assert.equal(placer.canPlaceMouseBuilding(grid[0][0]), true)
})

test('hero wall preview rejects the hero cell', () => {
  const BuildingPlacer = loadBuildingPlacer()
  const grid = createGrid(5)
  const controls = {
    context: { map: { grid, revealEverything: true } },
    isHeroControlActive: () => true,
    heroUnit: { i: 2, j: 2 },
  }
  const placer = new BuildingPlacer(controls)
  const owner = { views: { isViewed: () => true } }

  assert.equal(placer.canWallUseCell(grid[2][2], owner), false)
  assert.equal(placer.canWallUseCell(grid[1][2], owner), true)
})

test('farm placement creates a 4x4 neutral wheat field instead of a building', () => {
  const BuildingPlacer = loadBuildingPlacer()
  const grid = createGrid(6)
  const created = []
  const paid = []
  const controls = {
    context: {
      map: {
        grid,
        resources: new Set(),
        addChild: child => {
          created.push(child)
          return child
        },
      },
      menu: {
        selection: null,
        setActionTarget: () => {},
        updateTopbar: () => {},
      },
      player: {
        isPlayed: true,
        wood: 100,
        buyBuilding: (i, j, type) => {
          paid.push([i, j, type])
          for (let x = i - 1; x <= i + 2; x++) {
            for (let y = j - 1; y <= j + 2; y++) {
              const wheat = { i: x, j: y, type: 'Wheat' }
              created.push(wheat)
              controls.context.map.resources.add(wheat)
            }
          }
          return true
        },
      },
    },
    mouseBuilding: { type: 'Farm', size: 4, cost: { wood: 75 } },
    removeMouseBuilding: () => {},
    isHeroControlActive: () => false,
  }
  const placer = new BuildingPlacer(controls)

  assert.equal(placer.placeWheatField(grid[2][2], controls.mouseBuilding), true)
  assert.deepEqual(paid, [[2, 2, 'Farm']])
  assert.equal(created.length, 16)
  assert.equal(controls.context.map.resources.size, 16)
  assert.deepEqual(
    created.map(resource => resource.type),
    Array.from({ length: 16 }, () => 'Wheat')
  )
})
