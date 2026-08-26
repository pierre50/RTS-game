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

function loadDisplayName(t = key => key) {
  return loadModule('app/ui/utils/entityDisplayName.ts', {
    '../../constants': { FAMILY_TYPES: { building: 'building', unit: 'unit', animal: 'animal', resource: 'resource' } },
    '../../lib/lang': { t },
  })
}

test('building display names use gameplay type instead of technical instance name', () => {
  const { getEntityDisplayName } = loadDisplayName(key => (key === 'TownCenter' ? 'Centre-ville' : key))

  assert.equal(
    getEntityDisplayName({
      family: 'building',
      type: 'TownCenter',
      assetType: 'TownCenter',
      name: '9b52-ai-building-id',
    }),
    'Centre-ville'
  )
})

test('building display names humanize missing translation keys', () => {
  const { getEntityDisplayName } = loadDisplayName()

  assert.equal(getEntityDisplayName({ family: 'building', type: 'StoragePit', name: 'raw-id' }), 'Storage Pit')
  assert.equal(getEntityDisplayName({ family: 'building', type: 'town-center' }), 'Town Center')
})

test('non-building display names keep authored names', () => {
  const { getEntityDisplayName } = loadDisplayName(key => (key === 'Portal' ? 'Portail' : key))

  assert.equal(getEntityDisplayName({ family: 'resource', type: 'Portal', name: 'resource-id' }), 'Portail')
  assert.equal(getEntityDisplayName({ family: 'unit', type: 'Villager', name: 'Ada' }), 'Ada')
})

test('animal display names use translated type instead of technical instance name', () => {
  const { getEntityDisplayName } = loadDisplayName(key => (key === 'Boar' ? 'Sanglier' : key))

  assert.equal(getEntityDisplayName({ family: 'animal', type: 'Boar', name: 'Mmmmm' }), 'Sanglier')
})
