const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile, loadTsModule } = require('./helpers/loadTsModule.cjs')

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
    '../../constants': {
      ...loadTsModule('app/constants/entities.ts'),
      FAMILY_TYPES: { building: 'building', unit: 'unit', animal: 'animal', resource: 'resource' },
    },
    '../../lib/lang': { t },
  })
}

test('building display names use gameplay type instead of technical instance name', () => {
  const { getEntityDisplayName } = loadDisplayName(key => (key === 'TownCenter' ? 'Centre-ville' : key))

  assert.equal(
    getEntityDisplayName({
      family: 'building',
      isBuilt: true,
      type: 'TownCenter',
      assetType: 'TownCenter',
      name: '9b52-ai-building-id',
    }),
    'Centre-ville'
  )
})

test('building display names humanize missing translation keys', () => {
  const { getEntityDisplayName } = loadDisplayName()

  assert.equal(
    getEntityDisplayName({ family: 'building', isBuilt: true, type: 'StoragePit', name: 'raw-id' }),
    'Storage Pit'
  )
  assert.equal(getEntityDisplayName({ family: 'building', isBuilt: true, type: 'town-center' }), 'Town Center')
})

test('non-building display names keep authored names', () => {
  const { getEntityDisplayName } = loadDisplayName(key => (key === 'Gold' ? 'Or' : key))

  assert.equal(getEntityDisplayName({ family: 'resource', type: 'Gold', name: 'resource-id' }), 'Or')
  assert.equal(getEntityDisplayName({ family: 'unit', type: 'Villager', name: 'Ada' }), 'Ada')
})

test('animal display names use translated type instead of technical instance name', () => {
  const { getEntityDisplayName } = loadDisplayName(key => (key === 'Boar' ? 'Sanglier' : key))

  assert.equal(getEntityDisplayName({ family: 'animal', type: 'Boar', name: 'Mmmmm' }), 'Sanglier')
})

test('houses display the names of their household, including an absent hero', () => {
  const { getEntityDisplayName } = loadDisplayName((key, vars) => {
    if (key === 'houseOfOne') return `Maison de ${vars.name}`
    if (key === 'houseOfTwo') return `Maison de ${vars.first} et ${vars.second}`
    return 'Maison inoccupée'
  })
  const owner = { units: [] }
  const house = { family: 'building', isBuilt: true, type: 'House', label: 'home', owner }
  assert.equal(getEntityDisplayName(house), 'Maison inoccupée')
  owner.units.push({ label: 'a', name: 'Alice', homeHouseLabel: 'home' })
  assert.equal(getEntityDisplayName(house), 'Maison de Alice')
  owner.units.push({ label: 'b', name: 'Bob', homeHouseLabel: 'home' })
  assert.equal(getEntityDisplayName(house), 'Maison de Alice et Bob')
  owner.units = []
  house.heroHomeResident = { label: 'hero', name: 'Alex' }
  assert.equal(getEntityDisplayName(house), 'Maison de Alex')
})

test('construction names use the building type without occupancy claims', () => {
  const { getBuildingDisplayName } = loadDisplayName((key, values) =>
    key === 'constructionSiteName' ? `${values.building} — En construction` : key
  )
  for (const type of ['House', 'Trap', 'Forge', 'Chest', 'CampBedroll', 'Farm']) {
    const name = getBuildingDisplayName({ type, isBuilt: false, owner: { units: [] } })
    assert.ok(name.endsWith(' — En construction'), type)
    assert.ok(!name.includes('houseUnoccupied'), type)
  }
})

test('town centers display their settlement name alongside their translated role', () => {
  const { getBuildingDisplayName } = loadDisplayName((key, values) =>
    key === 'TownCenter'
      ? 'Centre-ville'
      : key === 'constructionSiteName'
        ? `${values.building} — En construction`
        : key
  )
  const town = { type: 'TownCenter', isBuilt: true, settlementName: 'Uruk' }
  assert.equal(getBuildingDisplayName(town), 'Uruk — Centre-ville')
  assert.equal(getBuildingDisplayName({ ...town, isBuilt: false }), 'Uruk — Centre-ville — En construction')
})
