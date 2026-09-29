const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function createVillager(options = {}) {
  const { createPlayerUnit } = loadTsModule('app/classes/players/PlayerUnitCreation.ts', {
    mocks: {
      '../../lib': { uuidv4: () => 'new-unit', canUpdateMinimap: () => false, updateInstanceVisibility() {} },
      '../../lib/mapSpaces': { addEntityToMapSpaceContainer() {} },
      '../../lib/entities/entityFade': { fadeIn() {} },
      '../../lib/units/unitIdentity': { resolveUnitIdentity: () => ({ civ: 'Hellas', gender: 'male' }) },
      '../../config/name': { getRandomUnitName: () => 'Villager' },
      '../unit/Unit': {
        Unit: class {
          constructor(options) {
            Object.assign(this, options)
          }
        },
      },
    },
  })
  return createPlayerUnit.call(
    {
      context: { map: {} },
      units: [],
      updatePopulationObjectives() {},
    },
    { type: 'Villager', i: 0, j: 0, ...options }
  )
}

test('ordinary villager creation supplies three days of food in independent bags', () => {
  const first = createVillager()
  const second = createVillager()
  assert.deepEqual(first.inventory.resources, { meat: 6, berry: 6 })
  first.inventory.resources.meat = 0
  assert.equal(second.inventory.resources.meat, 6)
})

test('explicit inventories are preserved instead of refilled and other unit types get no provisions', () => {
  const inventory = { resources: { wheat: 0, wood: 4 } }
  assert.deepEqual(createVillager({ inventory }).inventory, inventory)
  assert.equal(createVillager({ type: 'Infantry' }).inventory, undefined)
})
