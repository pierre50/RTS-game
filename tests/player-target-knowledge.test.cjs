const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { VisionGrid } = loadTsModule('app/services/VisionGrid.ts')
const knowledge = loadTsModule('app/lib/units/playerTargetKnowledge.ts')
function scene() {
  const owner = { units: [], buildings: [], views: new VisionGrid(32) }
  const chief = { owner, i: 0, j: 0, sight: 3, spaceId: 'outside', label: 'chief' }
  const archer = { owner, i: 7, j: 0, sight: 4, spaceId: 'outside', label: 'archer' }
  owner.units.push(chief, archer)
  const hero = { label: 'hero', type: 'Hero', family: 'unit', i: 9, j: 0, spaceId: 'outside', hitPoints: 40 }
  owner.views.addViewer(9, 0, archer)
  return { owner, chief, archer, hero }
}

test('native AI knows resources without revealing foreign units or buildings of any relation', () => {
  const { owner, hero } = scene()
  Object.assign(owner, { type: 'AI', civ: 'Hellas', context: {
    map: { mapType: 'world-region', settlements: [{ kind: 'village', civ: 'Hellas' }] },
  } })
  owner.buildings.push({ type: 'TownCenter', isBuilt: true, i: 0, j: 0, sight: 3 })
  const tree = { label: 'remote-tree', type: 'Tree', family: 'resource', i: 25, j: 25, quantity: 100 }
  assert.equal(knowledge.playerSeesTarget(owner, tree), false)
  assert.equal(knowledge.knownTarget(owner, tree).quantity, 100)
  tree.quantity = 20
  assert.equal(knowledge.knownTarget(owner, tree).quantity, 20)
  assert.equal(owner.views.isViewed(25, 25), false)
  for (const relation of ['ally', 'neutral', 'enemy']) {
    for (const family of ['unit', 'building', 'animal']) {
      const target = { ...hero, label: `${relation}-${family}`, family, i: 25, j: 25, owner: { relation } }
      assert.equal(knowledge.playerSeesTarget(owner, target), false)
      assert.equal(knowledge.knownTarget(owner, target), undefined)
    }
  }
  assert.equal(knowledge.knownTarget(owner, { ...tree, label: 'interior-tree', spaceId: 'interior:cave' }), undefined)
  owner.context.map.settlements = [{ kind: 'village', civ: 'Kemet' }]
  assert.equal(knowledge.knownTarget(owner, { ...tree, label: 'foreign-tree' }), undefined)
})
test('another unit shares detection; camera visibility and explored terrain never grant knowledge', () => {
  const { owner, hero } = scene()
  assert.equal(knowledge.playerSeesTarget(owner, hero), true)
  knowledge.observeTarget(owner, hero)
  owner.views.removeViewer(9, 0, owner.units[1])
  hero.i = 20
  hero.visible = true
  owner.views.setViewed(20, 0)
  assert.equal(knowledge.playerSeesTarget(owner, hero), false)
  assert.equal(knowledge.knownTarget(owner, hero).i, 9)
  const restored = {}
  knowledge.restoreTargetKnowledge(restored, knowledge.exportTargetKnowledge(owner))
  assert.equal(knowledge.knownTarget(restored, hero).i, 9)
})
test('interior and exterior sightings are separate, and stealth applies to every observer', () => {
  const { owner, hero, archer } = scene()
  hero.spaceId = 'interior:cave'
  assert.equal(knowledge.playerSeesTarget(owner, hero), false)
  hero.spaceId = 'outside'
  archer.context = { controls: { heroUnit: hero, isHeroStealthMode: () => true } }
  archer.i = 5
  assert.equal(knowledge.playerSeesTarget(owner, hero), false)
})
test('resource changes remain unknown on unexplored terrain', () => {
  const { owner, archer, hero } = scene()
  const tree = { ...hero, type: 'Tree', family: 'resource', quantity: 10 }
  knowledge.observeTarget(owner, tree)
  owner.views.removeViewer(9, 0, archer)
  tree.quantity = 0
  tree.isDestroyed = true
  assert.equal(knowledge.knownTarget(owner, tree).quantity, 10)
  owner.views.addViewer(9, 0, archer)
  assert.equal(knowledge.knownTarget(owner, tree).quantity, 0)
})

test('explored fog refreshes regrowth and new wildlife without revealing other players', () => {
  for (const type of ['Human', 'AI']) {
    const { owner } = scene()
    owner.type = type
    owner.views.setViewed(25, 25)
    const tree = { label: 'new-tree', type: 'Tree', family: 'resource', i: 25, j: 25, quantity: 0, isDestroyed: true }
    assert.equal(knowledge.knownTarget(owner, tree).quantity, 0)
    tree.quantity = 100
    tree.isDestroyed = false
    assert.equal(knowledge.knownTarget(owner, tree).quantity, 100)
    const animal = { ...tree, label: 'new-deer', family: 'animal', type: 'Deer', owner: { type: 'Gaia' } }
    assert.ok(knowledge.knownTarget(owner, animal))
    assert.equal(knowledge.playerSeesTarget(owner, animal), false)
    for (const family of ['unit', 'building', 'animal', 'resource']) {
      const foreign = { ...animal, family, label: `foreign-${family}`, owner: { type: 'Human' } }
      assert.equal(knowledge.knownTarget(owner, foreign), undefined)
    }
    assert.equal(knowledge.knownTarget(owner, { ...animal, label: 'tamed', tamingStatus: 'tamed' }), undefined)
    assert.equal(knowledge.knownTarget(owner, { ...tree, label: 'interior', spaceId: 'interior:cave' }), undefined)
    assert.equal(knowledge.knownTarget(owner, { ...tree, label: 'unexplored', i: 26 }), undefined)
    const snapshot = knowledge.exportTargetKnowledge(owner)
    knowledge.restoreTargetKnowledge(owner, snapshot)
    tree.quantity = 50
    assert.equal(knowledge.knownTarget(owner, tree).quantity, 50)
  }
})

