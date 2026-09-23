const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup() {
  const made = []
  const textures = []
  const rendered = []
  class Container {
    children = []
    addChild(...children) {
      for (const child of children) {
        child.parent?.removeChild(child)
        child.parent = this
        this.children.push(child)
      }
      return children[0]
    }
    removeChild(child) {
      this.children = this.children.filter(c => c !== child)
      child.parent = null
    }
    destroy(options) {
      if (options?.children) for (const child of [...this.children]) child.destroy(options)
      this.parent?.removeChild(this)
      this.destroyed = true
    }
  }
  class Sprite extends Container {
    x = 0
    y = 0
    position = {
      set: (x, y) => {
        this.x = x
        this.y = y
      },
      copyFrom: p => {
        this.x = p.x
        this.y = p.y
      },
    }
    anchor = { copyFrom() {} }
    constructor(texture) {
      super()
      this.texture = texture
    }
  }
  class Visual extends Container {
    constructor(source) {
      super()
      Object.assign(this, source)
      made.push(this)
      this.addChild(new Sprite({}))
    }
    setWaterBorder() {
      this.has?.die()
      this._terrainAppearance.waterBorder = null
    }
    setReliefBorder() {}
    setPatchBorder() {}
    getTerrainBakeChildren() {
      return [...this.children]
    }
  }
  const { MapTerrainBake } = loadTsModule('app/classes/map/terrain/MapTerrainBake.ts', {
    mocks: {
      'pixi.js': {
        Container,
        Sprite,
        Matrix: class {
          translate() {
            return this
          }
        },
        RenderTexture: {
          create(options) {
            const texture = {
              ...options,
              destroy(source) {
                this.destroyed = true
                this.sourceDestroyed = source
              },
            }
            textures.push(texture)
            return texture
          },
        },
      },
      '../../../lib': { getGaiaAnimals: () => [], getTerrainSetZIndex: () => 1 },
      '../../../constants': {
        CELL_WIDTH: 64,
        CELL_HEIGHT: 32,
        CELL_DEPTH: 16,
        LABEL_TYPES: { floor: 'floor', set: 'set' },
        FAMILY_TYPES: { cell: 'cell' },
      },
      '../../cell/TerrainBakeCell': { TerrainBakeCell: Visual },
      '../../cell/RuntimeCell': { RuntimeCell: class {} },
    },
  })
  const map = new Container()
  Object.assign(map, {
    size: 1500,
    grid: Array.from({ length: 1501 }, () => []),
    resources: [],
    context: {
      app: {
        renderer: {
          render({ container }) {
            rendered.push([...container.children])
            if (map.fail) throw new Error('render failed')
          },
        },
      },
    },
  })
  const makeCell = (i, j, z = 0) => ({
    i,
    j,
    z,
    x: (i - j) * 32,
    y: (i + j) * 16 - z * 16,
    type: 'Grass',
    isGenerationCell: true,
    _terrainAppearance: {},
  })
  map.grid[1][1] = makeCell(1, 1)
  map.grid[1000][1000] = makeCell(1000, 1000)
  const bake = new MapTerrainBake(map)
  return { map, bake, made, textures, rendered, makeCell, Sprite }
}
const viewport = { visibleLeft: 0, visibleTop: 0, visibleWidth: 100, visibleHeight: 100 }

test('streaming keeps logical cells and creates no visuals until the camera requests them', () => {
  const h = setup()
  const source = h.map.grid[1][1]
  source.has = {
    die() {
      assert.fail('baking must not touch occupants')
    },
  }
  source._terrainAppearance.waterBorder = { resourceName: 'water', index: 0 }
  h.bake.bakeTerrainToChunks()
  assert.equal(h.made.length, 0)
  assert.equal(h.map.grid[1][1], source)
  h.bake.updateViewport(viewport)
  assert.ok(h.made.length > 0)
  assert.ok(h.made.every(cell => cell.i === 1 && cell.destroyed))
  assert.ok(source._terrainAppearance.waterBorder)
  assert.equal(h.map.grid[1000][1000].isGenerationCell, true)
  h.bake.destroy()
  assert.ok(h.textures.every(texture => texture.destroyed && texture.sourceDestroyed))
  assert.equal(h.map.children.length, 0)
})

test('an elevated cell whose grid origin is outside the tile is included', () => {
  const h = setup()
  h.map.grid[100][100] = h.makeCell(100, 100, 195)
  h.bake.bakeTerrainToChunks()
  h.bake.updateViewport(viewport)
  assert.ok(h.made.some(cell => cell.i === 100))
})

test('failed renderer releases temporary cells and the owned texture', () => {
  const h = setup()
  h.bake.bakeTerrainToChunks()
  h.map.fail = true
  assert.throws(() => h.bake.updateViewport(viewport), /render failed/)
  assert.ok(h.made.every(cell => cell.destroyed))
  assert.ok(h.textures.every(texture => texture.destroyed && texture.sourceDestroyed))
  assert.equal(h.bake.textureCache.bytes, 0)
})

test('floor decorations survive eviction and rebaking without retaining their original sprites', () => {
  const h = setup()
  const source = h.map.grid[1][1]
  const texture = { width: 64, height: 32 }
  const floor = new h.Sprite(texture)
  floor.label = 'floor'
  floor.anchor = { x: 0.5, y: 0.5 }
  floor.position = { x: 10, y: 20 }
  floor.zIndex = 2
  let floors = [floor]
  source.getTerrainDecorations = () => floors
  source.removeChild = child => {
    floors = floors.filter(floor => floor !== child)
  }
  h.bake.bakeTerrainToChunks()
  assert.equal(floor.destroyed, true)
  h.bake.updateViewport(viewport)
  const hasFloor = () => h.rendered.some(children => children.some(child => child.texture === texture))
  assert.equal(hasFloor(), true)
  h.bake.textureCache.destroy()
  h.rendered.length = 0
  h.bake.updateViewport(viewport)
  assert.equal(hasFloor(), true)
  h.bake.bakeTerrainToChunks()
  h.rendered.length = 0
  h.bake.updateViewport(viewport)
  assert.equal(hasFloor(), true)
})
