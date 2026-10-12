const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup(type = 'GroundWood') {
  const callbacks = []
  const messages = []
  const { collectGroundResource } = loadTsModule('app/lib/hero/heroGroundCollection.ts', {
    mocks: {
      '../resources/resourceDelivery': { getUnitResourceCapacityRemaining: hero => hero.room },
      '../contact/contactGeometry': { getContactAimDegree: () => 90 },
      './heroActionRange': { isHeroInteractionTargetReachable: (_hero, _action, target) => target.reachable },
      '../lang': { t: key => key },
    },
  })
  const hero = {
    room: 1,
    context: {
      map: {},
      scheduler: { addOneShot: callback => callbacks.push(callback) },
      menu: { showMessage: message => messages.push(message) },
    },
    sprite: { loop: true, gotoAndPlay() {} },
    setTextures(sheet) {
      this.currentSheet = sheet
    },
    stop() {},
  }
  const target = {
    family: 'resource',
    type,
    quantity: 1,
    reachable: true,
    die(immediate) {
      assert.equal(immediate, true)
      this.isDead = true
    },
  }
  return { hero, target, callbacks, messages, collect: collectGroundResource }
}

for (const [type, resource] of [
  ['GroundWood', 'wood'],
  ['GroundStone', 'stone'],
]) {
  test(`${type} collects immediately once, without changing appearance or scheduling an animation`, () => {
    const { hero, target, callbacks, collect } = setup(type)
    assert.equal(collect(hero, target), true)
    assert.equal(callbacks.length, 0)
    assert.equal(collect(hero, target), false)
    assert.equal(hero.currentSheet, undefined)
    assert.deepEqual(hero.inventory.resources, { [resource]: 1 })
    assert.equal(target.quantity, 0)
    assert.equal(target.isDead, true)
    assert.equal(hero.actionLocked, undefined)
    assert.equal(hero.sprite.loop, true)
  })
}

test('full bag leaves the resource available and shows a message', () => {
  const { hero, target, callbacks, messages, collect } = setup()
  hero.room = 0
  assert.equal(collect(hero, target), false)
  assert.equal(callbacks.length, 0)
  assert.equal(target.quantity, 1)
  assert.deepEqual(messages, ['heroBagFull'])
})

for (const reason of ['range', 'depleted', 'locked', 'dead']) {
  test(`collection rejects ${reason} before crediting`, () => {
    const { hero, target, callbacks, collect } = setup()
    if (reason === 'range') target.reachable = false
    if (reason === 'depleted') target.isDead = true
    if (reason === 'locked') hero.actionLocked = true
    if (reason === 'dead') hero.isDead = true
    assert.equal(collect(hero, target), false)
    assert.equal(callbacks.length, 0)
    assert.equal(hero.inventory, undefined)
    assert.equal(target.quantity, 1)
  })
}

test('two collectors cannot duplicate the same resource', () => {
  const first = setup()
  const second = setup()
  first.collect(first.hero, first.target)
  second.collect(second.hero, first.target)
  assert.deepEqual(first.hero.inventory.resources, { wood: 1 })
  assert.equal(second.hero.inventory, undefined)
  assert.equal(second.hero.actionLocked, undefined)
})

test('collected ground resources remain absent after restoring a blueprint save', () => {
  const { CompactResourceSet } = loadTsModule('app/classes/resources/CompactResourceSet.ts')
  const { resourceData } = loadTsModule('app/serialization/ResourceSaveData.ts')
  const create = () => {
    const resources = new CompactResourceSet(
      4,
      10,
      'blueprint',
      () => ({ totalQuantity: 1 }),
      state => ({ ...state }),
      {}
    )
    resources.addState({ i: 1, j: 1, type: 'GroundWood', textureName: '000_resources/ground' })
    resources.addState({ i: 2, j: 2, type: 'GroundStone', textureName: '003_resources/ground' })
    resources.sealBlueprintBaseline()
    return resources
  }
  const resources = create()
  const target = resources.atCell(11)
  Object.assign(target, {
    family: 'resource',
    quantity: 1,
    reachable: true,
    die() {
      resources.delete(this)
      this.isDead = true
    },
  })
  const { hero, collect } = setup()
  assert.equal(collect(hero, target), true)
  const saved = JSON.parse(JSON.stringify(resources.saveDelta(resourceData)))
  const restored = create()
  restored.restoreDelta(saved.resourceDelta, saved.resources, () => {})
  assert.equal(restored.atCell(11), null)
  assert.equal(restored.atCell(22).type, 'GroundStone')
  assert.deepEqual(hero.inventory.resources, { wood: 1 })
})
