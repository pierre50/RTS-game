const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

const WATER_BORDER_BASE_FRAME_COUNT = 12
const WATER_BORDER_PHASES = 4

test('desert sand water borders include four animation phases for every shoreline frame', () => {
  const atlasPath = path.join(__dirname, '../public/assets/border/desert-sand-water-border/texture.json')
  const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'))
  const frameNames = Object.keys(atlas.frames)

  assert.equal(frameNames.length, WATER_BORDER_BASE_FRAME_COUNT * WATER_BORDER_PHASES)
  assert.deepEqual(atlas.meta.size, { w: 790, h: 132 })

  for (let baseFrame = 0; baseFrame < WATER_BORDER_BASE_FRAME_COUNT; baseFrame++) {
    const phaseFrames = Array.from(
      { length: WATER_BORDER_PHASES },
      (_, phase) =>
        `${String(baseFrame + phase * WATER_BORDER_BASE_FRAME_COUNT).padStart(3, '0')}_border_desert-sand-water-border.png`
    )
    assert.deepEqual(
      phaseFrames.map(name => Boolean(atlas.frames[name])),
      [true, true, true, true]
    )
    assert.deepEqual(
      phaseFrames.map(name => atlas.frames[name].frame.x),
      Array(WATER_BORDER_PHASES).fill(atlas.frames[phaseFrames[0]].frame.x)
    )
  }
})

function loadMapModule() {
  const filename = path.join(__dirname, '../app/classes/map/Map.ts')
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  class Container {
    constructor() {
      this.children = []
    }
    addChild(child) {
      this.children.push(child)
      child.parent = this
      return child
    }
    removeChildren() {
      const children = this.children
      this.children = []
      return children
    }
    destroy() {}
  }
  class Graphics extends Container {
    rect() {
      return this
    }
    fill() {
      return this
    }
  }
  class TilingSprite extends Container {
    constructor({ texture }) {
      super()
      this.texture = texture
      this.position = { set: () => {} }
    }
  }
  const localRequire = request => {
    if (request === 'pixi.js') {
      return {
        Assets: { cache: { has: () => false } },
        Container,
        Graphics,
        TilingSprite,
      }
    }
    if (request === '../../constants') {
      return {
        BUCKET_SIZE: 16,
        CELL_HEIGHT: 32,
        CELL_WIDTH: 64,
        getEnvironmentTerrainParams: () => ({ waterBackgroundColor: 0 }),
      }
    }
    if (request === './MapGeneration') return { MapGeneration: class {} }
    if (request === './resources/MapResources') return { MapResources: class {} }
    if (request === './terrain/MapTerrain') return { MapTerrain: class {} }
    if (request === './fog/MapFog') return { MapFog: class {} }
    if (request === '../../lib') return { getTextureByFrame: () => ({}) }
    if (request === '../../lib/random') return { createSeededRandom: () => Math.random }
    if (request === '../../lib/graphics/chunkCulling') return { rectangleIntersectsViewport: () => true }
    if (request === './MapWaterOverlay') {
      return requireFromTsFile(request, filename, {
        'pixi.js': {
          Assets: { cache: { has: () => false } },
          Graphics,
          TilingSprite,
        },
        '../../constants': {
          CELL_HEIGHT: 32,
          CELL_WIDTH: 64,
          getEnvironmentTerrainParams: () => ({ waterBackgroundColor: 0 }),
        },
        '../../lib': { getTextureByFrame: () => ({}) },
      })
    }
    if (request === './TerrainChunkManager') return { TerrainChunkManager: class {} }
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.default
}

test('registered water border surfaces advance on the water animation ticker', () => {
  const Map = loadMapModule()
  let tick = null
  const map = new Map({
    app: {
      ticker: {
        add(callback) {
          tick = callback
        },
        remove() {},
      },
    },
    players: [],
  })

  const frames = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]
  const sprite = { texture: frames[0] }

  map.registerWaterBorderSurface(sprite, frames)

  const sequence = [0]
  for (let i = 0; i < 8; i++) {
    tick({ deltaTime: 17 })
    sequence.push(sprite.texture.id)
  }

  assert.deepEqual(sequence, [0, 1, 2, 3, 2, 1, 0, 1, 2])
})
