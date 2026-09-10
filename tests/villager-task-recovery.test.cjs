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
    hunt: 'hunt',
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

test('stored food task can resume a usable animal carcass instead of rejecting all dead targets', () => {
  const calls = []
  const { resumeVillagerJobIntent } = loadVillagerTaskRecovery(calls)
  const carcass = { family: 'animal', label: 'deer', isDead: true, quantity: 12 }
  const unit = {
    autonomousJob: 'food',
    getActionCondition: () => true,
    sendToTakeMeat(target) {
      this.dest = target
      this.action = 'takemeat'
    },
  }
  assert.equal(resumeVillagerJobIntent(unit, { dest: carcass, action: 'takemeat', autonomousJob: 'food' }), true)
  assert.equal(unit.dest, carcass)
  assert.deepEqual(calls, [])
})

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
  assert.deepEqual(calls, [['handleChangeDest'], ['sendToGold', 'gold-1', true]])
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

for (const [action, method, family] of [
  ['farm', 'sendToFarm', 'resource'],
  ['forageberry', 'sendToBerrybush', 'resource'],
  ['chopwood', 'sendToTree', 'resource'],
  ['takemeat', 'sendToTakeMeat', 'resource'],
  ['hunt', 'sendToHunt', 'animal'],
  ['minestone', 'sendToStone', 'resource'],
  ['minecopper', 'sendToCopper', 'resource'],
  ['mineiron', 'sendToIron', 'resource'],
  ['build', 'sendToBuilding', 'building'],
]) {
  test(`stored ${action} tasks resume through their public command and detect missing commands`, () => {
    const calls = []
    const { resumeVillagerStoredTask } = loadVillagerTaskRecovery(calls)
    const target = { label: 'target', family }
    const unit = {
      [method](dest) {
        this.dest = dest
        this.action = action
      },
    }
    assert.equal(resumeVillagerStoredTask(unit, { dest: target, action }, { fallbackToAutonomy: false }), true)
    assert.equal(unit.dest, target)
    assert.equal(unit.action, action)
    delete unit[method]
    assert.equal(resumeVillagerStoredTask(unit, { dest: target, action }, { fallbackToAutonomy: false }), false)
    assert.equal(calls.length, 0)
  })
}

test('stored movement tasks support cells, unlabeled destinations and explicit order rejection', () => {
  const { resumeVillagerStoredTask } = loadVillagerTaskRecovery([])
  for (const dest of [{ has: null, i: 2, j: 3 }, { label: 'entity' }]) {
    const unit = {
      sendToEvt(target, action, options) {
        this.dest = target
        this.action = action
        assert.equal(options.preserveAutonomy, true)
      },
    }
    assert.equal(resumeVillagerStoredTask(unit, { dest }, { fallbackToAutonomy: false }), true)
    unit.sendToEvt = () => false
    assert.equal(resumeVillagerStoredTask(unit, { dest }, { fallbackToAutonomy: false }), false)
    delete unit.sendToEvt
    assert.equal(resumeVillagerStoredTask(unit, { dest }, { fallbackToAutonomy: false }), false)
  }
})

test('recovery recognizes equivalent targets, blocked approaches and work already in progress', () => {
  const { resumeVillagerStoredTask } = loadVillagerTaskRecovery([])
  const dest = { label: 'tree' }
  const task = { dest, action: 'chopwood' }
  const unit = {
    sendToTree() {
      this.dest = { label: 'tree' }
      this.action = 'chopwood'
    },
  }
  assert.equal(resumeVillagerStoredTask(unit, task, { fallbackToAutonomy: false }), true)
  unit.sendToTree = function () {
    this.blockedGatherApproach = { target: dest, action: 'chopwood' }
  }
  assert.equal(resumeVillagerStoredTask(unit, task, { fallbackToAutonomy: false }), true)
  unit.blockedGatherApproach = null
  unit.sendToTree = function () {
    this.action = 'chopwood'
  }
  unit.isUnitAtDest = () => true
  assert.equal(resumeVillagerStoredTask(unit, task, { fallbackToAutonomy: false }), true)
  unit.isUnitAtDest = () => false
  assert.equal(resumeVillagerStoredTask(unit, task, { fallbackToAutonomy: false }), false)
})

test('construction recovery routes non-building targets through their map cell', () => {
  const { resumeVillagerStoredTask } = loadVillagerTaskRecovery([])
  const cell = { has: null, i: 4, j: 5 }
  const target = { family: 'resource', cell }
  const unit = {
    context: { map: {} },
    sendToEvt(dest, action) {
      this.dest = dest
      this.action = action
    },
  }
  const task = { dest: target, action: 'build' }
  assert.equal(resumeVillagerStoredTask(unit, task, { fallbackToAutonomy: false }), true)
  assert.equal(unit.dest, cell)
  delete unit.sendToEvt
  assert.equal(resumeVillagerStoredTask(unit, task, { fallbackToAutonomy: false }), false)
  delete target.cell
  assert.equal(resumeVillagerStoredTask(unit, task, { fallbackToAutonomy: false }), false)
  delete unit.context
  assert.equal(resumeVillagerStoredTask(unit, task, { fallbackToAutonomy: false }), false)
})

test('invalid stored tasks cannot restart dead targets and respect fallback and motion options', () => {
  const calls = []
  const { resumeVillagerStoredTask, resumeStrictVillagerAutonomy } = loadVillagerTaskRecovery(calls)
  const originalDest = { label: 'current' }
  const path = [{ i: 1, j: 2 }]
  const unit = { dest: originalDest, path, autonomousJob: 'wood', getActionCondition: () => false }
  assert.equal(resumeVillagerStoredTask(unit, null), false)
  for (const dest of [null, { isDead: true }, { label: 'rejected' }]) {
    assert.equal(
      resumeVillagerStoredTask(
        unit,
        { dest, action: 'farm', autonomousJob: 'gold' },
        { clearMotion: false, preserveAutonomy: false, fallbackToAutonomy: false }
      ),
      false
    )
    assert.equal(unit.dest, originalDest)
    assert.equal(unit.path, path)
    assert.equal(unit.autonomousJob, 'wood')
  }
  assert.equal(resumeVillagerStoredTask(unit, { dest: null, work: 'goldminer' }, { exploreWhenNoTarget: false }), false)
  assert.deepEqual(calls.at(-1), [
    'assignAutonomy',
    'gold',
    { exploreWhenNoTarget: false, preserveRejectedTargets: true },
  ])
  assert.equal(resumeStrictVillagerAutonomy({}), false)
})
