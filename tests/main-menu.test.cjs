const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadMainMenu({ saveEntries }) {
  const filename = path.join(__dirname, '../app/screens/MainMenu.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  let saveListOptions = null
  const mocks = {
    '../lib/audio/uiSound': { playClickSound() {} },
    '../lib/lang': { t: key => key },
    '../ui/modals/settingsPanel': { openSettingsModal() {} },
    '../ui/modals/saveListModal': {
      openSaveListModal(options) {
        saveListOptions = options
      },
    },
    '../serialization/SaveStorage': {
      listSaves: () => saveEntries,
      loadSave: key => ({ key }),
    },
  }
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return { MainMenu: module.exports.default, getSaveListOptions: () => saveListOptions }
}

function makeElement(tagName) {
  const element = {
    tagName,
    id: '',
    className: '',
    textContent: '',
    alt: '',
    decoding: '',
    fetchPriority: '',
    complete: true,
    children: [],
    listeners: new Map(),
    classList: {
      add() {},
      remove() {},
    },
    appendChild(child) {
      this.children.push(child)
      return child
    },
    remove() {},
    focus() {},
    addEventListener(type, handler) {
      this.listeners.set(type, handler)
    },
    querySelectorAll(selector) {
      if (selector !== '.menu-panel--home .home-btn') return []
      const matches = []
      const visit = node => {
        if (typeof node.className === 'string' && node.className.split(' ').includes('home-btn')) matches.push(node)
        node.children?.forEach(visit)
      }
      visit(this)
      return matches
    },
  }

  Object.defineProperty(element, 'innerHTML', {
    get() {
      return ''
    },
    set() {
      this.children = []
    },
  })

  if (tagName === 'button') {
    element.click = () => element.listeners.get('click')?.({})
  }

  return element
}

test('main menu refreshes continue button when save list changes', () => {
  const previousDocument = global.document
  const previousRequestAnimationFrame = global.requestAnimationFrame

  const body = makeElement('body')
  global.document = {
    body,
    activeElement: null,
    createElement: makeElement,
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
  }
  global.requestAnimationFrame = callback => callback()

  try {
    const saves = [{ key: 'save_1', name: 'Save 1', date: 1 }]
    const { MainMenu, getSaveListOptions } = loadMainMenu({ saveEntries: saves })
    const menu = new MainMenu({ onStart() {}, onLoad() {} })

    assert.deepEqual(
      menu._getHomeButtons().map(button => button.textContent),
      ['continueGame', 'newGame', 'loadGame', 'settings', 'quit']
    )

    menu._getHomeButtons()[2].click()
    saves.length = 0
    getSaveListOptions().onChange()

    assert.deepEqual(
      menu._getHomeButtons().map(button => button.textContent),
      ['newGame', 'loadGame', 'settings', 'quit']
    )
  } finally {
    global.document = previousDocument
    global.requestAnimationFrame = previousRequestAnimationFrame
  }
})

test('main menu quit button exits through electron bridge', () => {
  const previousDocument = global.document
  const previousRequestAnimationFrame = global.requestAnimationFrame
  const previousWindow = global.window

  let didQuit = false
  const body = makeElement('body')
  global.document = {
    body,
    activeElement: null,
    createElement: makeElement,
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
  }
  global.requestAnimationFrame = callback => callback()
  global.window = {
    electronApp: {
      quit() {
        didQuit = true
      },
    },
    close() {
      throw new Error('window.close should not be used when electronApp is available')
    },
  }

  try {
    const { MainMenu } = loadMainMenu({ saveEntries: [] })
    const menu = new MainMenu({ onStart() {}, onLoad() {} })

    assert.deepEqual(
      menu._getHomeButtons().map(button => button.textContent),
      ['newGame', 'loadGame', 'settings', 'quit']
    )

    menu._getHomeButtons()[3].click()

    assert.equal(didQuit, true)
  } finally {
    global.document = previousDocument
    global.requestAnimationFrame = previousRequestAnimationFrame
    global.window = previousWindow
  }
})
