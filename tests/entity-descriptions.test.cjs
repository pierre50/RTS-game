const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const animals = require('../public/assets/data/gameplay/animals.json')
const { TRANSLATIONS } = loadTsModule('app/lib/i18n/translations.ts')
const { RESOURCE_TYPES, BUILDING_TYPES } = loadTsModule('app/constants/entities.ts')
let language = 'fr'
const { getEntityDescription, appendEntityDescription } = loadTsModule('app/ui/entity/EntityDescription.ts', {
  mocks: { '../../lib/lang': { t: key => TRANSLATIONS[language][key] ?? key } },
})

for (const lang of ['fr', 'en']) {
  test(`inspection descriptions cover every animal, resource and building in ${lang}`, () => {
    language = lang
    for (const type of Object.keys(animals)) {
      const alive = getEntityDescription({ family: 'animal', type })
      const dead = getEntityDescription({ family: 'animal', type, isDead: true })
      assert.ok(alive.length > 20, type)
      assert.ok(dead.length > 20, type)
      assert.notEqual(alive, dead, type)
      assert.equal(alive, TRANSLATIONS[lang][`inspect${type}`])
      assert.equal(dead, TRANSLATIONS[lang][`inspect${type}Corpse`])
    }
    for (const [family, types] of [
      ['resource', RESOURCE_TYPES],
      ['building', BUILDING_TYPES],
    ]) {
      for (const type of Object.values(types)) {
        const text = getEntityDescription({ family, type })
        assert.ok(text.trim().length > 0, `${family}: ${type}`)
        assert.ok(!text.includes('Description'), type)
      }
    }
  })
}

test('tree appearance and felling select the appropriate description without accessing graphics', () => {
  language = 'fr'
  const tree = {
    family: 'resource',
    type: 'Tree',
    hitPoints: 10,
    get sprite() {
      throw new Error('Tree inspection must not materialize its graphics')
    },
  }
  for (const [sheet, key] of [
    ['grass', 'inspectTree'],
    ['palm', 'inspectTreePalm'],
    ['dark-forest', 'inspectTreeDarkForest'],
  ]) {
    tree.textureName = `002_resources/tree/${sheet}`
    assert.equal(getEntityDescription(tree), TRANSLATIONS.fr[key])
  }
  tree.hitPoints = 0
  assert.equal(getEntityDescription(tree), TRANSLATIONS.fr.inspectTreeFallen)
  tree.hitPoints = 10
  tree.isCutOrFallenTree = () => true
  assert.equal(getEntityDescription(tree), TRANSLATIONS.fr.inspectTreeFallen)
})

test('wheat description follows growth, ripeness and the post-harvest reset', () => {
  language = 'en'
  const wheat = { family: 'resource', type: 'Wheat', sprite: { textures: [0, 1, 2, 3], currentFrame: 0 } }
  assert.equal(getEntityDescription(wheat), TRANSLATIONS.en.inspectWheatGrowing)
  wheat.sprite.currentFrame = 3
  assert.equal(getEntityDescription(wheat), TRANSLATIONS.en.inspectWheatMature)
  wheat.sprite.currentFrame = 0
  assert.equal(getEntityDescription(wheat), TRANSLATIONS.en.inspectWheatGrowing)
})

test('missing descriptions never expose translation keys and rendering uses plain text', () => {
  assert.equal(getEntityDescription({ family: 'building', type: 'Unknown' }), '')
  assert.equal(getEntityDescription({ family: 'unit', type: 'Hero' }), '')
  const previousDocument = global.document
  global.document = { createElement: tag => ({ tag }) }
  try {
    const element = {
      children: [],
      appendChild(child) {
        this.children.push(child)
      },
    }
    appendEntityDescription(element, '')
    assert.equal(element.children.length, 0)
    appendEntityDescription(element, '<b>Plain text</b>')
    assert.equal(element.children[0].tag, 'p')
    assert.equal(element.children[0].textContent, '<b>Plain text</b>')
    assert.equal(element.children[0].className, 'entity-description')
  } finally {
    global.document = previousDocument
  }
})

test('berrybush descriptions follow full, empty and replenished states in both languages', () => {
  for (const lang of ['fr', 'en']) {
    language = lang
    const bush = { family: 'resource', type: 'Berrybush', hitPoints: 4, quantity: 5 }
    assert.equal(getEntityDescription(bush), TRANSLATIONS[lang].inspectBerrybush)
    bush.quantity = 0
    assert.equal(getEntityDescription(bush), TRANSLATIONS[lang].inspectBerrybushEmpty)
    bush.quantity = 1
    assert.equal(getEntityDescription(bush), TRANSLATIONS[lang].inspectBerrybush)
  }
})
