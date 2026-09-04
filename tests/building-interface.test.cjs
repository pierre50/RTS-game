const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadBuildingInterface() {
  const filename = path.join(__dirname, '../app/ui/entity/BuildingInterface.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../../constants': {
      BUILDING_TYPES: { chest: 'Chest', stable: 'Stable', trap: 'Trap' },
      MENU_INFO_IDS: {
        civ: 'civ',
        hitPoints: 'hit-points',
        population: 'population',
        populationText: 'population-text',
        quantity: 'quantity',
        quantityText: 'quantity-text',
        type: 'type',
      },
      PLAYER_TYPES: { bandits: 'bandits' },
      POPULATION_MAX: 200,
    },
    '../../lib': { getIconPath: id => id },
    '../../lib/horses/horseColors': {
      HORSE_COLOR_PALETTES: {
        dark: [0, 0x73737f, 0, 0, 0x2d3136],
        light: [0, 0xeadbc9, 0, 0, 0x857565],
      },
      isHorseColor: value => ['dark', 'light'].includes(value),
    },
    '../../lib/lang': { t: key => key },
    '../../lib/horses/stableHorses': {
      getStableHorseAmount: building => building.stableHorses?.length ?? 0,
      getStableHorses: building => building.stableHorses ?? [],
      STABLE_HORSE_CAPACITY: 5,
    },
    './BaseEntityInterface': {
      appendBaseEntityInfo: (element, _civ, type, hitPoints, totalHitPoints) => {
        const header = document.createElement('div')
        header.className = 'entity-info-header'
        header.textContent = type
        element.appendChild(header)
        if (hitPoints !== undefined) {
          const hp = document.createElement('div')
          hp.className = 'hit-points'
          hp.textContent = `${hitPoints}/${totalHitPoints}`
          element.appendChild(hp)
        }
      },
      appendQuantityInfo: () => {},
      createInfoImage: className => {
        const img = document.createElement('img')
        img.className = className
        return img
      },
      createInfoText: (className, text) => {
        const div = document.createElement('div')
        div.className = className
        div.textContent = String(text)
        return div
      },
    },
    '../utils/entityDisplayName': { getBuildingDisplayName: building => building.type },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

class MockElement {
  constructor(tagName) {
    this.tagName = tagName
    this.children = []
    this.textContent = ''
    this.className = ''
    this.title = ''
    this.type = ''
    this.listeners = new Map()
    this.styles = new Map()
    this.style = { setProperty: (key, value) => this.styles.set(key, value) }
    this.classList = {
      add: (...names) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean))
        names.forEach(name => classes.add(name))
        this.className = [...classes].join(' ')
      },
      contains: name => this.className.split(/\s+/).includes(name),
    }
  }

  appendChild(child) {
    this.children.push(child)
    return child
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) ?? []) listener({ type, currentTarget: this })
  }

  querySelectorAll(selector) {
    const className = selector.startsWith('.') ? selector.slice(1) : selector
    const results = []
    const queue = [...this.children]
    while (queue.length) {
      const current = queue.shift()
      if (current.classList.contains(className)) results.push(current)
      queue.push(...current.children)
    }
    return results
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null
  }
}

function withMockDocument(callback) {
  const previousDocument = global.document
  global.document = { createElement: tagName => new MockElement(tagName) }
  try {
    callback()
  } finally {
    global.document = previousDocument
  }
}

test('stable info displays horse amount and stored horse color avatars', () => {
  withMockDocument(() => {
    const { BuildingInterface } = loadBuildingInterface()
    const element = document.createElement('div')
    const building = {
      type: 'Stable',
      owner: { isPlayed: true, civ: 'Hellas' },
      isBuilt: true,
      loading: null,
      hitPoints: 100,
      totalHitPoints: 100,
      stableHorses: [{ horseColor: 'dark' }, { horseColor: 'light' }],
      context: { menu: {} },
    }

    new BuildingInterface(building).renderInfo(element, {})

    assert.equal(element.querySelector('.stable-horses-count').textContent, 'stableHorses 2/5')
    assert.equal(element.querySelectorAll('.stable-horse-avatar').length, 5)
    assert.equal(element.querySelectorAll('.filled').length, 2)
    assert.equal(element.querySelectorAll('.filled')[0].styles.get('--stable-horse-color'), '#73737f')
  })
})

