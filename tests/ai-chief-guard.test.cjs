const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

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
  const localRequire = request => {
    if (request === './Player') return { Player: class {} }
    if (request === '../../lib') {
      return {
        canAfford: () => true,
        findInstancesInSight: () => [],
        getClosestInstance: () => null,
        getPositionInGridAroundInstance: () => null,
        instancesDistance: (a, b) => Math.hypot((a.i ?? 0) - (b.i ?? 0), (a.j ?? 0) - (b.j ?? 0)),
        isPlayerEliminated: () => false,
      }
    }
    if (request === '../../constants') {
      return {
        ACTION_TYPES: { attack: 'attack' },
        BUILDING_TYPES: { townCenter: 'TownCenter' },
        FAMILY_TYPES: {},
        PLAYER_TYPES: { ai: 'AI' },
        RESOURCE_TYPES: {},
        UNIT_TYPES: { chief: 'Chief', villager: 'Villager' },
        WORK_TYPES: { attacker: 'attacker' },
      }
    }
    if (request === '../../ai/AIStrategy') return { AIStrategy: class {} }
    if (request === '../../ai/AIEconomy') return { AIEconomy: class {} }
    if (request === '../../ai/unitGroups') return { classifyMilitaryUnits: () => ({ infantry: [], archers: [], cavalry: [] }), isAliveUnit: () => true }
    if (request === '../../lib/chief') {
      return {
        AI_CHIEF_SUCCESSION_DELAY_MS: 180000,
        isChiefUnit: unit => Boolean(unit?.isChief || unit?.type === 'Chief'),
        isLivingChief: unit => Boolean((unit?.isChief || unit?.type === 'Chief') && !unit?.isDead && !unit?.isDestroyed),
      }
    }
    if (request === '../../lib/lpc') return { refreshBakedLpcUnitAssets: () => {} }
    return require(request)
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
