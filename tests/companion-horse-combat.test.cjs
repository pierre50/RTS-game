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

function loadCompanionHorseCombat() {
  return loadModule('app/lib/companionHorseCombat.ts', {
    '../constants': { FAMILY_TYPES: { animal: 'animal' } },
    './lang': { t: key => key },
  })
}

test('a linked companion horse absorbs the first two owner hits', () => {
  const { handleCompanionHorseDamage } = loadCompanionHorseCombat()
  const hero = { label: 'hero' }
  const fleeCalls = []
  const horse = {
    family: 'animal',
    type: 'Horse',
    companionOwner: hero,
    companionHitCount: 0,
    isAttacked: (...args) => fleeCalls.push(args),
  }

  assert.equal(handleCompanionHorseDamage({ attacker: hero, target: horse, damageDealt: 1, killed: false }), true)
  assert.equal(handleCompanionHorseDamage({ attacker: hero, target: horse, damageDealt: 1, killed: false }), true)

  assert.equal(horse.companionOwner, hero)
  assert.equal(horse.companionHitCount, 2)
  assert.deepEqual(fleeCalls, [])
})

test('a linked companion horse flees and unlinks after three damaging owner hits', () => {
  const messages = []
  const { handleCompanionHorseDamage } = loadCompanionHorseCombat()
  const hero = {
    label: 'hero',
    companionHorseColor: 'gray',
    context: { menu: { showMessage: (...args) => messages.push(args) } },
  }
  const fleeCalls = []
  const behaviorCalls = []
  const horse = {
    family: 'animal',
    type: 'Horse',
    companionOwner: hero,
    companionHitCount: 2,
    ambientMovement: false,
    animalBehavior: { start: () => behaviorCalls.push('start') },
    isAttacked: (attacker, hitDirection) => fleeCalls.push([attacker, hitDirection]),
  }
  const hitDirection = { x: 2, y: 0 }

  const handled = handleCompanionHorseDamage({
    attacker: hero,
    target: horse,
    damageDealt: 1,
    killed: false,
    hitDirection,
  })

  assert.equal(handled, true)
  assert.equal(hero.companionHorseColor, null)
  assert.equal(horse.companionOwner, null)
  assert.equal(horse.companionHitCount, 0)
  assert.equal(horse.strategy, 'runaway')
  assert.equal(horse.ambientMovement, true)
  assert.deepEqual(behaviorCalls, ['start'])
  assert.deepEqual(fleeCalls, [[hero, hitDirection]])
  assert.deepEqual(messages, [['heroHorseLinkBroken', 'warning']])
})

test('a killed linked companion horse only clears the link', () => {
  const { handleCompanionHorseDamage } = loadCompanionHorseCombat()
  const hero = { label: 'hero', companionHorseColor: 'black' }
  const fleeCalls = []
  const horse = {
    family: 'animal',
    type: 'Horse',
    companionOwner: hero,
    companionHitCount: 2,
    isAttacked: (...args) => fleeCalls.push(args),
  }

  const handled = handleCompanionHorseDamage({ attacker: hero, target: horse, damageDealt: 5, killed: true })

  assert.equal(handled, false)
  assert.equal(hero.companionHorseColor, null)
  assert.equal(horse.companionOwner, null)
  assert.equal(horse.companionHitCount, 0)
  assert.deepEqual(fleeCalls, [])
})
