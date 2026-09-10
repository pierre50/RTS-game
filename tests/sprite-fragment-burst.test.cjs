const assert = require('node:assert/strict')
const test = require('node:test')
const { Container, Sprite, Texture, TextureSource, Rectangle } = require('pixi.js')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

class OutlineFilter {
  constructor(options) {
    this.options = options
    this.destroyed = false
  }
  destroy() {
    this.destroyed = true
  }
}

const { spawnSpriteFragmentBurst } = loadTsModule('app/lib/entities/spriteFragmentBurst.ts', {
  mocks: {
    '../../constants': { CELL_WIDTH: 64, CELL_HEIGHT: 32 },
    'pixi-filters': { OutlineFilter },
  },
})

function burst(alphaAt, { resolution = 1, extractionFails = false } = {}) {
  const width = 16 * resolution
  const height = 8 * resolution
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels[(y * width + x) * 4 + 3] = alphaAt(x / resolution, y / resolution)
    }
  }
  const source = new TextureSource({ width: 16, height: 8 })
  const texture = new Texture({ source, frame: new Rectangle(0, 0, 16, 8) })
  const sprite = new Sprite(texture)
  const layer = new Container()
  let tick
  let removed = false
  const context = {
    app: {
      renderer: {
        extract: {
          pixels: () => {
            if (extractionFails) throw new Error('unavailable')
            return { pixels, width, height }
          },
        },
      },
    },
    scheduler: {
      add: callback => {
        tick = callback
        return 1
      },
      remove: () => {
        removed = true
      },
    },
  }
  spawnSpriteFragmentBurst({ context, host: { x: 0, y: 0 }, sprite, layer, fragmentSize: 8, random: () => 0.5 })
  return {
    layer,
    source,
    texture,
    hasAnimation: () => Boolean(tick),
    finish: () => {
      for (let i = 0; i < 100 && !removed; i++) tick()
      return removed
    },
  }
}

test('empty, faint and sparsely occupied tiles do not spawn fragments', () => {
  for (const alphaAt of [() => 0, () => 127, (x, y) => (x === 0 && y === 0 ? 255 : 0)]) {
    const result = burst(alphaAt)
    assert.equal(result.layer.children.length, 0)
    assert.equal(result.hasAnimation(), false)
  }
})

test('coverage accepts half-full tiles and rejects nearly empty neighbors at either resolution', () => {
  for (const resolution of [1, 2]) {
    const result = burst(x => (x < 4 || x >= 15 ? 255 : 0), { resolution })
    assert.equal(result.layer.children.length, 1)
    const visual = result.layer.children[0]
    assert.equal(visual.x, 4)
    assert.equal(visual.children[0].texture.frame.x, 0)
  }
})

test('outlining uses the masked sprite alpha instead of a rectangular stroke and cleans up', () => {
  const result = burst((x, y) => (x < 8 && !(x >= 2 && x < 4 && y >= 2 && y < 4) ? 255 : 0))
  const visual = result.layer.children[0]
  assert.equal(result.layer.children.length, 1)
  assert.equal(visual.children.length, 2)
  const [image, mask] = visual.children
  assert.equal(image.mask, mask)
  const [outline] = visual.filters
  assert.ok(outline instanceof OutlineFilter)
  assert.equal(outline.options.thickness, 1)
  assert.equal(outline.options.color, 0)
  const fragmentTexture = image.texture
  assert.equal(result.finish(), true)
  assert.equal(result.layer.children.length, 0)
  assert.equal(outline.destroyed, true)
  assert.equal(fragmentTexture.destroyed, true)
  assert.equal(result.texture.destroyed, false)
  assert.equal(result.source.destroyed, false)
})

test('failed alpha extraction never falls back to random transparent tiles', () => {
  const result = burst(() => 255, { extractionFails: true })
  assert.equal(result.layer.children.length, 0)
  assert.equal(result.hasAnimation(), false)
})
