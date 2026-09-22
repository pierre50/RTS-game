const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function scenario({ buildingOwner = 'pursuer', hp = 100, capacity = 5 } = {}) {
  const routes = []
  const attackerOwner = {
    label: 'pursuer',
    isEnemy: other => other?.label === 'hero' || other?.label === 'third-enemy',
  }
  const heroOwner = { label: 'hero', isEnemy: other => other?.label === 'pursuer' }
  const thirdOwner = { label: buildingOwner, isEnemy: () => false }
  const hero = { label: 'hero-unit', owner: heroOwner, spaceId: 'outside' }
  const pursuer = {
    label: 'guard',
    owner: attackerOwner,
    spaceId: 'outside',
    dest: hero,
    action: 'attack',
    sendToEvt: (target, action) => {
      pursuer.dest = target
      pursuer.action = action
    },
  }
  const context = { players: [{ units: [hero] }, { units: [pursuer] }] }
  const space = {
    id: 'inside',
    building: {
      type: 'House',
      owner: buildingOwner === 'pursuer' ? attackerOwner : thirdOwner,
      hitPoints: hp,
      totalHitPoints: 100,
      shelterCapacity: capacity,
    },
    walkableCells: Array(20),
    entryPortal: { sourceSpaceId: 'outside', targetSpaceId: 'inside' },
    exitPortal: { sourceSpaceId: 'inside', targetSpaceId: 'outside' },
  }
  const api = loadTsModule('engine/services/BuildingInteriorSpaceRoutes.ts', {
    mocks: {
      '../../app/services/SpacePortalSystem': {
        transferUnitThroughSpacePortal: (_ctx, unit, portal) => {
          unit.spaceId = portal.targetSpaceId
          return true
        },
        routeUnitThroughSpacePortal: (_ctx, unit, portal, options) => {
          routes.push({ unit, portal, options })
          unit.spacePortalState = options
          return true
        },
      },
      './BuildingInteriorSpaceVisibility': { deactivateBuildingInteriorSpace: () => {} },
      './BuildingInteriorSpaceLayout': { findFreeCellNear: () => null },
      '../../app/services/buildingInterior/InteriorIdleFacing': { applyBuildingInteriorIdleFacing: () => {} },
    },
  })
  return { ...api, hero, pursuer, space, context, routes }
}

test('an attacker follows into its own house without any theft and resumes combat', () => {
  const s = scenario()
  assert.equal(s.moveHeroPartyIntoBuildingInteriorSpace(s.context, s.hero, s.space), true)
  assert.equal(s.routes.length, 1)
  const route = s.routes[0]
  assert.equal(route.portal, s.space.entryPortal)
  assert.equal(route.options.combatTarget, s.hero)
  assert.equal(route.options.shouldContinue(), true)
  s.pursuer.spaceId = 'inside'
  s.pursuer.action = null
  route.options.onTransferred()
  assert.equal(s.pursuer.dest, s.hero)
  assert.equal(s.pursuer.action, 'attack')
})

test('third-party entry uses the pursuer relationship and the building defenses', () => {
  for (const [buildingOwner, hp, expected] of [
    ['third-enemy', 100, 0],
    ['third-enemy', 20, 1],
    ['third-neutral', 100, 1],
    ['hero', 100, 0],
  ]) {
    const s = scenario({ buildingOwner, hp })
    s.moveHeroPartyIntoBuildingInteriorSpace(s.context, s.hero, s.space)
    assert.equal(s.routes.length, expected, `${buildingOwner} at ${hp} HP`)
    assert.equal(s.space.building.owner.label, buildingOwner)
  }
})

test('entry capacity includes the hero, and ownership is rechecked before arrival', () => {
  const s = scenario({ capacity: 1 })
  s.moveHeroPartyIntoBuildingInteriorSpace(s.context, s.hero, s.space)
  assert.equal(s.routes[0].options.canTransfer(), false)
  s.space.building.shelterCapacity = 2
  assert.equal(s.routes[0].options.canTransfer(), true)
  s.space.building.owner = s.hero.owner
  assert.equal(s.routes[0].options.shouldContinue(), false)
})

test('fleeing cancels incoming pursuit and leaving is allowed after ownership changes', () => {
  const s = scenario()
  s.moveHeroPartyIntoBuildingInteriorSpace(s.context, s.hero, s.space)
  s.pursuer.spaceId = 'inside'
  s.pursuer.action = null // Still handling a portal order.
  s.space.building.owner = s.hero.owner
  s.moveHeroPartyOutOfBuildingInteriorSpace(s.context, s.hero, s.space)
  assert.equal(s.routes[0].options.shouldContinue(), false)
  assert.equal(s.routes[1].portal, s.space.exitPortal)
  assert.equal(s.routes[1].options.shouldContinue(), true)
})

test('death or peace cancels a pending pursuit', () => {
  const s = scenario()
  s.moveHeroPartyIntoBuildingInteriorSpace(s.context, s.hero, s.space)
  s.hero.isDead = true
  assert.equal(s.routes[0].options.shouldContinue(), false)
  s.hero.isDead = false
  s.hero.owner.isEnemy = () => false
  s.pursuer.owner.isEnemy = () => false
  assert.equal(s.routes[0].options.shouldContinue(), false)
})

test('leaving an interior recenters before discovering the outside terrain', () => {
  const s = scenario()
  s.hero.spaceId = 'inside'
  let cameraSpace = 'inside'
  const explored = []
  s.context.controls = {
    focusHeroCamera() { cameraSpace = s.hero.spaceId },
    updateVisibleCells() { explored.push(cameraSpace) },
  }
  assert.equal(s.moveHeroPartyOutOfBuildingInteriorSpace(s.context, s.hero, s.space), true)
  assert.deepEqual(explored, ['outside'])
})

test('entering a third-party building does not mobilize its bystanders or control another hero', () => {
  const s = scenario({ buildingOwner: 'third-neutral' })
  const bystander = { label: 'bystander', owner: s.space.building.owner, spaceId: 'outside' }
  const controlled = { ...s.pursuer, label: 'other-hero', controlMode: 'hero' }
  s.context.players.push({ units: [bystander, controlled] })
  s.moveHeroPartyIntoBuildingInteriorSpace(s.context, s.hero, s.space)
  assert.deepEqual(s.routes.map(route => route.unit.label), ['guard'])
})
