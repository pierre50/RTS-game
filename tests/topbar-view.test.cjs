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
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function makeClassList() {
  const classes = new Set()
  return {
    add: (...items) => items.forEach(item => classes.add(item)),
    contains: item => classes.has(item),
    remove: (...items) => items.forEach(item => classes.delete(item)),
  }
}

function makeElement() {
  return {
    appendChild(child) {
      this.children.push(child)
      return child
    },
    children: [],
    classList: makeClassList(),
    className: '',
    id: '',
    prepend(child) {
      this.children.unshift(child)
      return child
    },
    remove() {},
    src: '',
    textContent: '',
  }
}

function withFakeDocument(fn) {
  const previousDocument = global.document
  global.document = { createElement: () => makeElement() }
  try {
    return fn()
  } finally {
    global.document = previousDocument
  }
}

test('topbar displays and themes all civilization ages', () => {
  withFakeDocument(() => {
    const { TopbarView } = loadModule('app/ui/TopbarView.ts', {
      './utils/resourceIcons': {
        createResourceIconMaps: () => ({
          icons: { wood: 'wood.png', food: 'food.png' },
          infoIcons: {},
        }),
      },
    })
    const player = {
      age: 0,
      wood: 99,
      food: 99,
    }
    const menu = {
      context: {
        player,
        dayNight: {
          getDayLabel: () => 'Jour 3',
          getTimeLabel: () => '06:15',
        },
      },
      gameHud: makeElement(),
      pauseMenu: { createOpenButton: () => makeElement() },
    }
    const topbar = new TopbarView(menu)
    topbar.build()

    for (const [age, label] of [
      [0, 'stoneAge'],
      [1, 'bronzeAge'],
      [2, 'ironAge'],
    ]) {
      player.age = age
      topbar.update()
      assert.equal(menu.gameHud.classList.contains(`ui-age-${age}`), true)
    }
    assert.equal(menu.icons.wood, 'wood.png')
    assert.equal(menu.gameHud.children.length, 2)
    assert.equal(menu.gameHud.children[1].className, 'topbar-options')
    assert.equal(menu.gameHud.children[1].children.length, 1)
    assert.equal(menu.gameHud.children[0].className, 'topbar-daytime hud-info-panel')
    assert.equal(menu.gameHud.children[0].textContent, 'Jour 3 - 06:15')
    assert.equal(menu.topbar, undefined)
  })
})
