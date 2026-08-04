const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

const constants = {
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    unit: 'unit',
  },
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

function loadParry({
  meleeEquipped = true,
  isHeroControlled = false,
  chanceRolls = [],
  parryChanceBonus = 0,
  grantCalls = [],
} = {}) {
  return loadModule('app/lib/parry.ts', {
    '../constants': constants,
    './equipmentStats': { isUnitMeleeWeaponEquipped: () => meleeEquipped },
    './random': { chance: () => chanceRolls.shift() },
    './unitControl': { isHeroControlled: () => isHeroControlled },
    './unitExperience': {
      XP_CATEGORIES: { defense: 'defense' },
      XP_PARRY_SUCCESS: 5,
      getParryChanceBonus: () => parryChanceBonus,
      grantUnitXp: (unit, category, amount) => grantCalls.push({ unit, category, amount }),
    },
  })
}

function makeUnit(extra = {}) {
  return {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    ...extra,
  }
}

test('getParryChance is zero without a melee weapon regardless of level', () => {
  const { getParryChance } = loadParry({ meleeEquipped: false, parryChanceBonus: 0.3 })
  assert.equal(getParryChance(makeUnit()), 0)
})

test('getParryChance combines base chance with the defense level bonus, capped at the max', () => {
  const { getParryChance } = loadParry({ parryChanceBonus: 0 })
  assert.equal(getParryChance(makeUnit()), 0.08)

  const leveled = loadParry({ parryChanceBonus: 0.35 })
  assert.equal(leveled.getParryChance(makeUnit()), 0.43)

  const maxedOut = loadParry({ parryChanceBonus: 5 })
  assert.equal(maxedOut.getParryChance(makeUnit()), 0.45)
})

test('a recent parry success fatigues the chance for subsequent rolls within the window', () => {
  const { getParryChance, attemptAutomaticParry } = loadParry({ chanceRolls: [true] })
  const unit = makeUnit()

  const chanceBefore = getParryChance(unit, 1000)
  assert.ok(attemptAutomaticParry(unit, 1000))
  const chanceRightAfter = getParryChance(unit, 1500)
  assert.ok(chanceRightAfter < chanceBefore)

  const chanceAfterWindow = getParryChance(unit, 1000 + 4000)
  assert.equal(chanceAfterWindow, chanceBefore)
})

test('attemptAutomaticParry only applies to unit-family targets', () => {
  const { attemptAutomaticParry } = loadParry({ chanceRolls: [true] })
  const animal = makeUnit({ family: constants.FAMILY_TYPES.animal })
  assert.equal(attemptAutomaticParry(animal, 0), false)
})

test('attemptAutomaticParry never triggers for a hero-controlled unit', () => {
  const { attemptAutomaticParry } = loadParry({ isHeroControlled: true, chanceRolls: [true] })
  assert.equal(attemptAutomaticParry(makeUnit(), 0), false)
})

test('attemptAutomaticParry refuses a dead or already-downed unit', () => {
  const { attemptAutomaticParry } = loadParry({ chanceRolls: [true] })
  assert.equal(attemptAutomaticParry(makeUnit({ hitPoints: 0 }), 0), false)
  assert.equal(attemptAutomaticParry(makeUnit({ isDead: true }), 0), false)
})

test('a successful parry grants defense xp and starts the fatigue streak', () => {
  const grantCalls = []
  const { attemptAutomaticParry } = loadParry({ chanceRolls: [true], grantCalls })
  const unit = makeUnit()

  assert.ok(attemptAutomaticParry(unit, 500))
  assert.deepEqual(grantCalls, [{ unit, category: 'defense', amount: 5 }])
  assert.equal(unit.lastParrySuccessAt, 500)
  assert.equal(unit.parryStreak, 1)
})

test('a failed roll leaves the unit state untouched', () => {
  const grantCalls = []
  const { attemptAutomaticParry } = loadParry({ chanceRolls: [false], grantCalls })
  const unit = makeUnit()

  assert.equal(attemptAutomaticParry(unit, 500), false)
  assert.deepEqual(grantCalls, [])
  assert.equal(unit.lastParrySuccessAt, undefined)
})
