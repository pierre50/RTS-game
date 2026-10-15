const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { initializeNpcArrows, consumeNpcArrow, hasUnitArrow, replenishNpcArrows } = loadTsModule(
  'app/lib/units/combat/unitArrows.ts'
)

const count = unit => unit.inventory?.equipment?.filter(item => item.startsWith('arrow_')).length ?? 0
const npc = (type = 'Villager', isPlayed = false) => ({
  type,
  owner: { type: isPlayed ? 'Human' : 'AI', isPlayed },
  inventory: type === 'Villager' ? { equipment: ['bow'] } : {},
})

test('villagers carrying bows get ten starting arrows; archers twenty; heroes and swordsmen get none', () => {
  for (const [type, expected] of [
    ['Villager', 10],
    ['Bowman', 20],
    ['BanditArcher', 20],
    ['BanditSword', 0],
    ['Hero', 0],
  ]) {
    const unit = npc(type)
    initializeNpcArrows(unit)
    initializeNpcArrows(unit)
    assert.equal(count(unit), expected, type)
  }
})

test('shooting, theft, save/reload and promotion never regenerate the starting allowance', () => {
  const unit = npc('Villager', true)
  initializeNpcArrows(unit)
  assert.equal(consumeNpcArrow(unit), 'arrow_ceramic')
  const { moveInventoryEquipment, createInventoryContainer } = loadTsModule('app/lib/inventory/inventoryContainers.ts')
  const hero = { inventory: {} }
  assert.equal(
    moveInventoryEquipment(
      createInventoryContainer(unit, { id: 'npc' }),
      createInventoryContainer(hero, { id: 'hero' }),
      'arrow_ceramic'
    ),
    true
  )
  assert.equal(count(unit), 8)
  while (consumeNpcArrow(unit)) {
    /* empty the quiver */
  }
  assert.equal(hasUnitArrow(unit), false)
  const restored = JSON.parse(JSON.stringify(unit))
  restored.type = 'Bowman'
  initializeNpcArrows(restored)
  replenishNpcArrows(restored, 2)
  assert.equal(count(restored), 0)
  assert.equal(count(hero), 1)
})

test('daily AI supplies fill to the cap once per day and preserve better arrows', () => {
  const unit = npc('BanditArcher')
  initializeNpcArrows(unit)
  unit.inventory.equipment = ['arrow_iron', 'sword_ceramic']
  replenishNpcArrows(unit, 4)
  assert.equal(count(unit), 20)
  assert.ok(unit.inventory.equipment.includes('arrow_iron'))
  consumeNpcArrow(unit)
  replenishNpcArrows(unit, 4)
  replenishNpcArrows(unit, 3)
  assert.equal(count(unit), 19)
  replenishNpcArrows(unit, 5)
  assert.equal(count(unit), 20)
  unit.inventory.equipment.push(...Array(5).fill('arrow_iron'))
  replenishNpcArrows(unit, 6)
  assert.equal(count(unit), 25, 'never delete surplus arrows')
})

test('daily supplies wait for combat to finish and pending supplies survive a save', () => {
  const unit = npc('Bowman')
  initializeNpcArrows(unit)
  unit.inventory.equipment = []
  unit.action = 'attack'
  replenishNpcArrows(unit, 7)
  assert.equal(count(unit), 0)
  const restored = JSON.parse(JSON.stringify(unit))
  restored.action = null
  restored.combatMode = 'attack' // stale mode without a target is not an ongoing fight
  replenishNpcArrows(restored)
  assert.equal(count(restored), 20)
  assert.equal(restored.inventory.npcArrows.pendingDay, undefined)
  assert.equal(restored.inventory.npcArrows.lastRefillDay, 7)
})

test('daily never replenishes human factions, heroes or corpses', () => {
  for (const unit of [
    npc('Villager', true),
    npc('Bowman', true),
    npc('Hero'),
    { ...npc('BanditArcher'), isDead: true },
  ]) {
    unit.inventory = { equipment: [], npcArrows: { initialized: true } }
    replenishNpcArrows(unit, 9)
    assert.equal(count(unit), 0)
  }
})

test('ammo gates hunting and ranged combat but not corpse gathering or melee', () => {
  const { getActionCondition } = loadTsModule('app/lib/combat/combatActionConditions.ts')
  const unit = {
    ...npc(),
    family: 'unit',
    hitPoints: 20,
    equipment: ['sword_ceramic'],
    owner: {
      label: 'p',
      isEnemy: () => true,
      config: {
        units: { Villager: { equipment: ['sword_ceramic'] }, Bowman: { equipment: ['bow', 'arrow_ceramic'] } },
      },
    },
  }
  const animal = { family: 'animal', type: 'Deer', quantity: 10, hitPoints: 10, owner: { label: 'other' } }
  assert.equal(getActionCondition(unit, animal, 'hunt'), false)
  initializeNpcArrows(unit)
  assert.equal(getActionCondition(unit, animal, 'hunt'), true)
  unit.inventory.equipment = []
  assert.equal(getActionCondition(unit, animal, 'attack'), true, 'villager melee is unaffected')
  unit.type = 'Bowman'
  unit.equipment = ['bow', 'arrow_ceramic']
  assert.equal(getActionCondition(unit, animal, 'attack'), false)
  unit.inventory.equipment.push('arrow_ceramic')
  assert.equal(getActionCondition(unit, animal, 'attack'), true)
})

