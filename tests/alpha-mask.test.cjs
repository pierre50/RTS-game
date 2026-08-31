const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

const { texturesHaveOpaqueOverlap } = loadModule('app/lib/graphics/alphaMask.ts')

function makeTexture(id) {
  return { id }
}

function makeRenderer(textures) {
  const outputs = new Map()
  for (const [texture, alphaRows] of textures) {
    const height = alphaRows.length
    const width = alphaRows[0].length
    const pixels = new Uint8ClampedArray(width * height * 4)
    alphaRows.forEach((row, y) => {
      row.forEach((alpha, x) => {
        pixels[(y * width + x) * 4 + 3] = alpha
      })
    })
    outputs.set(texture, { pixels, width, height })
  }

  const renderer = {
    calls: 0,
    extract: {
      pixels(texture) {
        renderer.calls += 1
        return outputs.get(texture)
      },
    },
  }
  return renderer
}

test('alpha mask ignores overlaps where only the sprite rectangles touch', () => {
  const frontTexture = makeTexture('tree')
  const heroTexture = makeTexture('hero')
  const renderer = makeRenderer([
    [
      frontTexture,
      [
        [0, 0, 255, 255],
        [0, 0, 255, 255],
        [0, 0, 255, 255],
        [0, 0, 255, 255],
      ],
    ],
    [
      heroTexture,
      [
        [255, 255, 0, 0],
        [255, 255, 0, 0],
        [255, 255, 0, 0],
        [255, 255, 0, 0],
      ],
    ],
  ])
  const bounds = { minX: 0, minY: 0, width: 40, height: 40 }

  assert.equal(texturesHaveOpaqueOverlap(frontTexture, bounds, heroTexture, bounds, renderer), false)
  assert.equal(renderer.calls, 2)
})

test('alpha mask detects overlap between opaque pixels in both sprites', () => {
  const frontTexture = makeTexture('tree')
  const heroTexture = makeTexture('hero')
  const renderer = makeRenderer([
    [
      frontTexture,
      [
        [0, 0, 255, 255],
        [0, 0, 255, 255],
        [0, 0, 255, 255],
        [0, 0, 255, 255],
      ],
    ],
    [
      heroTexture,
      [
        [0, 0, 255, 255],
        [0, 0, 255, 255],
        [0, 0, 255, 255],
        [0, 0, 255, 255],
      ],
    ],
  ])
  const bounds = { minX: 0, minY: 0, width: 40, height: 40 }

  assert.equal(texturesHaveOpaqueOverlap(frontTexture, bounds, heroTexture, bounds, renderer), true)
})

test('alpha mask reads texture source pixels before using renderer extraction', () => {
  const previousDocument = global.document
  const source = { label: 'atlas' }
  const makeSourceTexture = (id, alphaRows, frameX = 0) => {
    const height = alphaRows.length
    const width = alphaRows[0].length
    const pixels = new Uint8ClampedArray(width * height * 4)
    alphaRows.forEach((row, y) => {
      row.forEach((alpha, x) => {
        pixels[(y * width + x) * 4 + 3] = alpha
      })
    })

    return {
      id,
      frame: { x: frameX, y: 0, width, height },
      rotate: 0,
      source: { resource: source, resolution: 1 },
      testPixels: pixels,
    }
  }

  global.document = {
    createElement() {
      const canvas = {
        width: 0,
        height: 0,
        getContext() {
          return {
            clearRect() {},
            drawImage(resource, sourceX, sourceY, width, height) {
              assert.equal(resource, source)
              assert.equal(sourceY, 0)
              assert.equal(width, canvas.width)
              assert.equal(height, canvas.height)
              this.sourceX = sourceX
            },
            getImageData() {
              return { data: this.sourceX === 0 ? frontTexture.testPixels : heroTexture.testPixels }
            },
          }
        },
      }
      return canvas
    },
  }

  const frontTexture = makeSourceTexture('tree', [
    [0, 0, 255, 255],
    [0, 0, 255, 255],
    [0, 0, 255, 255],
    [0, 0, 255, 255],
  ])
  const heroTexture = makeSourceTexture(
    'hero',
    [
      [255, 255, 0, 0],
      [255, 255, 0, 0],
      [255, 255, 0, 0],
      [255, 255, 0, 0],
    ],
    10
  )
  const bounds = { minX: 0, minY: 0, width: 40, height: 40 }
  const renderer = makeRenderer([])

  try {
    assert.equal(texturesHaveOpaqueOverlap(frontTexture, bounds, heroTexture, bounds, renderer), false)
    assert.equal(renderer.calls, 0)
  } finally {
    global.document = previousDocument
  }
})

test('alpha mask keeps previous rectangle behavior when pixels cannot be extracted', () => {
  const frontTexture = makeTexture('tree')
  const heroTexture = makeTexture('hero')
  const bounds = { minX: 0, minY: 0, width: 40, height: 40 }
  const renderer = { extract: { pixels: () => null } }

  assert.equal(texturesHaveOpaqueOverlap(frontTexture, bounds, heroTexture, bounds, renderer), true)
})
