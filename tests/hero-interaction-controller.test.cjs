const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadHeroInteractionController(calls) {
  return loadTsModule('app/controllers/HeroInteractionController.ts', {
    mocks: {
      '../constants': {
        CAMP_DECORATION_BUILDING_TYPES: loadTsModule('app/constants/entities.ts').CAMP_DECORATION_BUILDING_TYPES,
        BUILDING_TYPES: { trap: 'Trap' },
        FAMILY_TYPES: { animal: 'animal', building: 'building', resource: 'resource', unit: 'unit' },
        SHEET_TYPES: { corpse: 'corpseSheet' },
      },
      '../lib/hero/heroActionRange': {
        isHeroInteractionTargetReachable: () => true,
      },
      '../lib/hero/heroProximityInteractions': {
        resolveHeroNpcProximityInteraction: (_hero, target) =>
          target.family === 'unit' && !target.hostile && target.action !== 'attack'
            ? {
                action: 'communicate',
                labelKey: 'heroInteractionCommunicate',
                target,
              }
            : null,
        wakeOwnSleepingNpcForCommunication: (_hero, target) => calls.push(['wakeNpc', target]),
      },
      '../lib/entities/entityOwnerTransfer': {
        transferNeutralEntityToPlayer: (target, owner) => {
          if (target?.owner?.type !== 'Gaia' || target.owner?.diplomacy !== 'neutral') return false
          calls.push(['claimNeutral', target.label, owner.label])
          target.owner = owner
          return true
        },
      },
      '../lib/hero/heroTools': {
        findFacingEntity: () => null,
      },
    },
  }).HeroInteractionController
}

function createController(target, calls = []) {
  const HeroInteractionController = loadHeroInteractionController(calls)
  const menu = {
    isEntityInfoModalOpen: () => false,
    isHeroBuildingMenuOpen: () => false,
    isNpcOrdersOpen: () => false,
    openHeroBuildingMenu: building => {
      calls.push(['openHeroBuildingMenu', building])
      return true
    },
    openEntityInfoModal: openedTarget => {
      calls.push(['openEntityInfoModal', openedTarget])
      return true
    },
    openNpcOrders: npcs => calls.push(['openNpcOrders', npcs]),
  }
  const player = { label: 'player' }
  const hero = { family: 'unit', label: 'hero', owner: player }
  const controller = new HeroInteractionController({
    context: { menu, player },
    heroUnit: hero,
    isHeroControlActive: () => true,
  })

  return { calls, controller, target }
}

test('dead unit direct interaction opens entity info instead of npc communication', () => {
  const target = { currentSheet: 'corpseSheet', family: 'unit', isDead: true, label: 'bandit-corpse' }
  const { calls, controller } = createController(target)

  assert.equal(controller.openHeroEntityInteraction(target), true)
  assert.deepEqual(calls, [['openEntityInfoModal', target]])
})

test('living npc direct interaction still opens communication', () => {
  const target = { currentSheet: 'standingSheet', family: 'unit', isDead: false, label: 'villager' }
  const { calls, controller } = createController(target)

  assert.equal(controller.openHeroEntityInteraction(target), true)
  assert.deepEqual(calls, [['wakeNpc', target], ['openNpcOrders', [target]]])
})

test('neutral chest direct interaction claims it before opening', () => {
  const neutral = { diplomacy: 'neutral', label: 'neutral', type: 'Gaia' }
  const target = { family: 'building', isBuilt: true, isDead: false, isDestroyed: false, label: 'chest', owner: neutral }
  const { calls, controller } = createController(target)

  assert.equal(controller.openHeroEntityInteraction(target), true)
  assert.equal(target.owner.label, 'player')
  assert.deepEqual(calls, [
    ['claimNeutral', 'chest', 'player'],
    ['openHeroBuildingMenu', target],
  ])
})

test('wildgrass direct interaction opens info instead of starting forage work', () => {
  const target = { family: 'resource', label: 'herb-1', quantity: 2, type: 'MedicinalHerb' }
  const { calls, controller } = createController(target)

  assert.equal(controller.openHeroEntityInteraction(target), true)
  assert.deepEqual(calls, [['openEntityInfoModal', target]])
})

for (const target of [
  { family: 'unit', hostile: true, label: 'enemy' },
  { family: 'unit', action: 'attack', label: 'fighting-ally' },
  { family: 'animal', label: 'idle-deer' },
  { family: 'animal', action: 'flee', label: 'fleeing-deer' },
]) {
  test(`direct interaction does not inspect ${target.label}`, () => {
    const { calls, controller } = createController(target)

    assert.equal(controller.openHeroEntityInteraction(target), false)
    assert.deepEqual(calls, [])
  })
}

test('dead animal remains inspectable', () => {
  const target = { family: 'animal', isDead: true, label: 'dead-deer' }
  const { calls, controller } = createController(target)

  assert.equal(controller.openHeroEntityInteraction(target), true)
  assert.deepEqual(calls, [['openEntityInfoModal', target]])
})

test('direct inspection never opens or claims a trap', () => {
  for (const isBuilt of [false, true]) {
    const owner = { diplomacy: 'neutral', label: 'neutral', type: 'Gaia' }
    const target = { family: 'building', type: 'Trap', label: 'trap', owner, isBuilt }
    const { calls, controller } = createController(target)
    assert.equal(controller.openHeroEntityInteraction(target), false)
    assert.deepEqual(calls, [])
    assert.equal(target.owner, owner)
  }
})
