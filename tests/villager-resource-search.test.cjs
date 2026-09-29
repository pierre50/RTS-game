const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture(compact) {
  const moduleCache = new Map()
  const checked = []
  const mocks = {
    '../grid/movement': {
      getInstanceClosestFreeCellPath(_unit, target) {
        checked.push(target.i)
        return target.i >= 37 ? [{ i: target.i - 1, j: 0 }] : []
      },
    },
  }
  const autonomy = loadTsModule('app/lib/units/villagerAutonomy.ts', { moduleCache, mocks })
  const { CompactResourceSet } = loadTsModule('app/classes/resources/CompactResourceSet.ts', { moduleCache, mocks })
  let resources
  if (compact) {
    resources = new CompactResourceSet(
      50,
      100,
      'search',
      () => ({ totalQuantity: 100, totalHitPoints: 30 }),
      state => ({ ...state, family: 'resource' }),
      {}
    )
    for (let i = 1; i <= 40; i++) resources.addState({ i, j: 0, type: 'Tree', textureName: 'tree_0' })
  } else {
    resources = Array.from({ length: 40 }, (_, n) => ({
      i: n + 1,
      j: 0,
      label: `tree-${n}`,
      family: 'resource',
      type: 'Tree',
      quantity: 100,
      hitPoints: 30,
    }))
  }
  const owner = { isPlayed: true, units: [], buildings: [] }
  const unit = {
    type: 'Villager',
    owner,
    i: 0,
    j: 0,
    context: { map: { resources, grid: [] }, dayNight: { state: { hour: 10 } } },
    getActionCondition: () => true,
    sendToTree(target) {
      this.dest = target
      this.action = 'chopwood'
      return true
    },
  }
  owner.units.push(unit)
  return { ...autonomy, unit, checked }
}

for (const compact of [false, true]) {
  test(`failed resource searches advance to later reachable deposits with 18 path checks per attempt (compact=${compact})`, () => {
    const f = fixture(compact)
    assert.equal(f.assignVillagerAutonomy(f.unit, 'wood'), false)
    assert.deepEqual(
      f.checked,
      Array.from({ length: 18 }, (_, n) => n + 1)
    )
    f.checked.length = 0
    assert.equal(f.resumeVillagerAutonomy(f.unit), false)
    assert.deepEqual(
      f.checked,
      Array.from({ length: 18 }, (_, n) => n + 19)
    )
    f.checked.length = 0
    assert.equal(f.resumeVillagerAutonomy(f.unit), true)
    assert.equal(f.unit.dest.i, 37)
    assert.ok(f.checked.length <= 18)
  })
}

test('an explicit new assignment or a change of map resets the search to nearby deposits', () => {
  for (const reset of ['order', 'space']) {
    const f = fixture(true)
    f.assignVillagerAutonomy(f.unit, 'wood')
    f.checked.length = 0
    if (reset === 'order') f.assignVillagerAutonomy(f.unit, 'wood')
    else {
      f.unit.spaceId = 'outside'
      f.resumeVillagerAutonomy(f.unit)
    }
    assert.equal(f.checked[0], 1, reset)
  }
})

test('settled AI workers search beyond the village without falling back to random exploration', () => {
  const f = fixture(true)
  Object.assign(f.unit.owner, { isPlayed: false, type: 'AI' })
  f.unit.villageHome = { id: 'village', i: 0, j: 0, spaceId: 'outside' }
  f.unit.explore = () => assert.fail('settled workers need a specific supply destination')
  assert.equal(f.assignVillagerAutonomy(f.unit, 'wood'), false)
  assert.equal(f.resumeVillagerAutonomy(f.unit), false)
  assert.equal(f.resumeVillagerAutonomy(f.unit), true)
  assert.equal(f.unit.dest.i, 37)
  assert.equal(f.unit.villageHome.i, 0)
})
