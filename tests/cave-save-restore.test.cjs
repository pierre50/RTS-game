const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const cave = { id: 'cave-1', blueprintId: 'cave-large-loop', tier: 'large', seed: 3 }

test('saved entity restore places every cave occupant before resuming any unit orders', () => {
  let placed = false
  const processed = []
  const record = { label: 'villager', caveOrders: { dest: 'target' } }
  const { restoreSavedEntities } = loadTsModule('app/classes/map/generation/MapSavedStateGeneration.ts', {
    mocks: {
      '../../Resource': {}, '../../players': { Gaia: class {} }, '../../cell': {},
      '../../../lib': { getGaiaAnimals: () => [] },
      '../../../services/UnitPerception': { rehydrateAIKnowledge() {} },
      './MapOfflineWorldSimulation': {},
      '../MapSaveRestore': {
        restorePlayerEntitiesFromSave() {}, restorePlayerInteriors() {}, restorePlayerViews() {},
        restoreBuildingAssignments() {}, restoreAIState() {}, restoreSelection() {},
        restoreCaveOccupants() { placed = true },
        processUnit(unit, map, saved) {
          assert.equal(placed, true)
          assert.equal(saved, record)
          processed.push(unit.label)
        },
      },
    },
  })
  const context = { players: [{ units: [{ label: 'villager' }] }] }
  restoreSavedEntities({ context }, [{ units: [record] }], [], context)
  assert.deepEqual(processed, ['villager'])
})

test('restores cave occupants after the neutral owner and its saved interior have been restored', () => {
  const cell = { i: 31, j: 32, category: 'Land' }
  const space = { id: 'interior:gaia:cave', grid: [] }
  space.grid[31] = []
  space.grid[31][32] = cell
  const moves = []
  const { restoreCaveOccupants } = loadTsModule('app/classes/map/generation/CaveSaveRestore.ts', {
    mocks: {
      '../../../lib/mapSpaces': {
        moveEntityToMapSpace: (_map, unit, target, cell) => {
          moves.push(unit.label)
          unit.spaceId = target.id
          unit.i = cell.i
          unit.j = cell.j
        },
      },
      '../../../services/BuildingInteriorSpaceSystem': { ensureRuntimeBuildingInteriorSpace: () => space },
    },
  })
  const unit = { label: 'hero', i: 10, j: 10 }
  const context = {
    map: {},
    players: [
      { buildings: [], units: [unit], corpses: [] },
      { buildings: [{ cave }], units: [], corpses: [] },
    ],
  }
  restoreCaveOccupants(context, [{ units: [{ label: 'hero', cavePosition: { caveId: cave.id, i: 31, j: 32 } }] }, {}], () => space)
  assert.deepEqual(moves, ['hero'])
  assert.equal(unit.spaceId, space.id)
  assert.deepEqual([unit.i, unit.j], [31, 32])
})

test('invalid cave choices, duplicate identities and missing occupant destinations are rejected', () => {
  const { validateCaveDefinition, validateCaveOccupantReferences } = loadTsModule('app/serialization/CaveSave.ts')
  assert.doesNotThrow(() => validateCaveDefinition(cave))
  assert.throws(() => validateCaveDefinition({ ...cave, blueprintId: 'cave-medium-loop' }))
  assert.throws(() => validateCaveDefinition({ ...cave, seed: NaN }))
  assert.throws(() => validateCaveOccupantReferences([{ buildings: [{ cave }, { cave }] }]))
  assert.throws(() =>
    validateCaveOccupantReferences([{ units: [{ cavePosition: { caveId: 'missing', i: 2, j: 3 } }] }])
  )
})
