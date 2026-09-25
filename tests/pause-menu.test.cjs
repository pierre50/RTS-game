const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadPauseMenu(overrides = {}) {
  const filename = path.join(__dirname, '../app/ui/PauseMenu.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  const mocks = {
    '../lib': { Modal: class Modal {} },
    '../lib/audio/uiSound': { playClickSound() {} },
    '../lib/lang': { t: key => key },
    './modals/settingsPanel': { openSettingsModal() {} },
    './modals/saveListModal': { openSaveListModal() {} },
    ...overrides,
  }
  const module = { exports: {} }
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.PauseMenu
}

function makeFakeButton() {
  const listeners = new Map()
  return {
    children: [],
    attributes: {},
    appendChild(child) {
      this.children.push(child)
      return child
    },
    setAttribute(name, value) {
      this.attributes[name] = value
    },
    type: '',
    className: '',
    innerText: '',
    blurCalls: 0,
    addEventListener(type, handler) {
      listeners.set(type, handler)
    },
    blur() {
      this.blurCalls++
    },
    dispatch(type) {
      return listeners.get(type)?.({})
    },
  }
}

test('pause menu open button clears click focus before opening', () => {
  const previousDocument = global.document
  const fakeButton = makeFakeButton()
  global.document = { createElement: tag => (tag === 'button' ? fakeButton : makeFakeButton()) }

  try {
    const PauseMenu = loadPauseMenu()
    const pauseMenu = new PauseMenu({ context: {} })
    let openCalls = 0
    pauseMenu.open = () => {
      assert.equal(fakeButton.blurCalls, 1)
      openCalls++
    }

    const button = pauseMenu.createOpenButton()
    assert.equal(button.attributes['aria-label'], 'menuBtn')
    assert.equal(button.children[0].children.length, 3)
    button.dispatch('click')

    assert.equal(openCalls, 1)
    assert.equal(button.blurCalls, 1)
  } finally {
    global.document = previousDocument
  }
})

test('manual save waits for publication and reports the real failure without showing success', async () => {
  const previousDocument = global.document
  const previousError = console.error
  const errors = []
  const messages = []
  let modalOptions
  let closed = 0
  let finishSave
  global.document = { createElement: () => makeFakeButton() }
  console.error = (...args) => errors.push(args)
  try {
    const PauseMenu = loadPauseMenu({
      '../lib': {
        Modal: class {
          constructor(options) {
            modalOptions = options
          }
          close() {
            closed++
          }
        },
      },
    })
    const context = {
      paused: true,
      save: () =>
        new Promise((resolve, reject) => {
          finishSave = { resolve, reject }
        }),
    }
    const menu = new PauseMenu({ context, showMessage: (...args) => messages.push(args) })
    menu.open()
    const button = modalOptions.content.children[0]
    const pending = button.dispatch('click')
    assert.equal(button.disabled, true)
    assert.equal(closed, 0)
    assert.deepEqual(messages, [])
    finishSave.reject(new Error('SAVE_BUSY'))
    await pending
    assert.equal(closed, 0)
    assert.equal(button.disabled, false)
    assert.equal(messages[0][0], 'saveFailed')
    assert.match(errors[0][0], /Manual save failed: SAVE_BUSY/)
    const retry = button.dispatch('click')
    finishSave.resolve({ key: 'save_1', name: 'test' })
    await retry
    assert.equal(closed, 1)
    assert.equal(messages[1][0], 'saveSuccess')
  } finally {
    global.document = previousDocument
    console.error = previousError
  }
})
