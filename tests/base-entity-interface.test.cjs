const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadBaseEntityInterface() {
  const filename = path.join(__dirname, '../app/ui/BaseEntityInterface.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../constants': {
      MENU_INFO_IDS: { hitPoints: 'hit-points' },
    },
    '../lib/hitPointsText': {
      formatHitPointsText: (hitPoints, totalHitPoints) => {
        if (hitPoints === '') return ''
        const current = Number(hitPoints)
        const max = Number(totalHitPoints)
        return `${Number.isFinite(current) ? Math.round(current) : 0}/${Number.isFinite(max) ? Math.round(max) : 0}`
      },
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

class MockElement {
  constructor(tagName) {
    this.tagName = tagName
    this.children = []
    this.parentElement = null
    this.textContent = ''
    this.className = ''
    this.styles = new Map()
    this.style = {
      width: '',
      setProperty: (key, value) => this.styles.set(key, value),
    }
    this.classList = {
      add: (...names) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean))
        names.forEach(name => classes.add(name))
        this.className = [...classes].join(' ')
      },
      remove: (...names) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean))
        names.forEach(name => classes.delete(name))
        this.className = [...classes].join(' ')
      },
      contains: name => this.className.split(/\s+/).includes(name),
    }
  }

  appendChild(child) {
    child.parentElement = this
    this.children.push(child)
    return child
  }

  closest(selector) {
    const className = selector.startsWith('.') ? selector.slice(1) : selector
    let current = this
    while (current) {
      if (current.classList.contains(className)) return current
      current = current.parentElement
    }
    return null
  }

  querySelector(selector) {
    const className = selector.startsWith('.') ? selector.slice(1) : selector
    const queue = [...this.children]
    while (queue.length) {
      const current = queue.shift()
      if (current.classList.contains(className)) return current
      queue.push(...current.children)
    }
    return null
  }
}

function withMockDocument(callback) {
  const previousDocument = global.document
  global.document = {
    createElement: tagName => new MockElement(tagName),
  }
  try {
    callback()
  } finally {
    global.document = previousDocument
  }
}

test('hit point info syncs the display after it is attached to its wrapper', () => {
  withMockDocument(() => {
    const { createHitPointsInfo } = loadBaseEntityInterface()
    const wrapper = createHitPointsInfo('hit-points', 1, 300)

    assert.equal(wrapper.styles.get('--entity-hit-points-percent'), `${(1 / 300) * 100}%`)
    assert.equal(wrapper.querySelector('.hit-points').textContent, '1/300')
  })
})

test('hit point info syncs full health to a full bar', () => {
  withMockDocument(() => {
    const { createHitPointsInfo } = loadBaseEntityInterface()
    const wrapper = createHitPointsInfo('hit-points', 300, 300)

    assert.equal(wrapper.styles.get('--entity-hit-points-percent'), '100%')
  })
})

test('hit point info rounds decimal health for display', () => {
  withMockDocument(() => {
    const { createHitPointsInfo } = loadBaseEntityInterface()
    const wrapper = createHitPointsInfo('hit-points', 1.5, 100)

    assert.equal(wrapper.querySelector('.hit-points').textContent, '2/100')
  })
})
