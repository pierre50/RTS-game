const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadSelection() {
  const filename = path.join(__dirname, '../app/lib/graphics/selection.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    'pixi.js': {
      Graphics: class {
        constructor() {
          this.alpha = 1
          this.label = ''
          this.position = { y: 0 }
        }
        closePath() {}
        lineTo() {}
        moveTo() {}
        stroke() {}
      },
    },
    '../../constants': {
      COLOR_GREEN: 0x00ff00,
      LABEL_TYPES: { selection: 'selection' },
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('blinking selection marker tracks visual relief lift', () => {
  const { drawInstanceBlinkingSelection } = loadSelection()
  const children = []
  const instance = {
    reliefLift: -24,
    selectionFactor: 0.5,
    addChildAt(child, index) {
      children.splice(index, 0, child)
    },
    removeChild(child) {
      const index = children.indexOf(child)
      if (index >= 0) children.splice(index, 1)
    },
  }

  drawInstanceBlinkingSelection(instance)

  assert.equal(children[0].position.y, -24)
})
