const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadPauseMenu() {
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
  }
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.PauseMenu
}

function makeFakeButton() {
  const listeners = new Map()
  return {
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
      listeners.get(type)?.({})
    },
  }
}

test('pause menu open button clears click focus before opening', () => {
  const previousDocument = global.document
  const fakeButton = makeFakeButton()
  global.document = { createElement: () => fakeButton }

  try {
    const PauseMenu = loadPauseMenu()
    const pauseMenu = new PauseMenu({ context: {} })
    let openCalls = 0
    pauseMenu.open = () => {
      assert.equal(fakeButton.blurCalls, 1)
      openCalls++
    }

    const button = pauseMenu.createOpenButton()
    button.dispatch('click')

    assert.equal(openCalls, 1)
    assert.equal(button.blurCalls, 1)
  } finally {
    global.document = previousDocument
  }
})
