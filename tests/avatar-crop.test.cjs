const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const textures = [],
    colors = [],
    draws = []
  class Rectangle {
    constructor(x, y, width, height) {
      Object.assign(this, { x, y, width, height })
    }
  }
  class Texture {
    constructor(options) {
      Object.assign(this, options)
      textures.push(this)
    }
    destroy(source) {
      this.destroyed = true
      this.destroyedSource = source
    }
  }
  const api = loadTsModule('app/lib/graphics/avatarCrop.ts', {
    mocks: {
      'pixi.js': { Rectangle, Texture },
      './colors': { recolorCanvasPixels: (...args) => colors.push(args) },
    },
  })
  const pixels = new Uint8ClampedArray(8 * 8 * 4)
  pixels[(3 * 8 + 2) * 4 + 3] = 255
  const drawing = { clearRect: () => {}, drawImage: (...args) => draws.push(args) }
  const canvas = { width: 32, height: 32, getContext: () => drawing }
  const texture = { source: {}, frame: new Rectangle(40, 80, 8, 8), width: 8, height: 8 }
  const extracted = {}
  const app = {
    renderer: {
      extract: {
        pixels: () => ({ pixels, width: 8, height: 8 }),
        canvas: () => extracted,
      },
    },
  }
  return { ...api, Rectangle, app, pixels, texture, canvas, textures, colors, draws, extracted }
}

test('portrait bounds ignore transparent pixels and preserve the alpha threshold', () => {
  const f = fixture()
  assert.deepEqual(f.findOpaqueSquare(f.pixels, 8, 8), new f.Rectangle(2, 3, 1, 1))
  f.pixels.fill(16)
  assert.equal(f.findOpaqueSquare(f.pixels, 8, 8), null)
  assert.equal(f.findOpaqueSquare(new Uint8ClampedArray(), 8, 8), null)
})

test('texture portraits crop atlas coordinates, recolor and release temporary textures', () => {
  const f = fixture()
  assert.equal(f.extractSquareAvatar(f.app, f.texture, f.texture.frame, f.canvas, 'red', [1]), true)
  assert.equal(f.textures.length, 2)
  assert.deepEqual(f.textures[1].frame, new f.Rectangle(42, 83, 1, 1))
  for (const texture of f.textures) {
    assert.equal(texture.source, f.texture.source)
    assert.equal(texture.destroyed, true)
    assert.equal(texture.destroyedSource, false)
  }
  assert.deepEqual(f.draws[0], [f.extracted, 0, 0, 1, 1, 0, 0, 32, 32])
  assert.deepEqual(f.colors, [[f.canvas, 'red', [1]]])
  assert.deepEqual(f.texture.frame, new f.Rectangle(40, 80, 8, 8))
})

test('portrait extraction releases textures when readback throws or the canvas is unavailable', () => {
  for (const stage of ['pixels', 'canvas']) {
    const f = fixture()
    f.app.renderer.extract[stage] = () => {
      throw new Error('readback')
    }
    assert.throws(() => f.extractSquareAvatar(f.app, f.texture, f.texture.frame, f.canvas, 'red', []), /readback/)
    assert.ok(f.textures.every(texture => texture.destroyed && !texture.destroyedSource))
  }
  const f = fixture()
  f.canvas.getContext = () => null
  assert.equal(f.extractSquareAvatar(f.app, f.texture, f.texture.frame, f.canvas, 'red', []), false)
  assert.ok(f.textures.every(texture => texture.destroyed))
})

test('canvas portraits clamp empty scans and tolerate unavailable drawing contexts', () => {
  const f = fixture(),
    scans = []
  const source = {
    width: 8,
    height: 8,
    getContext: () => ({
      getImageData: (...args) => {
        scans.push(args)
        return { data: new Uint8ClampedArray(8 * 8 * 4) }
      },
    }),
  }
  assert.equal(f.extractSquareCanvasAvatar(source, 100, f.canvas, 'blue', []), true)
  assert.deepEqual(scans[0], [0, 0, 8, 8])
  assert.deepEqual(f.draws[0], [source, 0, 0, 8, 8, 0, 0, 32, 32])
  f.canvas.getContext = () => null
  assert.equal(f.extractSquareCanvasAvatar(source, 0, f.canvas, 'blue', []), false)
  assert.deepEqual(scans[1], [0, 0, 8, 1])
  source.getContext = () => null
  assert.equal(f.extractSquareCanvasAvatar(source, 8, f.canvas, 'blue', []), false)
})
