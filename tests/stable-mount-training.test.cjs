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

test('Stable trains only unmounted matching military units into mounted units', () => {
  const { canUnitTrainInto, getTrainingTargetForUnit } = loadModule('app/lib/buildingTraining.ts', {
    '../constants': {
      BUILDING_TYPES: { stable: 'Stable', temple: 'Temple' },
      UNIT_TYPES: { villager: 'Villager', priest: 'Priest' },
    },
    './combat': { isValidCondition: () => true },
    './unitUpgrades': {
      canUpgradeUnitAtBuilding: () => false,
      getUnitUpgradeTargetForBuilding: () => null,
    },
  })

  const owner = {}
  const stable = {
    type: 'Stable',
    units: ['Clubman', 'Phalanx'],
    owner,
    isBuilt: true,
    isDead: false,
  }
  const clubman = { type: 'Clubman', owner }
  const phalanx = { type: 'Phalanx', owner }
  const mountedClubman = { type: 'Clubman', mountedOnHorse: true, owner }
  const villager = { type: 'Villager', owner }

  assert.equal(canUnitTrainInto(stable, clubman, 'Clubman'), true)
  assert.equal(getTrainingTargetForUnit(stable, clubman), 'Clubman')
  assert.equal(canUnitTrainInto(stable, phalanx, 'Phalanx'), true)
  assert.equal(getTrainingTargetForUnit(stable, phalanx), 'Phalanx')
  assert.equal(canUnitTrainInto(stable, mountedClubman, 'Clubman'), false)
  assert.equal(getTrainingTargetForUnit(stable, mountedClubman), null)
  assert.equal(canUnitTrainInto(stable, villager, 'Clubman'), false)
  assert.equal(getTrainingTargetForUnit(stable, villager), null)
})
