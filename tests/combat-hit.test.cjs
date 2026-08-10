const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

const constants = {
  MENU_INFO_IDS: { hitPoints: 'hitPoints' },
}

const entityHealthDisplayMock = {
  syncEntityHealthDisplay: () => {},
}

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

function loadCombatHit({ rawDamage = 6, parryResult = false, grantCalls = [], feedbackCalls = [] } = {}) {
  return loadModule('app/lib/combatHit.ts', {
    '../constants': constants,
    './combat': { getHitPointsWithDamage: (source, target) => (target.hitPoints ?? 0) - rawDamage },
    './combatFeedback': {
      showDamageFeedback: (target, damage) => feedbackCalls.push({ kind: 'damage', target, damage }),
      showParryFeedback: (target, text) => feedbackCalls.push({ kind: 'parry', target, text }),
    },
    './entityHealthDisplay': entityHealthDisplayMock,
    './lang': { t: key => key },
    './parry': { attemptAutomaticParry: () => parryResult },
    './unitExperience': {
      XP_KILL_BONUS: 15,
      grantUnitXp: (unit, category, amount) => grantCalls.push({ unit, category, amount }),
    },
  })
}

function makeTarget(extra = {}) {
  return { hitPoints: 20, totalHitPoints: 20, ...extra }
}

test('a non-melee hit deals damage and grants the attacker xp as before', () => {
  const grantCalls = []
  const feedbackCalls = []
  const { applyCombatHit } = loadCombatHit({ rawDamage: 6, grantCalls, feedbackCalls })
  const target = makeTarget()

  const { damageDealt, killed } = applyCombatHit({}, target, { xpCategory: 'melee', xpUnit: 'attacker' })

  assert.equal(target.hitPoints, 14)
  assert.equal(damageDealt, 6)
  assert.equal(killed, false)
  assert.deepEqual(grantCalls, [{ unit: 'attacker', category: 'melee', amount: 6 }])
  assert.deepEqual(feedbackCalls, [{ kind: 'damage', target, damage: 6 }])
})

test('isMelee is required to even attempt a parry — a ranged hit never rolls one', () => {
  let parryAttempts = 0
  const { applyCombatHit } = loadModule('app/lib/combatHit.ts', {
    '../constants': constants,
    './combat': { getHitPointsWithDamage: (source, target) => (target.hitPoints ?? 0) - 6 },
    './combatFeedback': { showDamageFeedback: () => {}, showParryFeedback: () => {} },
    './entityHealthDisplay': entityHealthDisplayMock,
    './lang': { t: key => key },
    './parry': {
      attemptAutomaticParry: () => {
        parryAttempts++
        return true
      },
    },
    './unitExperience': { XP_KILL_BONUS: 15, grantUnitXp: () => {} },
  })
  const target = makeTarget()

  applyCombatHit({}, target, {})

  assert.equal(parryAttempts, 0)
  assert.equal(target.hitPoints, 14)
})

test('a successful automatic parry negates damage and shows parry feedback instead', () => {
  const grantCalls = []
  const feedbackCalls = []
  const { applyCombatHit } = loadCombatHit({ rawDamage: 6, parryResult: true, grantCalls, feedbackCalls })
  const target = makeTarget()
  const notified = []
  target.isAttacked = attacker => notified.push(attacker)

  const { damageDealt, killed } = applyCombatHit({}, target, { isMelee: true, xpCategory: 'melee', xpUnit: 'attacker' })

  assert.equal(target.hitPoints, 20)
  assert.equal(damageDealt, 0)
  assert.equal(killed, false)
  assert.deepEqual(grantCalls, [])
  assert.deepEqual(feedbackCalls, [{ kind: 'parry', target, text: 'heroDefenseMissed' }])
  assert.equal(notified.length, 1)
})

test('a failed parry roll falls through to the normal damage flow', () => {
  const grantCalls = []
  const feedbackCalls = []
  const { applyCombatHit } = loadCombatHit({ rawDamage: 6, parryResult: false, grantCalls, feedbackCalls })
  const target = makeTarget()

  const { damageDealt } = applyCombatHit({}, target, { isMelee: true, xpCategory: 'melee', xpUnit: 'attacker' })

  assert.equal(target.hitPoints, 14)
  assert.equal(damageDealt, 6)
  assert.deepEqual(grantCalls, [{ unit: 'attacker', category: 'melee', amount: 6 }])
  assert.deepEqual(feedbackCalls, [{ kind: 'damage', target, damage: 6 }])
})
