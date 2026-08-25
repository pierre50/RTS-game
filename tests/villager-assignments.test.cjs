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

const constants = {
  ACTION_TYPES: { minecopper: 'minecopper', mineiron: 'mineiron' },
  RESOURCE_NAMES: ['wood', 'food', 'stone', 'gold', 'copper', 'iron'],
  RESOURCE_TYPES: { copper: 'Copper', iron: 'Iron' },
  UNIT_TYPES: { villager: 'Villager' },
  WORK_TYPES: {
    farmer: 'farmer',
    forager: 'forager',
    goldminer: 'goldminer',
    horseCapture: 'horseCapture',
    hunter: 'hunter',
    stoneminer: 'stoneminer',
    builder: 'builder',
    woodcutter: 'woodcutter',
  },
}

test('summarizes villager resource assignments, sleep and movement', () => {
  const { summarizeVillagerAssignments } = loadModule('app/lib/villagerAssignments.ts', {
    '../constants': constants,
  })

  const summary = summarizeVillagerAssignments([
    { type: 'Villager', work: 'woodcutter', path: [{ i: 1, j: 1 }] },
    { type: 'Villager', work: 'farmer' },
    { type: 'Villager', work: 'goldminer', dest: { type: 'Copper' } },
    { type: 'Villager', work: 'goldminer', action: 'mineiron' },
    {
      type: 'Villager',
      work: null,
      shelterState: { reason: 'sleep', previousAutonomousJob: 'stone', previousWork: null },
    },
    { type: 'Villager', autonomousJob: 'construction' },
    { type: 'Villager', work: null },
    { type: 'Fantassin', work: 'woodcutter' },
    { type: 'Villager', work: 'woodcutter', isDead: true },
  ])

  assert.deepEqual(summary.assigned, { wood: 1, food: 1, stone: 1, gold: 0, copper: 1, iron: 1 })
  assert.equal(summary.total, 7)
  assert.equal(summary.construction, 1)
  assert.equal(summary.idle, 1)
  assert.equal(summary.sleeping, 1)
  assert.equal(summary.moving, 1)
})
