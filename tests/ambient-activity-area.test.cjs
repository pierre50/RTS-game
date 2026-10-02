const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { ambientActivityArea } = loadTsModule('app/services/world/AmbientActivityArea.ts')
const { observeVillage } = loadTsModule('app/services/world/VillageObservation.ts')
function context() {
  return {
    map: {
      grid: [
        [
          { x: 0, y: 0 },
          { x: 356, y: 0 },
          { x: 357, y: 0 },
        ],
      ],
    },
    players: [],
    controls: { getViewportMetrics: () => ({ visibleLeft: 0, visibleTop: 0, visibleWidth: 100, visibleHeight: 100 }) },
  }
}
test('ambient area includes the camera margin and rejects positions beyond it', () => {
  const c = context(),
    nearby = ambientActivityArea(c)
  assert.equal(nearby({ i: 0, j: 0 }), true)
  assert.equal(nearby({ i: 0, j: 1 }), true)
  assert.equal(nearby({ i: 0, j: 2 }), false)
  c.map.activeSpaceId = 'interior:house'
  assert.equal(ambientActivityArea(c)({ i: 0, j: 0 }), false)
})
test('visitors inside a nearby building stay in the local rotation through its exterior doorway', () => {
  const c = context()
  c.map.spaces = new Map([['house', { portals: [{ targetSpaceId: 'outside', targetCell: { i: 0, j: 0 } }] }]])
  assert.equal(ambientActivityArea(c)({ i: 30, j: 30, spaceId: 'house' }), true)
})
test('static village observation follows camera plus margin instead of the old large hero radius', () => {
  const c = context(),
    home = { i: 0, j: 2, id: 'village' }
  c.controls.heroUnit = { ...home, type: 'Hero' }
  assert.equal(observeVillage(c, home, 80, [], true).reason, 'distant')
  assert.equal(observeVillage(c, home, 80, [{ i: 0, j: 1 }], true).reason, 'camera')
  c.players.push({ units: [{ ...home, action: 'attack' }] })
  assert.equal(observeVillage(c, home, 80, [], true).reason, 'combat')
})

test('an active village stays awake in the outer margin, but a sleeping village cannot activate there', () => {
  const c = context(),
    home = { i: 0, j: 2, id: 'village' }
  assert.equal(observeVillage(c, home, 80, [], true, 256).reason, 'distant')
  assert.equal(observeVillage(c, home, 110, [], true, 384).reason, 'camera')
  c.map.grid[0][2].x = 485
  assert.equal(observeVillage(c, home, 110, [], true, 384).reason, 'distant')
})


test('a village chief becomes active near the hero beyond the camera margin', () => {
  const c = context()
  const home = { i: 0, j: 2, id: 'village' }
  c.controls.heroUnit = { ...home, type: 'Hero' }
  const chief = { ...home, type: 'Chief', hitPoints: 20 }
  assert.equal(observeVillage(c, home, 80, [chief], true).reason, 'hero')
})
