const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function scenario({ capacity = 5, hostile = true } = {}) {
  const routes = []
  let visible = false
  const owner = { label: 'ai', isEnemy: () => hostile, units: [] }
  const context = { scheduler: { elapsedMs: 0 }, players: [owner] }
  const actor = { label: 'hero', family: 'unit', spaceId: 'inside', context, owner: { label: 'hero-owner' } }
  context.players.push({ units: [actor] })
  const space = {
    id: 'inside',
    building: { i: 10, j: 10, type: 'House', owner, shelterCapacity: capacity },
    walkableCells: Array(20),
    entryPortal: { sourceSpaceId: 'outside' },
    exitPortal: { targetSpaceId: 'outside' },
  }
  const api = loadTsModule('app/ai/AITheftDefense.ts', {
    mocks: {
      '../lib/units/playerTargetKnowledge': { playerSeesTarget: () => visible },
      '../../engine/services/BuildingInteriorSpaceLookup': { getBuildingInteriorSpaceForUnit: () => space },
      '../services/SpacePortalSystem': {
        clearUnitSpacePortalRoute: unit => {
          unit.spacePortalState = null
        },
        routeUnitThroughSpacePortal: (ctx, unit, portal, options) => {
          routes.push({ unit, portal, options })
          unit.spacePortalState = options
          return true
        },
      },
    },
  })
  const add = (label, extra = {}) => {
    const unit = {
      label,
      type: 'Villager',
      spaceId: 'outside',
      owner,
      context,
      i: 10,
      j: 11,
      hitPoints: 100,
      totalHitPoints: 100,
      attacks: [],
      sendToAttack(target) {
        this.attacks.push(target)
        this.dest = target
        this.action = 'attack'
      },
      ...extra,
    }
    owner.units.push(unit)
    return unit
  }
  return {
    ...api,
    owner,
    actor,
    space,
    routes,
    context,
    add,
    see: () => {
      visible = true
    },
  }
}

test('interior theft alerts chief and three nearby healthy villagers, without interior vision', () => {
  const s = scenario()
  for (let i = 0; i < 6; i++) s.add(`villager-${i}`)
  const chief = s.add('chief', { isChief: true })
  s.add('remote', { i: 90 })
  s.add('wounded', { hitPoints: 20 })
  s.reportInteriorTheft(s.owner, s.actor)
  assert.equal(s.routes.length, 4)
  assert.equal(s.routes[0].unit, chief)
  s.reportInteriorTheft(s.owner, s.actor)
  s.handleInteriorTheftDefense(s.owner)
  assert.equal(s.routes.length, 4)
  s.see()
  chief.spaceId = 'inside'
  s.routes[0].options.onTransferred()
  assert.deepEqual(chief.attacks, [s.actor])
})

test('capacity includes the thief and is checked again at arrival', () => {
  const s = scenario({ capacity: 2 })
  s.add('chief', { isChief: true })
  s.add('worker')
  s.reportInteriorTheft(s.owner, s.actor)
  assert.equal(s.routes[0].options.canTransfer(), true)
  s.routes[0].unit.spaceId = 'inside'
  assert.equal(s.routes[1].options.canTransfer(), false)
  const full = scenario({ capacity: 1 })
  full.add('chief', { isChief: true })
  full.reportInteriorTheft(full.owner, full.actor)
  assert.equal(full.routes.length, 0)
})

test('escape cancels incoming route and defenders inside follow through the exit', () => {
  const s = scenario()
  const chief = s.add('chief', { isChief: true })
  s.reportInteriorTheft(s.owner, s.actor)
  s.actor.spaceId = 'outside'
  assert.equal(s.routes[0].options.shouldContinue(), false)
  chief.spacePortalState = null
  chief.spaceId = 'inside'
  s.handleInteriorTheftDefense(s.owner)
  assert.equal(s.routes[1].portal, s.space.exitPortal)
})

test('neutral theft does not attack and expired alerts release workers', () => {
  const neutral = scenario({ hostile: false })
  neutral.add('worker')
  neutral.reportInteriorTheft(neutral.owner, neutral.actor)
  assert.equal(neutral.routes.length, 0)
  const s = scenario()
  const worker = s.add('worker')
  s.reportInteriorTheft(s.owner, s.actor)
  assert.equal(s.isInteriorTheftDefender(worker), true)
  s.context.scheduler.elapsedMs = 30001
  assert.equal(s.handleInteriorTheftDefense(s.owner), false)
  assert.equal(s.isInteriorTheftDefender(worker), false)
  assert.equal(s.routes[0].options.shouldContinue(), false)
})
