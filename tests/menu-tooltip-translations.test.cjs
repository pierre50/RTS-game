const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')
const assert = require('node:assert/strict')

function loadTranslations() {
  const tooltipFilename = path.join(__dirname, '../app/lib/i18n/entityTooltips.js')
  const tooltipSource = fs
    .readFileSync(tooltipFilename, 'utf8')
    .replace('export const ENTITY_TOOLTIP_TRANSLATIONS =', 'ENTITY_TOOLTIP_TRANSLATIONS =')
  const context = {}
  vm.createContext(context)
  vm.runInContext(tooltipSource, context)

  const translationsFilename = path.join(__dirname, '../app/lib/i18n/translations.js')
  const translationsSource = fs
    .readFileSync(translationsFilename, 'utf8')
    .replace("import { ENTITY_TOOLTIP_TRANSLATIONS } from './entityTooltips'\n\n", '')
    .replace('export const TRANSLATIONS =', 'TRANSLATIONS =')
  vm.runInContext(translationsSource, context)
  return context.TRANSLATIONS
}

const translations = loadTranslations()
const buildings = require('../public/assets/data/gameplay/buildings.json')
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
}
