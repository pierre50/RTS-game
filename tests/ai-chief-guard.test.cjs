const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

test('an obsolete AI cannot remove a restored player and death is idempotent', () => {
  const AI = loadAI()
  const removed = []
  const restored = { label: 'restored' }
  const players = [restored]
  const ai = Object.create(AI.prototype)
  Object.assign(ai, {
    _stepTaskId: 42,
    _chiefEscortTaskId: 43,
    context: { players, scheduler: { remove: id => removed.push(id) } },
  })
  ai.die()
  ai.die()
  assert.deepEqual(players, [restored])
  assert.deepEqual(removed, [42, 43])
  players.unshift(ai)
  ai.die()
  assert.deepEqual(players, [restored])
})

function loadAI() {
  const filename = path.join(__dirname, '../app/classes/players/AIPlayer.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [
      ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
      ['@babel/preset-typescript', { allowDeclareFields: true }],
    ],
  })
  const module = { exports: {} }
  const loadAiTsModule = modulePath => {
    const moduleFilename = path.join(__dirname, `../app/ai/${modulePath}.ts`)
    const moduleSource = fs.readFileSync(moduleFilename, 'utf8')
    const { code: moduleCode } = babel.transformSync(moduleSource, {
      filename: moduleFilename,
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
        ['@babel/preset-typescript', { allowDeclareFields: true }],
      ],
    })
    const tsModule = { exports: {} }
    new Function('module', 'exports', 'require', moduleCode)(tsModule, tsModule.exports, localRequire)
    return tsModule.exports
  }
  const defenseMocks = {
    '../../ai/AITheftDefense': { handleInteriorTheftDefense: () => false, isInteriorTheftDefender: () => false },
  }
  const localRequire = request => {
    if (defenseMocks[request]) return defenseMocks[request]
    if (request.endsWith('/playerTargetKnowledge'))
      return { playerSeesTarget: () => true, knownTarget: (_owner, target) => target, observeTarget: () => undefined }
    if (request.endsWith('/targetPursuit'))
      return { updateTargetPursuit: () => false, routeToRememberedTarget: () => false }

    if (request === './Player') return { Player: class {} }
    if (request === '../../lib' || request === '../lib') {
      return {
        canAfford: () => true,
        findInstancesInSight: () => [],
        getClosestInstance: () => null,
        getPositionInGridAroundInstance: () => null,
        instancesDistance: (a, b) => Math.hypot((a.i ?? 0) - (b.i ?? 0), (a.j ?? 0) - (b.j ?? 0)),
        isPlayerEliminated: () => false,
      }
    }
    if (request === '../../constants' || request === '../constants') {
      return {
        ACTION_TYPES: { attack: 'attack' },
        BUILDING_TYPES: { townCenter: 'TownCenter' },
        FAMILY_TYPES: { unit: 'unit' },
        PLAYER_TYPES: { ai: 'AI' },
        RESOURCE_TYPES: {},
        UNIT_TYPES: { chief: 'Chief', villager: 'Villager' },
        WORK_TYPES: { attacker: 'attacker' },
      }
    }
    if (request === '../../ai/AIStrategy') return { AIStrategy: class {} }
    if (request === '../../ai/AIEconomy') return { AIEconomy: class {} }
    if (request === './AIPlayerBehavior') return requireFromTsFile(request, filename, defenseMocks)
    if (request === '../../ai/AIThreatManager') {
      return loadAiTsModule('AIThreatManager')
    }
    if (request === './AIThreatProfiles') return loadAiTsModule('AIThreatProfiles')
    if (request === './AIThreatResponses') return loadAiTsModule('AIThreatResponses')
    if (request === '../../ai/unitGroups')
      return { classifyMilitaryUnits: () => ({ infantry: [], archers: [], cavalry: [] }), isAliveUnit: () => true }
    if (request === '../../lib/chief' || request === '../lib/chief') {
      return {
        AI_CHIEF_SUCCESSION_DELAY_MS: 180000,
        isChiefUnit: unit => Boolean(unit?.isChief || unit?.type === 'Chief'),
        isLivingChief: unit =>
          Boolean((unit?.isChief || unit?.type === 'Chief') && !unit?.isDead && !unit?.isDestroyed),
      }
    }
    if (request === '../../lib/lpc') return { refreshBakedLpcUnitAssets: () => {} }
    return requireFromTsFile(request, filename, defenseMocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.AI
}

function createAi({ hero, hostile = false } = {}) {
  const AI = loadAI()
  return Object.assign(Object.create(AI.prototype), {
    context: {
      controls: { heroUnit: hero ?? null },
      map: {
        grid: [],
        randomRange: () => 10000,
      },
    },
    chiefWanderReadyAt: new Map(),
    getNow: () => 0,
    getVisibleHostilesNear: () => [],
    getEnemyMemories: () => [],
    isEnemy: () => hostile,
  })
}

test('neutral ai chief walks toward the hero while the hero is inside the forum zone', () => {
  const heroOwner = { isEnemy: () => false }
  const hero = { i: 6, j: 0, owner: heroOwner }
  const ai = createAi({ hero })
  const calls = []
  const chief = {
    label: 'chief',
    type: 'Chief',
    i: 0,
    j: 0,
    sendTo: target => calls.push(target),
  }
  ai.getLivingChiefs = () => [chief]
  const forum = { i: 0, j: 0, isBuilt: true }

  assert.equal(ai.handleChiefGuard([forum]), 1)
  assert.deepEqual(calls, [hero])
})

test('neutral ai chief does not leave the forum zone to greet the hero', () => {
  const heroOwner = { isEnemy: () => false }
  const hero = { i: 12, j: 0, owner: heroOwner }
  const ai = createAi({ hero })
  const calls = []
  const chief = {
    label: 'chief',
    type: 'Chief',
    i: 0,
    j: 0,
    sendTo: target => calls.push(target),
  }
  ai.getLivingChiefs = () => [chief]
  const forum = { i: 0, j: 0, isBuilt: true }

  assert.equal(ai.handleChiefGuard([forum]), 0)
  assert.deepEqual(calls, [])
})

test('visible enemy defense sends chief, military and villagers to attack', () => {
  const heroOwner = { isEnemy: () => true }
  const hero = { label: 'hero', family: 'unit', type: 'Hero', i: 12, j: 0, hitPoints: 30, owner: heroOwner }
  const ai = createAi({ hero, hostile: true })
  ai.getEnemyMemories = () => [{ instance: hero, visible: true, lastSeenAt: 0 }]
  const calls = []
  const chief = {
    label: 'chief',
    type: 'Chief',
    i: 0,
    j: 0,
    sendTo: (target, action) => calls.push([target, action]),
  }
  const soldier = {
    label: 'soldier',
    type: 'Fantassin',
    i: 1,
    j: 0,
    sendTo: (target, action) => calls.push([target, action]),
  }
  const villager = {
    label: 'villager',
    type: 'Villager',
    i: 2,
    j: 0,
    sendToAttack: (target, options) => calls.push([target, 'sendToAttack', options]),
  }
  ai.getLivingChiefs = () => [chief]
  const forum = { i: 0, j: 0, isBuilt: true }

  assert.deepEqual(ai.handleVisibleEnemyDefense({ villagers: [villager], military: [soldier], towncenters: [forum] }), {
    actions: 3,
    active: true,
  })
  assert.deepEqual(calls, [
    [hero, 'attack'],
    [hero, 'attack'],
    [hero, 'sendToAttack', { keepPrevious: true }],
  ])
})

test('hostile ai chief does not greet the hero diplomatically', () => {
  const heroOwner = { isEnemy: () => false }
  const hero = { i: 6, j: 0, owner: heroOwner }
  const ai = createAi({ hero, hostile: true })
  const calls = []
  const chief = {
    label: 'chief',
    type: 'Chief',
    i: 0,
    j: 0,
    sendTo: target => calls.push(target),
  }
  ai.getLivingChiefs = () => [chief]
  const forum = { i: 0, j: 0, isBuilt: true }

  assert.equal(ai.handleChiefGuard([forum]), 0)
  assert.deepEqual(calls, [])
})

test('a faction keeps one chief across its AI owners and elects only one successor', () => {
  const a = createAi(),
    b = createAi()
  const chiefs = [a, b].map((owner, i) => ({ type: 'Chief', label: `chief${i}`, owner }))
  for (const [i, owner] of [a, b].entries()) {
    owner.type = 'AI'
    owner.factionId = 'shared'
    owner.units = [chiefs[i]]
    owner.context.players = [a, b]
  }
  a.refreshChiefSuccession([])
  assert.equal(chiefs[0].type, 'Chief')
  assert.equal(chiefs[1].type, 'Villager')
  chiefs[0].isDead = true
  const candidate = { type: 'Villager', label: 'candidate', owner: a }
  a.units.push(candidate)
  a.getNow = b.getNow = () => 0
  a.refreshChiefSuccession([candidate])
  b.refreshChiefSuccession([chiefs[1]])
  a.getNow = b.getNow = () => 180001
  b.refreshChiefSuccession([chiefs[1]])
  a.refreshChiefSuccession([candidate])
  assert.equal(candidate.isChief, true)
  assert.equal(chiefs[1].isChief, false)
})

test('rest and interior movement take precedence over chief patrol', () => {
  const ai = createAi({ hero: { i: 6, j: 0, owner: {} } })
  const calls = []
  for (const rest of [{ shelterState: { status: 'inside' } }, { actionLocked: true }, { spaceId: 'interior:forum' }]) {
    ai.getLivingChiefs = () => [{ type: 'Chief', i: 0, j: 0, ...rest, sendTo: target => calls.push(target) }]
    assert.equal(ai.handleChiefGuard([{ i: 0, j: 0, isBuilt: true }]), 0)
  }
  assert.deepEqual(calls, [])
})

test('chief patrol waits 30 to 60 seconds between destinations', () => {
  const ai = createAi()
  ai.context.map.randomRange = (min, max) => {
    assert.deepEqual([min, max], [30000, 60000])
    return 45000
  }
  ai.getLivingChiefs = () => [
    {
      label: 'chief',
      type: 'Chief',
      i: 0,
      j: 0,
      inactif: true,
      context: { dayNight: { state: { hour: 10, minute: 0 } } },
    },
  ]
  ai.handleChiefGuard([{ i: 0, j: 0, isBuilt: true }])
  assert.equal(ai.chiefWanderReadyAt.get('chief'), 45000)
})
