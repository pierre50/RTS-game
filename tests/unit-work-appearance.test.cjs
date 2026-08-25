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
      hunter: 'hunter',
    },
    ACTION_TYPES: {
      hunt: 'hunt',
      takemeat: 'takemeat',
    },
  }

  return loadTsModule('app/lib/unitWorkAppearance.ts', {
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
      './equipmentStats': {
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
