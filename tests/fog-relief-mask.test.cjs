const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadFogRenderer() {
  const filename = path.join(__dirname, '../app/classes/map/fog/ViewportFogRenderer.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  const module = { exports: {} }
  const mocks = {
    'pixi.js': {
      Container: class {},
      Graphics: class {},
      Matrix: class {},
      RenderTexture: { create: () => ({}) },
      Sprite: class {},
      TilingSprite: class {},
    },
    '../../constants': { CELL_HEIGHT: 32, CELL_WIDTH: 64 },
    '../../lib': { isometricToCartesian: () => [0, 0] },
    '../cell/CellFog': { getFogPatternTexture: () => ({}) },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { getFogRevealShape } = loadFogRenderer()

test('flat fog reveal shape stays centered on the cell', () => {
  assert.deepEqual(getFogRevealShape({ x: 100, y: 200 }, 32, 16), {
    x: 100,
    y: 200,
    rx: 32,
    ry: 16,
  })
})

test('relief fog reveal shape covers the lowered underlay', () => {
  assert.deepEqual(
    getFogRevealShape({ x: 100, y: 200, _terrainAppearance: { relief: { elevation: 16 } } }, 32, 16),
    {
      x: 100,
      y: 208,
      rx: 32,
      ry: 24,
    }
  )
})
