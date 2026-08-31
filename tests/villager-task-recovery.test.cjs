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

const constants = {
  ACTION_TYPES: {
    build: 'build',
    chopwood: 'chopwood',
    farm: 'farm',
    forageberry: 'forageberry',
    minecopper: 'minecopper',
    minegold: 'minegold',
    mineiron: 'mineiron',
    minestone: 'minestone',
    takemeat: 'takemeat',
  },
  FAMILY_TYPES: {
    building: 'building',
    resource: 'resource',
  },
}

function loadVillagerTaskRecovery(calls) {
  return loadModule('app/lib/units/villagerTaskRecovery.ts', {
    '../constants': constants,
    '../mapSpaces': {
      getEntityCell: entity => entity.cell ?? null,
    },
    './villagerAutonomy': {
      assignVillagerAutonomy: (unit, job, options) => {
        calls.push(['assignAutonomy', job, options])
        unit.autonomousJob = job
        return false
      },
    },
    './villagerAutonomyTargeting': {
      getAutonomyJobForWork: work => (work === 'goldminer' ? 'gold' : null),
    },
  })
}

test('stored task recovery explores for the same autonomous job when the exact resource is gone', () => {
  const calls = []
  const { resumeVillagerStoredTask } = loadVillagerTaskRecovery(calls)
  const depletedGold = {
    family: constants.FAMILY_TYPES.resource,
    isDestroyed: true,
    label: 'gold-1',
  }
  const unit = {
    action: null,
    autonomousJob: null,
    dest: { label: 'old-dest' },
    handleChangeDest: () => calls.push(['handleChangeDest']),
    path: [{ i: 1, j: 1 }],
    previousDest: depletedGold,
    previousWork: 'goldminer',
    work: null,
    getActionCondition: () => false,
    sendToMineResource: () => calls.push(['sendToMineResource']),
  }

  const resumed = resumeVillagerStoredTask(unit, {
    action: constants.ACTION_TYPES.minegold,
    dest: depletedGold,
    work: 'goldminer',
  })

  assert.equal(resumed, false)
  assert.equal(unit.autonomousJob, 'gold')
  assert.equal(unit.work, 'goldminer')
  assert.equal(unit.dest, null)
  assert.deepEqual(unit.path, [])
  assert.deepEqual(calls, [
    ['handleChangeDest'],
    ['assignAutonomy', 'gold', { exploreWhenNoTarget: true, preserveRejectedTargets: true }],
  ])
})

test('gold task recovery uses the public gold command and verifies that the order started', () => {
  const calls = []
  const { resumeVillagerJobIntent } = loadVillagerTaskRecovery(calls)
  const gold = {
    family: constants.FAMILY_TYPES.resource,
    isDestroyed: false,
    label: 'gold-1',
    type: 'Gold',
  }
  const unit = {
    action: null,
    autonomousJob: 'gold',
    dest: null,
    getActionCondition: (target, action) => target === gold && action === constants.ACTION_TYPES.minegold,
    handleChangeDest: () => calls.push(['handleChangeDest']),
    path: [],
    sendToGold(target, immediate) {
      calls.push(['sendToGold', target.label, immediate])
      this.dest = target
      this.action = constants.ACTION_TYPES.minegold
      this.path = [{ i: 4, j: 5 }]
    },
    work: 'goldminer',
  }

  const resumed = resumeVillagerJobIntent(unit, {
    action: constants.ACTION_TYPES.minegold,
    autonomousJob: 'gold',
    dest: gold,
    work: 'goldminer',
  })

  assert.equal(resumed, true)
  assert.equal(unit.dest, gold)
  assert.equal(unit.action, constants.ACTION_TYPES.minegold)
  assert.equal(unit.path.length, 1)
  assert.deepEqual(calls, [
    ['handleChangeDest'],
    ['sendToGold', 'gold-1', true],
  ])
})

test('gold task recovery rejects a command that did not create a destination or action', () => {
  const calls = []
  const { resumeVillagerJobIntent } = loadVillagerTaskRecovery(calls)
  const gold = {
    family: constants.FAMILY_TYPES.resource,
    isDestroyed: false,
    label: 'gold-1',
    type: 'Gold',
  }
  const unit = {
    action: null,
    autonomousJob: 'gold',
    dest: null,
    getActionCondition: () => true,
    handleChangeDest: () => calls.push(['handleChangeDest']),
    path: [],
    sendToGold: () => calls.push(['sendToGold']),
    work: 'goldminer',
  }

  const resumed = resumeVillagerJobIntent(unit, {
    action: constants.ACTION_TYPES.minegold,
    autonomousJob: 'gold',
    dest: gold,
    work: 'goldminer',
  })

  assert.equal(resumed, false)
  assert.equal(unit.dest, null)
  assert.equal(unit.action, null)
  assert.deepEqual(calls, [
    ['handleChangeDest'],
    ['sendToGold'],
    ['assignAutonomy', 'gold', { exploreWhenNoTarget: true, preserveRejectedTargets: true }],
  ])
})
