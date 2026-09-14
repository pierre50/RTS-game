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

test('AI protects a non-chief guest of its faction only near home and against a seen enemy', () => {
  let visible = true
  const { AIThreatManager } = loadTsModule('app/ai/AIThreatManager.ts', { mocks: {
    '../lib/units/playerTargetKnowledge': { playerSeesTarget: () => visible },
    '../lib': { findInstancesInSight: () => [] },
  } })
  const hero = { type: 'Hero', isChief: false, label: 'hero', i: 6, j: 6, owner: { label: 'guest', factionId: 'host' } }
  const enemy = { label: 'enemy', family: 'unit', owner: { label: 'invaders' } }
  const threats = new Map()
  const manager = new AIThreatManager({ label: 'village', factionId: 'host',
    context: { controls: { heroUnit: hero } }, difficultyConfig: {},
    buildingsByTypes: () => [{ i: 5, j: 5 }], getNow: () => 0,
    threatenedTargets: threats, enemyUnitMemory: new Map(), isEnemy: owner => owner === enemy.owner,
  })
  manager.reportThreat(hero, enemy)
  assert.equal(threats.size, 1)
  for (const scenario of ['chief', 'far', 'hidden', 'other-faction']) {
    threats.clear()
    hero.isChief = scenario === 'chief'
    hero.i = scenario === 'far' ? 80 : 6
    visible = scenario !== 'hidden'
    hero.owner.factionId = scenario === 'other-faction' ? 'other' : 'host'
    manager.reportThreat(hero, enemy)
    assert.equal(threats.size, 0, scenario)
  }
})
