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
      builder: 'builder',
      goldminer: 'goldminer',
      hunter: 'hunter',
      stoneminer: 'stoneminer',
      woodcutter: 'woodcutter',
    },
    ACTION_TYPES: {
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
          actionSheet: 'lpc-baked/villager/greek/male/action/shoot',
        },
      },
    },
    'hunter',
    'hunt'
  )

  assert.equal(sheet.id, 'lpc-baked/villager/greek/male/action/shoot')
  assert.deepEqual(cacheGets, ['lpc-baked/villager/greek/male/action/shoot'])
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
