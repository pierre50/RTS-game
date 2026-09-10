const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

for (const entering of [true, false]) {
  test(`cave pursuers follow the hero ${entering ? 'inside' : 'outside'} and resume attacking after arrival`, () => {
    const heroOwner = { units: [], isEnemy: owner => owner === enemyOwner }
    const enemyOwner = { units: [] }
    const source = entering ? 'outside' : 'interior:cave'
    const target = entering ? 'interior:cave' : 'outside'
    const hero = { owner: heroOwner, spaceId: source }
    const attacker = {
      owner: enemyOwner,
      spaceId: source,
      action: 'attack',
      dest: hero,
      sendToEvt: (...args) => attacks.push(args),
    }
    const idle = { owner: enemyOwner, spaceId: source }
    const dead = { ...attacker, isDead: true }
    const elsewhere = { ...attacker, spaceId: 'other' }
    enemyOwner.units = [attacker, idle, dead, elsewhere]
    heroOwner.units = [hero]
    const routes = [],
      attacks = []
    const space = { building: { type: 'Cave' }, entryPortal: { id: 'entry' }, exitPortal: { id: 'exit' } }
    const { moveHeroPartyIntoBuildingInteriorSpace, moveHeroPartyOutOfBuildingInteriorSpace } = loadTsModule(
      'engine/services/BuildingInteriorSpaceRoutes.ts',
      {
        mocks: {
          '../../app/constants': { ACTION_TYPES: { attack: 'attack' } },
          '../../app/lib/buildings/interiorAccess': { canUnitEnterBuildingInterior: () => true },
          '../../app/lib/mapSpaces': { sameMapSpace: (a, b) => a.spaceId === b.spaceId },
          '../../app/services/SpacePortalSystem': {
            transferUnitThroughSpacePortal: () => {
              hero.spaceId = target
              return true
            },
            routeUnitThroughSpacePortal: (_context, unit, portal, options) => {
              routes.push({ unit, portal, options })
              return true
            },
          },
          './BuildingInteriorSpaceVisibility': { deactivateBuildingInteriorSpace: () => {} },
          './BuildingInteriorSpaceLayout': {},
          './BuildingInteriorSpaceLookup': {},
        },
      }
    )
    const move = entering ? moveHeroPartyIntoBuildingInteriorSpace : moveHeroPartyOutOfBuildingInteriorSpace
    assert.equal(move({ players: [heroOwner, enemyOwner] }, hero, space), true)
    assert.equal(routes.length, 1)
    assert.equal(routes[0].unit, attacker)
    assert.equal(routes[0].portal.id, entering ? 'entry' : 'exit')
    attacker.spaceId = target
    routes[0].options.onTransferred()
    assert.equal(attacks[0][0], hero)
    assert.equal(attacks[0][1], 'attack')
  })
}
