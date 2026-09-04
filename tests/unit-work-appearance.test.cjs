const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadUnitWorkAppearance(cacheGets) {
  const constants = {
    SHEET_TYPES: {
      action: 'actionSheet',
      corpse: 'corpseSheet',
      dying: 'dyingSheet',
      standing: 'standingSheet',
      walking: 'walkingSheet',
    },
    UNIT_TYPES: {
      bowman: 'Bowman',
    },
    WORK_TYPES: {
      attacker: 'attacker',
      builder: 'builder',
      goldminer: 'goldminer',
      hunter: 'hunter',
      stoneminer: 'stoneminer',
      woodcutter: 'woodcutter',
    },
    ACTION_TYPES: {
      attack: 'attack',
      build: 'build',
      chopwood: 'chopwood',
      hunt: 'hunt',
      minecopper: 'minecopper',
      minegold: 'minegold',
      mineiron: 'mineiron',
      minestone: 'minestone',
      takemeat: 'takemeat',
    },
  }

  return loadTsModule('app/lib/units/unitWorkAppearance.ts', {
    mocks: {
      'pixi.js': {
        Assets: {
          cache: {
            get: id => {
              cacheGets.push(id)
              return { id }
            },
          },
        },
      },
      '../constants': constants,
      './equipment/equipmentStats': {
        refreshUnitEquipmentStats: () => {},
      },
      '../equipment/equipmentStats': {
        refreshUnitEquipmentStats: () => {},
      },
      '../lpc/equipment': {
        dynamicEquipmentForWork: (work, age = 0) => {
          const metals = {
            axe: ['axe_ceramic', 'axe_copper', 'axe_bronze', 'axe_iron'],
            hammer: ['hammer_ceramic', 'hammer_copper', 'hammer_bronze', 'hammer_iron'],
            pickaxe: ['pickaxe_ceramic', 'pickaxe_copper', 'pickaxe_bronze', 'pickaxe_iron'],
          }
          if (work === 'woodcutter') return [metals.axe[age] ?? metals.axe[0]]
          if (work === 'builder') return [metals.hammer[age] ?? metals.hammer[0]]
          if (work === 'stoneminer' || work === 'goldminer') return [metals.pickaxe[age] ?? metals.pickaxe[0]]
          return []
        },
      },
    },
  })
}

test('hunter action sheet falls back to actionSheet when shootingSheet is absent', () => {
  const cacheGets = []
  const { getUnitWorkActionSheet } = loadUnitWorkAppearance(cacheGets)

  const sheet = getUnitWorkActionSheet(
    {
      type: 'Villager',
      allAssets: {
        hunter: {
          actionSheet: 'units/villager/hellas/male/action/shoot',
        },
      },
    },
    'hunter',
    'hunt'
  )

  assert.equal(sheet.id, 'units/villager/hellas/male/action/shoot')
  assert.deepEqual(cacheGets, ['units/villager/hellas/male/action/shoot'])
})

test('missing work action asset does not query Pixi cache with an empty id', () => {
  const cacheGets = []
  const { getUnitWorkActionSheet } = loadUnitWorkAppearance(cacheGets)

  const sheet = getUnitWorkActionSheet(
    {
      type: 'Villager',
      allAssets: {
        farmer: {},
      },
    },
    'farmer',
    'farm'
  )

  assert.equal(sheet, undefined)
  assert.deepEqual(cacheGets, [])
})

test('builder build action applies the custom frame sequence', () => {
  const cacheGets = []
  const { applyUnitActionFrameSequence, applyUnitWorkAssets } = loadUnitWorkAppearance(cacheGets)
  const unit = {
    type: 'Villager',
    allAssets: {
      builder: {
        standingSheet: 'standing',
        walkingSheet: 'walking',
        actionSheet: 'action',
        dyingSheet: 'dying',
        corpseSheet: 'corpse',
      },
      farmer: {
        standingSheet: 'standing',
        walkingSheet: 'walking',
        actionSheet: 'farmer-action',
        dyingSheet: 'dying',
        corpseSheet: 'corpse',
      },
    },
  }

  applyUnitWorkAssets(unit, 'builder', { action: 'build' })
  assert.deepEqual(unit.actionFrameSequence, [5, 5, 4, 4, 1, 0, 0, 0, 0])

  applyUnitActionFrameSequence(unit, 'farmer', 'farm')
  assert.equal(unit.actionFrameSequence, null)
})

test('woodcutting and mining actions apply the axe-style custom frame sequence', () => {
  const cacheGets = []
  const { applyUnitActionFrameSequence } = loadUnitWorkAppearance(cacheGets)
  const unit = { type: 'Villager' }
  const axeSequence = [5, 5, 4, 4, 3, 1, 0, 0, 0, 0]

  for (const [work, action] of [
    ['woodcutter', 'chopwood'],
    ['stoneminer', 'minestone'],
    ['goldminer', 'minegold'],
    ['goldminer', 'minecopper'],
    ['goldminer', 'mineiron'],
  ]) {
    applyUnitActionFrameSequence(unit, work, action)
    assert.deepEqual(unit.actionFrameSequence, axeSequence)
  }
})

test('attack action frame sequence follows equipped tool instead of work', () => {
  const cacheGets = []
  const { applyUnitActionFrameSequence } = loadUnitWorkAppearance(cacheGets)
  const axeSequence = [5, 5, 4, 4, 3, 1, 0, 0, 0, 0]
  const bareHand = { type: 'Villager' }
  const bandit = { type: 'BanditChief', equipment: ['axe_ceramic', 'armor_leather'] }

  applyUnitActionFrameSequence(bareHand, 'attacker', 'attack')
  assert.equal(bareHand.actionFrameSequence, null)

  applyUnitActionFrameSequence(bandit, 'attacker', 'attack')
  assert.deepEqual(bandit.actionFrameSequence, axeSequence)
})
