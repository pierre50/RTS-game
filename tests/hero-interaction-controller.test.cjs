const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadHeroInteractionController(calls) {
  return loadTsModule('app/controllers/HeroInteractionController.ts', {
    mocks: {
      '../constants': {
        FAMILY_TYPES: { building: 'building', resource: 'resource', unit: 'unit' },
        SHEET_TYPES: { corpse: 'corpseSheet' },
      },
      '../lib/hero/heroActionRange': {
        isHeroInteractionTargetReachable: () => true,
      },
      '../lib/hero/heroProximityInteractions': {
        resolveHeroNpcProximityInteraction: (_hero, target) =>
          target.family === 'unit'
            ? {
                action: 'communicate',
                labelKey: 'heroInteractionCommunicate',
                target,
              }
            : null,
        wakeOwnSleepingNpcForCommunication: (_hero, target) => calls.push(['wakeNpc', target]),
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
    openEntityInfoModal: openedTarget => {
      calls.push(['openEntityInfoModal', openedTarget])
      return true
    },
    openNpcOrders: npcs => calls.push(['openNpcOrders', npcs]),
  }
  const hero = { family: 'unit', label: 'hero' }
  const controller = new HeroInteractionController({
    context: { menu, player: {} },
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

test('wildgrass direct interaction opens info instead of starting forage work', () => {
  const target = { family: 'resource', label: 'herb-1', quantity: 2, type: 'MedicinalHerb' }
  const { calls, controller } = createController(target)

  assert.equal(controller.openHeroEntityInteraction(target), true)
  assert.deepEqual(calls, [['openEntityInfoModal', target]])
})