test('foreign building info still displays hit points', () => {
  withMockDocument(() => {
    const { BuildingInterface } = loadBuildingInterface()
    const element = document.createElement('div')
    const building = {
      type: 'House',
      owner: { isPlayed: false, civ: 'Hellas' },
      isBuilt: true,
      loading: null,
      hitPoints: 75,
      totalHitPoints: 120,
      context: { menu: {} },
    }

    new BuildingInterface(building).renderInfo(element, {})

    assert.equal(element.querySelector('.hit-points').textContent, '75/120')
  })
})

test('building info does not render the legacy loading row', () => {
  withMockDocument(() => {
    const { BuildingInterface } = loadBuildingInterface()
    const element = document.createElement('div')
    const building = {
      type: 'Barracks',
      owner: { isPlayed: true, civ: 'Hellas' },
      isBuilt: true,
      loading: 42,
      hitPoints: 100,
      totalHitPoints: 100,
      context: { menu: {} },
    }

    new BuildingInterface(building).renderInfo(element, {})

    assert.equal(element.querySelector('.building-loading'), null)
  })
})

test('hero team building info renders a red delete button that destroys the building', () => {
  withMockDocument(() => {
    const { BuildingInterface } = loadBuildingInterface()
    const element = document.createElement('div')
    const heroOwner = { isPlayed: true, civ: 'Hellas', team: 2 }
    let died = false
    let closed = false
    let heroMenuClosed = false
    let clicked = false
    const building = {
      type: 'House',
      owner: { isPlayed: false, civ: 'Hellas', team: 2 },
      isBuilt: true,
      loading: null,
      hitPoints: 100,
      totalHitPoints: 100,
      context: {
        controls: { heroUnit: { owner: heroOwner } },
        menu: {
          closeEntityInfoModal: () => {
            closed = true
          },
          closeHeroBuildingMenu: () => {
            heroMenuClosed = true
          },
          playUiClick: () => {
            clicked = true
          },
        },
      },
      die: () => {
        died = true
      },
    }

    new BuildingInterface(building).renderInfo(element, {})

    const button = element.querySelector('.entity-delete-building-button')
    assert.ok(button)
    assert.equal(button.textContent, 'deleteEntity')
    assert.ok(button.classList.contains('ui-btn'))

    button.dispatch('click')

    assert.equal(clicked, true)
    assert.equal(closed, true)
    assert.equal(heroMenuClosed, true)
    assert.equal(died, true)
  })
})

test('foreign team building info does not render the delete button', () => {
  withMockDocument(() => {
    const { BuildingInterface } = loadBuildingInterface()
    const element = document.createElement('div')
    const building = {
      type: 'House',
      owner: { isPlayed: false, civ: 'Hellas', team: 3 },
      isBuilt: true,
      loading: null,
      hitPoints: 100,
      totalHitPoints: 100,
      context: {
        controls: { heroUnit: { owner: { isPlayed: true, civ: 'Hellas', team: 2 } } },
        menu: {},
      },
      die: () => {},
    }

    new BuildingInterface(building).renderInfo(element, {})

    assert.equal(element.querySelector('.entity-delete-building-button'), null)
  })
})

test('hero team trap info does not render the delete button', () => {
  withMockDocument(() => {
    const { BuildingInterface } = loadBuildingInterface()
    const element = document.createElement('div')
    const heroOwner = { isPlayed: true, civ: 'Hellas', team: 2 }
    const building = {
      label: 'trap-1',
      type: 'Trap',
      owner: heroOwner,
      isBuilt: true,
      hitPoints: 100,
      totalHitPoints: 100,
      context: {
        controls: { heroUnit: { owner: heroOwner } },
        menu: {},
      },
      die: () => {},
    }

    new BuildingInterface(building).renderInfo(element, {})

    assert.equal(element.querySelector('.entity-delete-building-button'), null)
  })
})

test('original interior storage chest info does not render the delete button', () => {
  withMockDocument(() => {
    const { BuildingInterface } = loadBuildingInterface()
    const element = document.createElement('div')
    const heroOwner = { isPlayed: true, civ: 'Hellas', team: 2 }
    const building = {
      label: 'interior:town-center-1:default:storage-chest',
      type: 'Chest',
      owner: heroOwner,
      isBuilt: true,
      hitPoints: 100,
      totalHitPoints: 100,
      context: {
        controls: { heroUnit: { owner: heroOwner } },
        menu: {},
      },
      die: () => {},
    }

    new BuildingInterface(building).renderInfo(element, {})

    assert.equal(element.querySelector('.entity-delete-building-button'), null)
  })
})
