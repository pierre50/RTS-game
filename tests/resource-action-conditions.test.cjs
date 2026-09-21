const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const constants = loadTsModule('app/lib/constants.ts')
const { FAMILY_TYPES: F, UNIT_TYPES: U, RESOURCE_TYPES: R } = constants
const { getResourceActionConditions, isWheatMature } = loadTsModule('app/lib/combat/resourceActionConditions.ts', {
  mocks: {
    '../horses/horseTaming': { isWildHorse: horse => horse.tamingStatus !== 'tamed' },
  },
})
const villager = () => ({ type: U.villager, owner: { age: 2 } })
const available = { quantity: 5, hitPoints: 10, isDead: false }
const allowed = (action, source, target) => Boolean(getResourceActionConditions(source, target)[action]?.())

test('villagers can hunt from the first age without technologies', () => {
  const source = { type: U.villager, owner: { age: 0 } }
  assert.equal(allowed('hunt', source, { ...available, family: F.animal, type: 'Deer' }), true)
})

test('gathering respects worker, resource, stock and age requirements', () => {
  for (const [action, type] of [
    ['forageberry', R.berrybush],
    ['chopwood', R.tree],
    ...Object.entries(constants.MINING_RESOURCE_CONFIG).map(([type, config]) => [config.action, type]),
  ]) {
    const target = { ...available, type }
    assert.equal(allowed(action, villager(), target), true, action)
    assert.equal(allowed(action, { ...villager(), type: U.hero }, target), true)
    assert.equal(allowed(action, { type: U.priest }, target), false)
    for (const patch of [{ quantity: 0 }, { quantity: undefined }, { isDead: true }, { type: undefined }]) {
      assert.equal(allowed(action, villager(), { ...target, ...patch }), false, `${action}: ${JSON.stringify(patch)}`)
    }
    if (action.startsWith('mine')) {
      assert.equal(allowed(action, { type: U.villager }, target), type !== R.iron)
      assert.equal(allowed(action, { type: U.villager, owner: {} }, target), type !== R.iron)
    }
  }
  const bush = { ...available, type: R.berrybush, quantity: 0 }
  assert.equal(allowed('chopwood', villager(), bush), true)
  assert.equal(allowed('chopwood', villager(), { ...bush, hitPoints: undefined }), false)
})

test('iron mining requires at least a bronze work pickaxe for heroes and villagers', () => {
  const iron = { ...available, type: R.iron }
  for (const age of [0, 1, 2, 3]) {
    for (const type of [U.villager, U.hero]) {
      assert.equal(allowed('mineiron', { type, owner: { age } }, iron), age >= 1)
    }
  }
})

test('hunting, collecting meat and capturing horses follow animal state', () => {
  const animal = { ...available, family: F.animal, type: 'Horse' }
  assert.equal(allowed('hunt', villager(), animal), true)
  assert.equal(allowed('hunt', { type: U.villager }, animal), true)
  assert.equal(allowed('hunt', { type: U.hero }, animal), true)
  for (const patch of [{ quantity: undefined }, { hitPoints: undefined }, { isDead: true }, { family: F.unit }]) {
    assert.equal(allowed('hunt', villager(), { ...animal, ...patch }), false)
  }
  assert.equal(allowed('takemeat', villager(), animal), false)
  assert.equal(allowed('takemeat', villager(), { ...animal, isDead: true }), true)
  assert.equal(allowed('takemeat', villager(), { ...animal, isDead: true, isDestroyed: true }), false)
  assert.equal(allowed('captureHorse', villager(), animal), true)
  for (const patch of [
    { type: 'Wolf' },
    { tamingStatus: 'tamed' },
    { hitPoints: undefined },
    { isDead: true },
    { isDestroyed: true },
    { isCatchingPoleCaught: true },
  ]) {
    assert.equal(allowed('captureHorse', villager(), { ...animal, ...patch }), false)
  }
  assert.equal(allowed('captureHorse', { type: U.hero }, animal), false)
})

test('mature wheat respects ownership of the harvest task while allowing the hero', () => {
  const source = villager()
  const wheat = { ...available, type: R.wheat, sprite: { currentFrame: 1, textures: ['growing', 'mature'] } }
  assert.equal(allowed('farm', source, wheat), true)
  assert.equal(allowed('farm', source, { ...wheat, isUsedBy: source }), true)
  assert.equal(allowed('farm', source, { ...wheat, isUsedBy: {} }), false)
  assert.equal(allowed('farm', { ...source, type: U.hero }, { ...wheat, isUsedBy: {} }), true)
  assert.equal(allowed('farm', { type: U.villager }, wheat), true)
  assert.equal(allowed('farm', source, { ...wheat, quantity: undefined }), false)
  for (const target of [
    null,
    {},
    { type: R.wheat },
    { type: R.wheat, sprite: {} },
    { type: R.wheat, sprite: { currentFrame: 0 } },
    { type: R.wheat, sprite: { currentFrame: 0, textures: [] } },
    { ...wheat, sprite: { ...wheat.sprite, currentFrame: 0 } },
  ]) {
    assert.equal(isWheatMature(target), false)
  }
})
