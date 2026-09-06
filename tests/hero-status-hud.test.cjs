const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function makeElement(tagName) {
  const children = []
  const classes = new Set()
  const element = {
    tagName,
    children,
    className: '',
    parentNode: null,
    textWrites: 0,
    style: {
      properties: {},
      writes: [],
      setProperty(name, value) {
        this.properties[name] = value
        this.writes.push([name, value])
      },
    },
    classList: {
      add(name) {
        classes.add(name)
      },
      remove(name) {
        classes.delete(name)
      },
      contains(name) {
        return classes.has(name)
      },
    },
    appendChild(child) {
      children.push(child)
      child.parentNode = element
      return child
    },
    remove() {
      if (!element.parentNode) return
      const siblings = element.parentNode.children
      const index = siblings.indexOf(element)
      if (index >= 0) siblings.splice(index, 1)
      element.parentNode = null
    },
  }
  let textContent = ''
  Object.defineProperty(element, 'textContent', {
    get() {
      return textContent
    },
    set(value) {
      textContent = value
      element.textWrites++
    },
  })
  return element
}

function installDom() {
  const previousDocument = global.document
  const previousPerformance = global.performance
  let now = 0
  global.document = {
    createElement: tagName => makeElement(tagName),
  }
  global.performance = {
    now: () => now,
  }
  return {
    setNow: value => {
      now = value
    },
    restore: () => {
      global.document = previousDocument
      global.performance = previousPerformance
    },
  }
}

function loadHeroStatusHud() {
  const filename = path.join(__dirname, '../app/ui/HeroStatusHud.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../lib/avatar': { renderUnitHeadAvatar: () => {} },
    '../lib/lang': { t: key => (key === 'levelShort' ? 'Lvl' : key) },
    '../lib/units/unitExperience': { getUnitOverallLevel: unit => unit.level ?? 0 },
  }
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.HeroStatusHud
}

function makeHero(overrides = {}) {
  return {
    energy: 6.1,
    hitPoints: 20,
    level: 0,
    name: 'Aster',
    totalEnergy: 12,
    totalHitPoints: 20,
    type: 'Hero',
    ...overrides,
  }
}

test('hero status hud avoids full redraws during fractional energy regen', () => {
  const dom = installDom()
  try {
    const HeroStatusHud = loadHeroStatusHud()
    const menu = { context: { app: {} }, gameHud: makeElement('div') }
    const hud = new HeroStatusHud(menu)
    const hero = makeHero()

    hud.setHero(hero)

    const initialTitleWrites = hud.title.textWrites
    const initialLevelWrites = hud.level.textWrites
    const initialHealthTextWrites = hud.value.textWrites
    const initialEnergyTextWrites = hud.energyValue.textWrites
    const initialHealthStyleWrites = hud.healthBar.style.writes.length
    const initialEnergyStyleWrites = hud.energyBar.style.writes.length
    assert.equal(hud.energyBar.children.length, 1)

    hero.energy = 6.2
    dom.setNow(16)
    hud.update(hero)

    assert.equal(hud.title.textWrites, initialTitleWrites)
    assert.equal(hud.level.textWrites, initialLevelWrites)
    assert.equal(hud.value.textWrites, initialHealthTextWrites)
    assert.equal(hud.energyValue.textWrites, initialEnergyTextWrites)
    assert.equal(hud.healthBar.style.writes.length, initialHealthStyleWrites)
    assert.equal(hud.energyBar.style.writes.length, initialEnergyStyleWrites + 1)
    assert.equal(hud.energyBar.style.properties['--hero-energy-percent'], '51.67%')
  } finally {
    dom.restore()
  }
})

test('hero status hud updates energy text only when the displayed value changes', () => {
  const dom = installDom()
  try {
    const HeroStatusHud = loadHeroStatusHud()
    const menu = { context: { app: {} }, gameHud: makeElement('div') }
    const hud = new HeroStatusHud(menu)
    const hero = makeHero({ energy: 6.8 })

    hud.setHero(hero)
    const initialEnergyTextWrites = hud.energyValue.textWrites

    hero.energy = 7
    dom.setNow(16)
    hud.update(hero)

    assert.equal(hud.energyValue.textWrites, initialEnergyTextWrites + 1)
    assert.equal(hud.energyValue.textContent, '7/12')
  } finally {
    dom.restore()
  }
})
