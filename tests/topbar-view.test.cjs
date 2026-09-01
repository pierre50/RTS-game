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
      '../constants': { RESOURCE_NAMES: ['wood', 'food'] },
      '../lib/lang': { t: key => key },
      '../lib/resources/playerResourceTotals': {
        getPlayerResourceTotals: player => ({
          wood: player.buildings.reduce((total, building) => total + (building.inventory?.resources?.wood ?? 0), 0),
          food:
            player.buildings.reduce((total, building) => total + (building.inventory?.resources?.food ?? 0), 0) +
            (player.units[0].inventory?.resources?.food ?? 0),
        }),
      },
      '../lib/units/villagerAssignments': {
        summarizeVillagerAssignments: units => ({
          total: units.length,
          assigned: { wood: units.filter(unit => unit.work === 'woodcutter').length, food: 0 },
        }),
      },
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
      units: [{ work: 'woodcutter', inventory: { resources: { food: 4 } } }, { work: 'idle' }],
      buildings: [
        { inventory: { resources: { wood: 7, food: 2 } } },
        { inventory: { resources: { wood: 5, food: 3 } } },
      ],
    }
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
    assert.equal(topbar.resourceEls.food.textContent, '9')
    assert.equal(topbar.resourceWorkerEls.wood.textContent, ' (1)')
    assert.equal(topbar.villagerTotalEl.textContent, 'V: 2')
  })
})