test('hunting consumes one real arrow at release and cannot spawn an extra projectile', () => {
  let release
  const projectiles = []
  const { handleUnitHuntAction } = loadTsModule('app/classes/unit/work/UnitHuntAction.ts', {
    mocks: {
      '../../../lib': {
        BOW_SHOOT_RELEASE_FRAME: 9,
        getHuntingAimPoint: () => ({ x: 1, y: 1 }),
        onSpriteLoopAtFrame: (_s, _frame, fn) => {
          release = fn
        },
      },
      '../../../lib/equipment/equipmentLoot': { consumeHeroEquippedItem() {} },
      '../../../lib/equipment/equipmentStats': { getUnitCombatRange: () => 4, getEntityWeaponPower: () => 7 },
      '../../../lib/equipment/equipmentWear': { wearEquippedWeapon() {} },
      '../../../lib/units/unitEnergy': { spendOrWaitForEnergy: () => true },
      '../../../lib/projectiles': { attachProjectileToMapSpace() {} },
      '../../Projectile': {
        Projectile: class {
          constructor(options) {
            projectiles.push(options)
          }
        },
      },
    },
  })
  const unit = {
    ...npc(),
    controlMode: 'standard',
    inventory: { equipment: ['arrow_copper'], npcArrows: { initialized: true } },
    sprite: {},
    visualAnimation: {
      onLoop() {},
      onFrameEachLoop(_frame, callback) { release = callback },
    },
    context: { map: {} },
    dest: { family: 'animal' },
    realDest: { x: 1, y: 1 },
    getActionCondition: () => true,
    stop() {
      this.stopped = true
    },
  }
  handleUnitHuntAction(unit)
  assert.equal(count(unit), 1, 'preparing a shot costs no arrow')
  release()
  assert.equal(count(unit), 0)
  assert.equal(projectiles[0].type, 'ArrowCopper')
  release()
  assert.equal(projectiles.length, 1)
  assert.equal(unit.stopped, true)
})

test('dead archers expose only remaining ammunition, once', () => {
  const { getUnitCorpseLootEquipment } = loadTsModule('app/lib/equipment/equipmentLoot.ts')
  const unit = {
    ...npc('BanditArcher'),
    owner: { config: { units: { BanditArcher: { equipment: ['bow', 'arrow_ceramic'] } } } },
    isDead: true,
    inventory: { equipment: ['arrow_copper', 'arrow_copper'], npcArrows: { initialized: true } },
  }
  const loot = getUnitCorpseLootEquipment(unit)
  assert.equal(loot.filter(item => item.startsWith('arrow_')).length, 2)
  assert.equal(count(unit), 0)
  loot.splice(loot.indexOf('arrow_copper'), 1)
  assert.equal(getUnitCorpseLootEquipment(unit).filter(item => item.startsWith('arrow_')).length, 1)
})

test('offline daily events replenish saved AI archers but leave player units empty', () => {
  const { applyOfflineDailyEvents } = loadTsModule('app/services/world/offline/OfflineWorldEvents.ts')
  const ai = npc('Bowman')
  const human = npc('Villager', true)
  for (const unit of [ai, human]) unit.inventory = { equipment: [], npcArrows: { initialized: true } }
  const state = {
    animals: [],
    resources: [],
    players: [
      { type: 'AI', units: [ai], buildings: [] },
      { type: 'Human', units: [human], buildings: [] },
    ],
  }
  applyOfflineDailyEvents(state, 2, {}, {}, {})
  assert.equal(count(ai), 20)
  assert.equal(count(human), 0)
  consumeNpcArrow(ai)
  applyOfflineDailyEvents(state, 2, {}, {}, {})
  assert.equal(count(ai), 19)
})

test('a bowless villager never receives free arrows, including after acquiring a bow and reloading', () => {
  const unit = npc('Villager', true)
  unit.inventory = { equipment: [] }
  initializeNpcArrows(unit)
  assert.equal(count(unit), 0)
  assert.equal(unit.inventory.npcArrows.initialized, true)
  unit.inventory.equipment.push('bow')
  const restored = JSON.parse(JSON.stringify(unit))
  initializeNpcArrows(restored)
  assert.equal(count(restored), 0)
})
