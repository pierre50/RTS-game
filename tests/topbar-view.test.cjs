const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

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
    return require(request)
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
      '../constants': { RESOURCE_NAMES: ['wood', 'food'] },
      '../lib/lang': { t: key => key },
      '../lib/villagerAssignments': {
        summarizeVillagerAssignments: units => ({
          total: units.length,
          assigned: { wood: units.filter(unit => unit.work === 'woodcutter').length, food: 0 },
        }),
      },
      './resourceIcons': {
        createResourceIconMaps: () => ({
          icons: { wood: 'wood.png', food: 'food.png' },
          infoIcons: {},
        }),
      },
    })
    const player = { age: 0, wood: 12, food: 5, units: [{ work: 'woodcutter' }, { work: 'idle' }] }
    const menu = {
      context: { player },
      gameHud: makeElement(),
      pauseMenu: { createOpenButton: () => makeElement() },
    }
    const topbar = new TopbarView(menu)
    topbar.build()

    for (const [age, label] of [
      [0, 'stoneAge'],
      [1, 'toolAge'],
      [2, 'bronzeAge'],
      [3, 'ironAge'],
    ]) {
      player.age = age
      topbar.update()
      assert.equal(menu.age.textContent, label)
      assert.equal(menu.gameHud.classList.contains(`ui-age-${age}`), true)
    }
    assert.equal(topbar.resourceEls.wood.textContent, '12')
    assert.equal(topbar.resourceWorkerEls.wood.textContent, ' (1)')
    assert.equal(topbar.villagerTotalEl.textContent, 'V: 2')
  })
})
