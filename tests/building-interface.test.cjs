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
      BUILDING_TYPES: { house: 'House', chest: 'Chest', fireCamp: 'FireCamp', stable: 'Stable', trap: 'Trap' },
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
    },
    '../../lib': { getIconPath: id => id },
    './EntityDescription': { getEntityDescription: () => '' },
    '../../lib/horses/horseColors': {
      HORSE_COLOR_PALETTES: {
        dark: [0, 0x73737f, 0, 0, 0x2d3136],
        light: [0, 0xeadbc9, 0, 0, 0x857565],
      },
      isHorseColor: value => ['dark', 'light'].includes(value),
    },
    '../../lib/lang': { t: (key, values) => (values?.count == null ? key : `${key}:${values.count}`) },
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
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

class MockElement {
  constructor(tagName) {
    this.tagName = tagName
    this.children = []
    this.textContent = ''
    this.className = ''
    this.attributes = new Map()
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

  setAttribute(name, value) {
    this.attributes.set(name, value)
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
    assert.equal(element.querySelectorAll('.filled')[0].attributes.get('aria-label'), 'horseColor_dark')
    assert.equal(element.querySelectorAll('.filled')[0].attributes.has('title'), false)
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

test('hero team building info renders a demolish button that destroys the building', () => {
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
      demolish: () => {
        died = true
      },
    }

    const actions = document.createElement('div')
    new BuildingInterface(building).renderInfo(element, {}, { actionsContainer: actions })

    assert.equal(element.querySelector('.entity-delete-building-button'), null)
    const button = actions.querySelector('.entity-delete-building-button')
    assert.ok(button)
    assert.equal(button.textContent, 'demolishBuilding')
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
      demolish: () => {},
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
      demolish: () => {},
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
      demolish: () => {},
    }

    new BuildingInterface(building).renderInfo(element, {})

    assert.equal(element.querySelector('.entity-delete-building-button'), null)
  })
})

test('house population information shows real beds and marks renovation unavailability', () => {
  const previous = global.document
  global.document = { createElement: tag => new MockElement(tag) }
  try {
    const { BuildingInterface } = loadBuildingInterface()
    const owner = { label: 'village', population: 3, populationMax: 99, buildings: [] }
    const house = {
      type: 'House',
      label: 'house',
      owner,
      isBuilt: true,
      interiorBuildings: [
        { type: 'CampBedroll', isBuilt: true },
        { type: 'CampBedroll', isBuilt: true },
      ],
    }
    owner.buildings.push(house)
    const view = new BuildingInterface(house)
    let element = view.getPopulationElement()
    assert.equal(element.children[1].textContent, '3/2')
    assert.equal(element.children[2].textContent, 'houseBedsCount:2')
    house.buildingUpgrade = { targetLevel: 1 }
    element = view.getPopulationElement()
    assert.equal(element.children[1].textContent, '3/0')
    assert.equal(element.children[2].textContent, 'houseBedsUnavailable:2')
    delete house.buildingUpgrade
    assert.equal(view.getPopulationElement().children[1].textContent, '3/2')
  } finally {
    global.document = previous
  }
})

test('own indestructible furniture exposes removal and rechecks ownership on click', () => {
  withMockDocument(() => {
    const { BuildingInterface } = loadBuildingInterface()
    const owner = { isPlayed: true, civ: 'Hellas' }
    let removed = 0
    const building = {
      type: 'CampChair',
      owner,
      isBuilt: true,
      indestructible: true,
      context: { controls: { heroUnit: { owner } }, menu: {} },
      demolish: () => removed++,
    }
    const element = document.createElement('div')
    new BuildingInterface(building).renderInfo(element, {})
    const button = element.querySelector('.entity-delete-building-button')
    assert.ok(button)
    assert.equal(button.textContent, 'removeBuildingObject')
    button.dispatch('click')
    assert.equal(removed, 1)
    building.owner = { team: owner.team }
    button.dispatch('click')
    assert.equal(removed, 1)
  })
})

test('every constructible type shows actual health during and after construction', () => {
  withMockDocument(() => {
    const { BuildingInterface } = loadBuildingInterface()
    const definitions = require('../public/assets/data/gameplay/buildings.json')
    for (const [type, config] of Object.entries(definitions)) {
      if (!(config.constructionTime > 0)) continue
      const building = {
        type,
        owner: { civ: 'Hellas' },
        context: { menu: {} },
        isBuilt: false,
        hitPoints: 75,
        totalHitPoints: 75,
        constructionProgress: 0,
        constructionWorkRequired: 10,
        constructionMaterials: { cost: { wood: 2 }, consumed: {}, delivered: {} },
      }
      const ui = new BuildingInterface(building)
      const initial = document.createElement('div')
      ui.renderInfo(initial, {})
      assert.equal(initial.querySelector('.hit-points').textContent, '75/75', type)
      assert.equal(initial.querySelector('.construction-progress-bar'), null, type)
      assert.equal(initial.querySelector('.construction-damage-status'), null, type)
      building.constructionProgress = 0.5
      building.hitPoints = 50
      const damaged = document.createElement('div')
      ui.renderInfo(damaged, {})
      assert.equal(damaged.querySelector('.hit-points').textContent, '50/75', type)
      assert.ok(damaged.querySelector('.construction-damage-status'), type)
      building.isBuilt = true
      const completed = document.createElement('div')
      ui.renderInfo(completed, {})
      assert.equal(completed.querySelector('.construction-progress-display'), null, type)
      assert.equal(completed.querySelector('.hit-points').textContent, '50/75', type)
    }
  })
})

test('construction inspection has no manual build action or duplicate material ledger', () => {
  withMockDocument(() => {
    const { BuildingInterface } = loadBuildingInterface()
    const owner = { civ: 'Hellas' }
    const hero = { owner, getActionCondition: () => true }
    const building = {
      type: 'House',
      owner,
      context: { controls: { heroUnit: hero }, menu: {} },
      isBuilt: false,
      hitPoints: 75,
      totalHitPoints: 75,
      constructionProgress: 0,
      constructionMaterials: { cost: { wood: 40, stone: 10 }, delivered: {}, consumed: {} },
    }
    const element = document.createElement('div')
    new BuildingInterface(building).renderInfo(element, {})
    assert.equal(element.querySelector('.construction-materials'), null)
    assert.equal(element.querySelectorAll('.construction-work-status').length, 1)
    assert.equal(
      element.children.some(child => child.textContent === 'constructionSiteBuild'),
      false
    )
    assert.equal(element.querySelector('.construction-progress-display'), null)
    assert.equal(element.querySelector('.hit-points').textContent, '75/75')
  })
})
