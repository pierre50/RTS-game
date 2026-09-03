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
  ACTION_TYPES: { attack: 'attack' },
  FAMILY_TYPES: { animal: 'animal', unit: 'unit' },
}

function makeVillager(label, calls) {
  return {
    label,
    family: constants.FAMILY_TYPES.unit,
    type: 'Villager',
    i: 5,
    j: 5,
    hitPoints: 25,
    totalHitPoints: 25,
    sendToAttack(target, options) {
      calls.push(['villagerAttack', label, target.label, options])
    },
  }
}

test('village assault by military threat pulls nearby villagers into defense', () => {
  const calls = []
  const { handleThreatResponses } = loadModule('app/ai/AIThreatResponses.ts', {
    '../constants': constants,
  })
  const hostile = { label: 'hero', family: constants.FAMILY_TYPES.unit, type: 'Hero', i: 5, j: 6 }
  const threat = {
    target: { label: 'villager-hit', type: 'Villager', i: 5, j: 5 },
    hostiles: [hostile],
    profile: {
      hostileAnimals: [],
      hostileMilitary: [hostile],
      hostileVillagers: [],
      isCriticalBuilding: false,
      isDirectVillageAssault: true,
      isRemoteVillagerIncident: false,
      isChief: false,
      isNearHome: true,
      priority: 10,
    },
  }
  const manager = {
    getActiveThreats: () => [threat],
    getDefensePowerNeed: () => 100,
    player: {
      scout: null,
      strategy: {
        military: {
          getCombatPower: () => 0,
        },
      },
    },
  }
  const villagers = [
    makeVillager('v1', calls),
    makeVillager('v2', calls),
    makeVillager('v3', calls),
    makeVillager('v4', calls),
  ]

  assert.equal(handleThreatResponses(manager, { villagers, waitingMilitary: [] }), 1)
  assert.deepEqual(calls, [
    ['villagerAttack', 'v1', 'hero', { keepPrevious: true }],
    ['villagerAttack', 'v2', 'hero', { keepPrevious: true }],
    ['villagerAttack', 'v3', 'hero', { keepPrevious: true }],
  ])
})