test('a nonempty resource cache does not hide a new regrowth in explored fog', () => {
  const { owner } = scene()
  owner.views.setViewed(25, 25)
  const old = { label: 'old', family: 'resource', type: 'Tree', i: 25, j: 25, quantity: 0 }
  const fresh = { ...old, label: 'fresh', quantity: 100 }
  owner.foundedResources = { Tree: new Set([old]) }
  const { knownResources } = loadTsModule('app/lib/units/autonomy/villagerKnownTargets.ts', {
    mocks: { '../playerTargetKnowledge': knowledge },
  })
  const unit = { owner, i: 0, j: 0, context: { map: { resources: new Set([fresh]) } } }
  assert.deepEqual(knownResources(unit, 'Tree'), [fresh])
})
test('lost targets route to the remembered cell and resume only after shared detection', () => {
  const { owner, chief, hero } = scene()
  knowledge.observeTarget(owner, hero)
  owner.views.removeViewer(9, 0, owner.units[1])
  hero.i = 25
  const cell = { i: 9, j: 0 }
  const commands = []
  chief.context = { map: { grid: [] } }
  chief.context.map.grid[9] = [cell]
  chief.sendToEvt = (dest, action) => {
    chief.dest = dest
    chief.action = action
    commands.push({ dest, action })
  }
  const pursuit = loadTsModule('app/lib/units/targetPursuit.ts', {
    mocks: {
      './playerTargetKnowledge': knowledge,
      '../mapSpaces': {
        getEntitySpaceMapLike: unit => unit.context.map,
        sameMapSpace: (a, b) => a.spaceId === b.spaceId,
      },
    },
  })
  assert.equal(pursuit.routeToRememberedTarget(chief, hero, 'attack'), true)
  assert.equal(commands[0].dest, cell)
  assert.equal(commands[0].action, null)
  hero.i = 9
  owner.views.addViewer(9, 0, owner.units[1])
  assert.equal(pursuit.updateTargetPursuit(chief), true)
  assert.equal(commands[1].dest, hero)
  assert.equal(commands[1].action, 'attack')
})

test('movement updates a chief target through the archer vision and freezes it when everyone loses sight', () => {
  const { owner, chief, hero, archer } = scene()
  const { UnitMovement } = loadTsModule('app/classes/unit/movement/UnitMovement.ts', {
    mocks: {
      '../../../lib': {},
      '../../../lib/units/playerTargetKnowledge': knowledge,
      './UnitMovementHelpers': {},
      './UnitDirectMovement': {},
      './UnitMovementRouting': {},
      './UnitPathMovement': {},
      './UnitAffectNewDest': {},
    },
  })
  chief.dest = hero
  chief.realDest = { i: 8, j: 0 }
  assert.equal(UnitMovement.prototype.destHasMoved.call({ unit: chief }), true)
  owner.views.removeViewer(9, 0, archer)
  hero.i = 25
  assert.equal(UnitMovement.prototype.destHasMoved.call({ unit: chief }), false)
  assert.equal(knowledge.knownTarget(owner, hero).i, 9)
})

test('manual orders cancel an ongoing remembered-target search', () => {
  const { owner, chief, hero, archer } = scene()
  knowledge.observeTarget(owner, hero)
  owner.views.removeViewer(9, 0, archer)
  const cell = { i: 9, j: 0 }
  chief.context = { map: { grid: [] } }
  chief.context.map.grid[9] = [cell]
  chief.sendToEvt = (dest, action) => {
    chief.dest = dest
    chief.action = action
  }
  const pursuit = loadTsModule('app/lib/units/targetPursuit.ts', {
    mocks: {
      './playerTargetKnowledge': knowledge,
      '../mapSpaces': {
        getEntitySpaceMapLike: unit => unit.context.map,
        sameMapSpace: (a, b) => a.spaceId === b.spaceId,
      },
    },
  })
  pursuit.routeToRememberedTarget(chief, hero, 'attack')
  const manual = { i: 0, j: 2 }
  chief.sendToEvt(manual, null)
  owner.views.addViewer(9, 0, archer)
  assert.equal(pursuit.updateTargetPursuit(chief), false)
  assert.equal(chief.dest, manual)
})

test('invalid or duplicated saved knowledge is rejected', () => {
  const { owner, hero } = scene()
  knowledge.observeTarget(owner, hero)
  const records = knowledge.exportTargetKnowledge(owner)
  assert.throws(() => knowledge.restoreTargetKnowledge({}, [{ ...records[0], i: -1 }]), /Invalid/)
  assert.throws(() => knowledge.restoreTargetKnowledge({}, [...records, ...records]), /Invalid/)
})
