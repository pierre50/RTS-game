const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

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
      isometricToCartesian: () => [0, 0],
      canAfford: () => true,
      canPlaceBuildingAt: () => true,
      changeSpriteColor: () => {},
      getBuildingFootprintRadius: size => Math.floor((size - 1) / 2),
      getPlainCellsAroundPoint(startX, startY, grid, dist = 0) {
        const result = []
        for (let i = Math.max(startX - dist, 0); i <= Math.min(startX + dist, grid.length - 1); i++) {
          for (let j = Math.max(startY - dist, 0); j <= Math.min(startY + dist, grid[i].length - 1); j++) {
            result.push(grid[i][j])
          }
        }
        return result
      },
      getTexture: () => ({}),
      payCost: () => {},
    },
    '../constants': {
      BUILDING_TYPES: { smallWall: 'SmallWall' },
      COLOR_GREEN: 0x00ff00,
      COLOR_RED: 0xff0000,
      LABEL_TYPES: { sprite: 'sprite' },
      UNIT_TYPES: { villager: 'Villager' },
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
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
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
