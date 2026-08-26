const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

class MockContainer {
  constructor() {
    this.children = []
  }

  addChild(...children) {
    this.children.push(...children)
  }
}

class MockText {
  constructor(options) {
    this.text = options.text
    this.style = options.style
    this.anchor = { set: () => {} }
    this.width = options.text.length * 6
    this.height = options.style.fontSize
  }
}

test('status expression draws large colored text without a retro speech box', () => {
  const { createStatusBubble } = loadModule('app/lib/entities/statusBubble.ts', {
    'pixi.js': { Container: MockContainer, Text: MockText },
  })

  const bubble = createStatusBubble({ text: 'zzz', fontSize: 13 })
  const [text] = bubble.children

  assert.equal(bubble.children.length, 1)
  assert.equal(text.text, 'zzz')
  assert.equal(text.style.fill, 0x69b7ff)
  assert.equal(text.style.fontFamily, 'm6x11, system-ui, sans-serif')
  assert.equal(text.style.fontSize, 21)
  assert.deepEqual(text.style.stroke, { color: 0x20140b, width: 3 })
})

test('status expression colors alerts in yellow', () => {
  const { createStatusBubble } = loadModule('app/lib/entities/statusBubble.ts', {
    'pixi.js': { Container: MockContainer, Text: MockText },
  })

  const expression = createStatusBubble({ text: '!', fontSize: 14 })
  const [text] = expression.children

  assert.equal(text.style.fill, 0xffd747)
  assert.equal(text.style.fontSize, 22)
})

test('status expression colors fatigue as bright blue', () => {
  const { createStatusBubble } = loadModule('app/lib/entities/statusBubble.ts', {
    'pixi.js': { Container: MockContainer, Text: MockText },
  })

  const expression = createStatusBubble({ text: '...', fontSize: 13 })
  const [text] = expression.children

  assert.equal(text.style.fill, 0xc7f0ff)
})
