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
    units: ['Fantassin', 'Bowman'],
    owner,
    isBuilt: true,
    isDead: false,
  }
  const clubman = { type: 'Fantassin', owner }
  const bowman = { type: 'Bowman', owner }
  const mountedInfantry = { type: 'Fantassin', mountedOnHorse: true, owner }
  const villager = { type: 'Villager', owner }

  assert.equal(canUnitTrainInto(stable, clubman, 'Fantassin'), true)
  assert.equal(getTrainingTargetForUnit(stable, clubman), 'Fantassin')
  assert.equal(canUnitTrainInto(stable, bowman, 'Bowman'), true)
  assert.equal(getTrainingTargetForUnit(stable, bowman), 'Bowman')
  assert.equal(canUnitTrainInto(stable, mountedInfantry, 'Fantassin'), false)
  assert.equal(getTrainingTargetForUnit(stable, mountedInfantry), null)
  assert.equal(canUnitTrainInto(stable, villager, 'Fantassin'), false)
  assert.equal(getTrainingTargetForUnit(stable, villager), null)
})

test('Barracks and archery range no longer upgrade trained soldiers', () => {
  const { canUnitTrainInto, getTrainingTargetForUnit } = loadModule('app/lib/buildingTraining.ts', {
    '../constants': {
      BUILDING_TYPES: { stable: 'Stable', temple: 'Temple' },
      UNIT_TYPES: { villager: 'Villager', priest: 'Priest' },
    },
    './combat': { isValidCondition: () => true },
    './unitUpgrades': loadModule('app/lib/unitUpgrades.ts', {
      '../constants': {
        BUILDING_TYPES: { stable: 'Stable', barracks: 'Barracks', archeryRange: 'ArcheryRange' },
        UNIT_TYPES: {
          clubman: 'Fantassin',
          axeman: 'Fantassin',
          shortSwordsman: 'Fantassin',
          broadSwordsman: 'Fantassin',
          longSwordsman: 'Fantassin',
          bowman: 'Bowman',
        },
      },
    }),
  })

  const owner = {
    config: {
      units: {
        Fantassin: { category: 'Fantassin' },
        Bowman: { category: 'Archer' },
      },
    },
  }
  const barracks = { type: 'Barracks', units: ['Fantassin'], owner, isBuilt: true, isDead: false }
  const archeryRange = { type: 'ArcheryRange', units: ['Bowman'], owner, isBuilt: true, isDead: false }
  const clubman = { type: 'Fantassin', owner }
  const bowman = { type: 'Bowman', owner }

  assert.equal(canUnitTrainInto(barracks, clubman, 'Fantassin'), false)
  assert.equal(getTrainingTargetForUnit(barracks, clubman), null)
  assert.equal(canUnitTrainInto(archeryRange, bowman, 'Bowman'), false)
  assert.equal(getTrainingTargetForUnit(archeryRange, bowman), null)
})
