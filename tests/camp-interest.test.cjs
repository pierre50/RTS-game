const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
test('guards share one observation per camp while spaces and owners remain distinct', () => {
  let checks = 0
  const { CampInterest } = loadTsModule('app/services/patrol/CampInterest.ts', {
    mocks: {
      '../world/VillageObservation': {
        observeVillage() {
          checks++
          return { reason: 'distant' }
        },
      },
    },
  })
  const owner = { label: 'bandits' }
  const context = {
    players: [owner],
    map: { spaces: new Map([['cave', { portals: [{ targetSpaceId: 'outside', targetCell: { i: 10, j: 20 } }] }]]) },
  }
  const guards = Array.from({ length: 40 }, () => ({ owner, campPatrolAnchor: { i: 10, j: 20 } }))
  const interest = new CampInterest(context)
  assert.equal(interest.collect(guards).size, 0)
  assert.equal(checks, 1)
  guards[0].campBehavior = { homeSpaceId: 'cave' }
  guards[0].spaceId = 'cave'
  guards[1].owner = { label: 'other' }
  checks = 0
  interest.collect(guards)
  assert.equal(checks, 3)
  guards[1].isDead = true
  checks = 0
  interest.collect(guards)
  assert.equal(checks, 2)
})
