const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadMapSaveRestore() {
  return loadTsModule('app/classes/map/MapSaveRestore.ts', {
    mocks: {
      '../../constants': { FAMILY_TYPES: { building: 'building', unit: 'unit' }, PLAYER_TYPES: { ai: 'AI' } },
      '../../lib/playerState': { isAIControlledPlayer: () => false },
      '../../lib/resources/playerResourceTotals': {
        expandLegacyFoodAmount: resources => resources,
        syncPlayerResourceFieldsFromChests: () => {},
      },
    },
  })
}

const { restorePlayerEntitiesFromSave } = loadMapSaveRestore()

test('fog restoration skips sparse holes even when their saved vision is viewed', () => {
  const { restorePlayerViewsAndFog } = loadMapSaveRestore()
  const fog = []
  const viewed = []
  const map = { size: 2, grid: [[], [, { setFog: value => fog.push(value) }], []] }
  restorePlayerViewsAndFog(
    {
      isPlayed: true,
      views: {
        restoreViewers() {},
        isViewed: () => true,
        isVisible: () => false,
        onViewed: (i, j) => viewed.push([i, j]),
      },
    },
    map
  )
  assert.deepEqual(fog, [true])
  assert.deepEqual(viewed, [[1, 1]])
})

test('restoring player entities preserves saved unit types instead of applying new-game hero promotion', () => {
  const createUnitCalls = []
  const player = {
    createBuilding(options) {
      return options
    },
    createUnit(options, creationOptions) {
      createUnitCalls.push({ options, creationOptions })
      return { ...options }
    },
  }

  restorePlayerEntitiesFromSave(player, {
    buildings: [{ i: 1, j: 2, type: 'House' }],
    units: [{ i: 3, j: 4, type: 'Villager' }],
    corpses: [{ i: 5, j: 6, type: 'Fantassin', currentSheet: 'corpse' }],
  })

  assert.deepEqual(player.buildings, [{ i: 1, j: 2, type: 'House', skipBuiltEffects: true }])
  assert.equal(player.units[0].type, 'Villager')
  assert.equal(player.corpses[0].type, 'Fantassin')
  assert.equal(createUnitCalls[0].options.suppressCreateSound, true)
  assert.equal(createUnitCalls[1].options.suppressCreateSound, true)
  assert.deepEqual(
    createUnitCalls.map(call => call.creationOptions),
    [{ preserveType: true }, { preserveType: true }]
  )
})
