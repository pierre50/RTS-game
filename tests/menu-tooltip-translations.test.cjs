const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const babel = require('@babel/core')

function loadModule(filename, mocks = {}) {
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => mocks[request] || require(request)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function loadTranslations() {
  const tooltipFilename = path.join(__dirname, '../app/lib/i18n/entityTooltips.ts')
  const tooltipModule = loadModule(tooltipFilename)
  const frFilename = path.join(__dirname, '../app/lib/i18n/fr.ts')
  const enFilename = path.join(__dirname, '../app/lib/i18n/en.ts')
  const frModule = loadModule(frFilename, { './entityTooltips': tooltipModule })
  const enModule = loadModule(enFilename, { './entityTooltips': tooltipModule })
  const translationsFilename = path.join(__dirname, '../app/lib/i18n/translations.ts')
  return loadModule(translationsFilename, { './fr': frModule, './en': enModule }).TRANSLATIONS
}

const translations = loadTranslations()
const animals = require('../public/assets/data/gameplay/animals.json')
const buildings = require('../public/assets/data/gameplay/buildings.json')
const resources = require('../public/assets/data/gameplay/resources.json')
const units = require('../public/assets/data/gameplay/units.json')
const technologies = require('../public/assets/data/technologies/technologies.json')

for (const lang of ['fr', 'en']) {
  test(`${lang} has names and descriptions for every building tooltip`, () => {
    for (const type of Object.keys(buildings)) {
      assert.ok(translations[lang][type], `Missing ${lang} building name: ${type}`)
      assert.ok(translations[lang][`${type}Description`], `Missing ${lang} building description: ${type}`)
    }
  })

  test(`${lang} has names and descriptions for every technology tooltip`, () => {
    for (const type of Object.keys(technologies)) {
      assert.ok(translations[lang][type], `Missing ${lang} technology name: ${type}`)
      assert.ok(translations[lang][`${type}Description`], `Missing ${lang} technology description: ${type}`)
    }
  })

  test(`${lang} has names and descriptions for every unit tooltip`, () => {
    for (const type of Object.keys(units)) {
      assert.ok(translations[lang][type], `Missing ${lang} unit name: ${type}`)
      assert.ok(translations[lang][`${type}Description`], `Missing ${lang} unit description: ${type}`)
    }
  })

  test(`${lang} has names for every inspectable map entity`, () => {
    for (const type of [...Object.keys(animals), ...Object.keys(resources)]) {
      assert.ok(translations[lang][type], `Missing ${lang} entity name: ${type}`)
    }
  })
}
