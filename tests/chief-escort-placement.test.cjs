const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { settleChiefEscortAtPost } = loadTsModule('app/services/rest/ChiefEscortPlacement.ts', {
  mocks: {
    '../../lib/buildings/passageCells': { createReservedPassageCellLookup: () => ({ has: cell => cell?.passage }) },
    '../../lib/mapSpaces': {
      sameMapSpace: (a, b) => (a.spaceId ?? 'outside') === (b.spaceId ?? 'outside'),
      getEntitySpaceGrid: (_unit, map) => map.grid,
    },
    '../../../engine/services/BuildingInteriorSpaceLookup': {
      getBuildingInteriorSpaceForUnit: unit => unit.interior ?? null,
    },
    '../../lib/units/interiorCombat': { hasInteriorCombatRoute: unit => !!unit.interiorCombat },
    './UnitRestRules': { isUnitRestWakeLocked: unit => !!unit.wakeLocked },
    './UnitRestState': {
      stopUnitForRest: unit => {
        unit.path = []
      },
      placeUnitAtCell: (unit, cell) => {
        if (unit.currentCell?.has === unit) {
          unit.currentCell.has = null
          unit.currentCell.solid = false
        }
        Object.assign(unit, { i: cell.i, j: cell.j, currentCell: cell })
        cell.has = unit
        cell.solid = true
      },
    },
  },
})
function fixture() {
  const owner = { type: 'AI', units: [], isEnemy: other => other?.enemy === true }
  const chief = { type: 'Chief', label: 'chief', owner, i: 5, j: 5, z: 0 }
  const guard = { type: 'Fantassin', label: 'guard', owner, i: 0, j: 0, dest: { i: 4, j: 4 }, path: [{}] }
  const reserve = { type: 'Fantassin', label: 'reserve', owner, i: 0, j: 2 }
  const second = { ...guard, label: 'second', j: 1 }
  owner.units = [chief, guard, second, reserve]
  const grid = Array.from({ length: 12 }, (_, i) =>
    Array.from({ length: 12 }, (_, j) => ({ i, j, z: 0, category: 'Land' }))
  )
  grid[5][5].solid = true
  grid[5][5].has = chief
  return { chief, guard, second, reserve, context: { map: { grid } }, grid }
}
test('escort activation uses separate safe posts without moving reserve troops', () => {
  const f = fixture()
  f.grid[4][5].passage = true
  f.grid[5][4].category = 'Water'
  f.grid[5][6].z = 1
  for (const unit of [f.guard, f.second]) {
    assert.equal(settleChiefEscortAtPost(unit, f.context), true)
    assert.ok(Math.hypot(unit.i - 5, unit.j - 5) <= 2)
    assert.equal(unit.currentCell.passage, undefined)
    assert.equal(unit.currentCell.category, 'Land')
    assert.equal(unit.currentCell.z, 0)
    assert.equal(unit.dest, null)
    assert.deepEqual(unit.path, [])
  }
  assert.notEqual(f.guard.currentCell, f.second.currentCell)
  assert.equal(settleChiefEscortAtPost(f.reserve, f.context), false)
  assert.deepEqual([f.reserve.i, f.reserve.j], [0, 2])
})
test('combat, orders, alerts and interior transfers never teleport guards', () => {
  for (const change of [
    { action: 'attack' },
    { combatMode: 'flee' },
    { pendingOrder: {} },
    { spacePortalState: {} },
    { lookingAtHero: true },
    { wakeLocked: true },
    { work: 'attacker', dest: { owner: { enemy: true } } },
    { factionExpedition: {} },
    { interiorCombat: true },
    { spaceId: 'interior:forum' },
  ]) {
    const f = fixture()
    Object.assign(f.guard, change)
    assert.equal(settleChiefEscortAtPost(f.guard, f.context), false, JSON.stringify(change))
    assert.deepEqual([f.guard.i, f.guard.j], [0, 0])
    assert.equal(f.guard.path.length, 1)
  }
  const f = fixture()
  f.chief.action = 'attack'
  assert.equal(settleChiefEscortAtPost(f.guard, f.context), false)
})
test('blocked posts preserve orders rather than placing an escort on occupied terrain', () => {
  const f = fixture()
  for (const row of f.grid) for (const cell of row) cell.solid = true
  assert.equal(settleChiefEscortAtPost(f.guard, f.context), false)
  assert.deepEqual([f.guard.i, f.guard.j], [0, 0])
  assert.equal(f.guard.path.length, 1)
})
