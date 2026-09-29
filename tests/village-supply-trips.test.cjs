const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { canMoveForVillageSupply, canSeekVillageResource, villageWorkNeedsLiveSearch } = loadTsModule(
  'app/lib/units/villageSupplyTrips.ts'
)
function fixture() {
  const unit = {
    type: 'Villager',
    owner: { type: 'AI' },
    i: 0,
    j: 0,
    autonomousJob: 'wood',
    villageHome: { id: 'home', i: 0, j: 0, spaceId: 'outside' },
  }
  const tree = { family: 'resource', type: 'Tree', i: 100, j: 0, quantity: 100 }
  return { unit, tree }
}
test('only resource orders and their remembered-cell approaches get the movement exception', () => {
  const { unit, tree } = fixture()
  assert.equal(canSeekVillageResource(unit, tree), true)
  assert.equal(canMoveForVillageSupply(unit, tree, 'chopwood'), true)
  assert.equal(canMoveForVillageSupply(unit, { i: 100, j: 0, has: tree }, null), true)
  for (const [target, action] of [
    [{ i: 100, j: 0, has: null }, null],
    [tree, 'attack'],
    [{ ...tree, quantity: 0 }, 'chopwood'],
    [{ ...tree, spaceId: 'cave' }, 'chopwood'],
    [{ ...tree, family: 'unit' }, 'chopwood'],
  ])
    assert.equal(canMoveForVillageSupply(unit, target, action), false)
  for (const patch of [
    { type: 'Soldier' },
    { isChief: true },
    { banditCampAnchor: {} },
    { campPatrolAnchor: {} },
    { followingHero: true },
  ])
    assert.equal(canMoveForVillageSupply({ ...unit, ...patch }, tree, 'chopwood'), false)
})
test('missing resources and obsolete exploration keep workers out of local simulation', () => {
  const { unit, tree } = fixture()
  assert.equal(villageWorkNeedsLiveSearch(unit), true)
  unit.dest = tree
  assert.equal(villageWorkNeedsLiveSearch(unit), false)
  unit.exploringForAutonomy = true
  assert.equal(villageWorkNeedsLiveSearch(unit), true)
})

test('a local destination with a route outside the snapshot stays live', () => {
  const { unit } = fixture()
  unit.dest = { i: 5, j: 0 }
  unit.path = [{ i: 40, j: 0 }]
  assert.equal(villageWorkNeedsLiveSearch(unit), true)
  unit.path = [{ i: 4, j: 0 }]
  assert.equal(villageWorkNeedsLiveSearch(unit), false)
})
