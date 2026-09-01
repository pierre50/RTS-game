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

test('Stable trains only unmounted matching military units into mounted units', () => {
  const { canUnitTrainInto } = loadModule('app/lib/buildings/buildingTraining.ts', {
    '../constants': {
      BUILDING_TYPES: { stable: 'Stable', temple: 'Temple' },
      UNIT_TYPES: { villager: 'Villager', priest: 'Priest' },
    },
    '../horses/stableHorses': { getStableHorseAmount: building => building.stableHorses?.length ?? 0 },
  })

  const owner = {}
  const stable = {
    type: 'Stable',
    units: ['Fantassin', 'Bowman'],
    stableHorses: [{ horseColor: 'dark' }],
    owner,
    isBuilt: true,
    isDead: false,
  }
  const clubman = { type: 'Fantassin', owner }
  const bowman = { type: 'Bowman', owner }
  const mountedInfantry = { type: 'Fantassin', mountedOnHorse: true, owner }
  const villager = { type: 'Villager', owner }

  assert.equal(canUnitTrainInto(stable, clubman, 'Fantassin'), true)
  assert.equal(canUnitTrainInto(stable, bowman, 'Bowman'), true)
  assert.equal(canUnitTrainInto(stable, mountedInfantry, 'Fantassin'), false)
  assert.equal(canUnitTrainInto(stable, villager, 'Fantassin'), false)
})

test('Barracks and archery range no longer upgrade trained soldiers', () => {
  const { canUnitTrainInto } = loadModule('app/lib/buildings/buildingTraining.ts', {
    '../constants': {
      BUILDING_TYPES: { stable: 'Stable', temple: 'Temple' },
      UNIT_TYPES: { villager: 'Villager', priest: 'Priest' },
    },
    '../horses/stableHorses': { getStableHorseAmount: building => building.stableHorses?.length ?? 0 },
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
  assert.equal(canUnitTrainInto(archeryRange, bowman, 'Bowman'), false)
})

test('training building load counts active queued and incoming units up to shared capacity', () => {
  const { getBuildingTrainingLoad, hasBuildingTrainingCapacity } = loadModule(
    'app/lib/buildings/buildingTraining.ts',
    {
      '../constants': {
        BUILDING_TYPES: { stable: 'Stable', temple: 'Temple' },
        UNIT_TYPES: { villager: 'Villager', priest: 'Priest' },
      },
      '../resources/playerResourceTotals': {
        getMissingPlayerResources: () => ({}),
        hasPlayerResourceChests: () => false,
      },
    }
  )

  const owner = { units: [] }
  const building = {
    loading: 40,
    queue: ['Fantassin', 'Bowman'],
    owner,
  }
  const incomingA = { dest: building, trainingTargetType: 'Fantassin' }
  const incomingB = { dest: building, trainingTargetType: 'Bowman' }
  const ignoredDeadIncoming = { dest: building, trainingTargetType: 'Fantassin', isDead: true }
  owner.units.push(incomingA, incomingB, ignoredDeadIncoming)

  assert.equal(getBuildingTrainingLoad(building), 4)
  assert.equal(hasBuildingTrainingCapacity(building), true)

  owner.units.push({ dest: building, trainingTargetType: 'Fantassin' })

  assert.equal(getBuildingTrainingLoad(building), 5)
  assert.equal(hasBuildingTrainingCapacity(building), false)
  assert.equal(hasBuildingTrainingCapacity(building, { excludeUnit: incomingA }), true)
})
