const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('reported visible attacker remains an active threat even away from the hit building', () => {
  const { AIThreatManager } = loadTsModule('app/ai/AIThreatManager.ts', {
    mocks: {
      '../lib': {
        findInstancesInSight: () => [],
      },
      '../constants': {
        ACTION_TYPES: { attack: 'attack' },
        BUILDING_TYPES: { townCenter: 'TownCenter' },
        FAMILY_TYPES: { animal: 'animal', building: 'building', unit: 'unit' },
        UNIT_TYPES: { villager: 'Villager' },
      },
      './AIThreatProfiles': {
        getThreatProfile: () => ({ priority: 1 }),
        getDefensePowerNeed: () => 1,
      },
      './AIThreatResponses': {
        handleThreatResponses: () => 0,
      },
    },
  })
  const attackerOwner = { label: 'human' }
  const attacker = { label: 'hero', family: 'unit', type: 'Hero', i: 10, j: 10, hitPoints: 30, owner: attackerOwner }
  const building = {
    label: 'house',
    family: 'building',
    type: 'House',
    i: 0,
    j: 0,
    hitPoints: 100,
    owner: { label: 'ai' },
  }
  const threatenedTargets = new Map()
  const manager = new AIThreatManager({
    label: 'ai',
    context: {},
    views: { isVisible: (i, j) => i === 10 && j === 10 },
    buildings: [building],
    units: [],
    scout: null,
    difficultyConfig: {},
    strategy: { military: { getCombatPower: () => 1, getGroupCombatPower: () => 1 } },
    enemyUnitMemory: new Map(),
    enemyBuildingMemory: new Map(),
    threatenedTargets,
    isEnemy: owner => owner === attackerOwner,
    buildingsByTypes: () => [],
    getNow: () => 0,
  })

  manager.reportThreat(building, attacker)

  const activeThreats = manager.getActiveThreats()
  assert.equal(activeThreats.length, 1)
  assert.deepEqual(activeThreats[0].hostiles, [attacker])
})
