const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const maths = loadTsModule('app/lib/maths.ts')
const noop = () => {}

function fixture() {
  const grid = Array.from({ length: 8 }, (_, i) =>
    Array.from({ length: 8 }, (_, j) => ({
      i,
      j,
      z: i < 4 ? 1 : 0,
      y: (i + j - (i < 4 ? 1 : 0)) * 16,
      _terrainAppearance: { relief: i === 4 ? { index: 14, elevation: 8 } : null },
    }))
  )
  const map = { grid, size: 7, updateInstanceBucket: noop }
  const mocks = {
    '../../../lib': {
      ...maths,
      canUpdateMinimap: () => false,
      playMovementSurfaceAudio: noop,
      updateInstanceVisibility: noop,
      updateInstanceRenderVisibility: noop,
      moveTowardPoint: (unit, x, y, speed) => {
        const distance = Math.hypot(x - unit.x, y - unit.y)
        unit.x += ((x - unit.x) / distance) * speed
        unit.y += ((y - unit.y) / distance) * speed
      },
    },
    '../../../lib/units/targetPursuit': { updateTargetPursuit: () => false },
    '../../../lib/units/unitControl': { isHeroControlled: () => false },
    '../../../lib/units/unitEnergy': { getEnergyMoveSpeedMultiplier: unit => unit.energySpeedFactor ?? 1 },
    './UnitHeroDirectMovementCollision': { getHeroTerrainCollisionBlockerNearPoint: () => null },
    './UnitDirectMovementDiagnostics': { reportBorderAttempt: noop, reportTerrainCollision: noop },
    '../../../lib/units/unitWalkingAnimation': { applyUnitWalkingAnimationSpeed: noop },
    '../../../lib/units/unitCrouchPose': { applyUnitCrouchPose: noop, resetUnitCrouchPose: noop },
    '../../../lib/mapSpaces': { getEntitySpaceMapLike: () => map, isOutsideSpaceId: () => true },
    '../../../lib/buildings/passageCells': {
      unitHasActivePassageStopIntent: () => false,
      routeUnitAwayFromPassageCell: () => false,
    },
    './UnitContactApproach': {},
    './UnitMovementDebug': { debugCombatMove: noop },
    './UnitMovementHelpers': {
      getRequestedMoveSpeedFactor: () => 1,
      getPathMoveSpeed: () => 0.5,
      updateCautiousAnimalApproachSpeed: noop,
      isDestroyedEntity: () => false,
      isCellBlockedForUnit: () => false,
      isRecoveringAttack: () => false,
      clearCellForUnit: noop,
      placeUnitOnCell: noop,
    },
  }
  const { moveUnitToPath } = loadTsModule('app/classes/unit/movement/UnitPathMovement.ts', { mocks })
  const { commitDirectMove } = loadTsModule('app/classes/unit/movement/UnitDirectMovementCommit.ts', { mocks })
  const { attemptDirectMove } = loadTsModule('app/classes/unit/movement/UnitDirectMovementStep.ts', { mocks })
  const { UnitDirectMovement } = loadTsModule('app/classes/unit/movement/UnitDirectMovement.ts', { mocks })
  const { moveAnimalToPath } = loadTsModule('app/classes/animal/AnimalMovementStep.ts', {
    mocks: {
      '../../lib': { ...mocks['../../../lib'], instanceContactInstance: () => false },
      '../../lib/mapSpaces': mocks['../../../lib/mapSpaces'],
      '../../lib/units/unitEnergy': {
        ...mocks['../../../lib/units/unitEnergy'],
        updateUnitEnergy: noop,
        drainEnergyAmount: noop,
        getActionEnergyCost: () => 0,
      },
      './AnimalContactApproach': { tryStartAnimalContactApproach: () => false },
    },
  })
  const makeUnit = () => ({
    ...grid[3][4],
    x: -32,
    y: 112,
    context: { map },
    currentCell: grid[3][4],
    sprite: { playing: true, play: noop },
    currentSheet: 'walking',
    setTextures: noop,
    degree: 0,
    speed: 0.5,
    stop: noop,
    path: [
      { i: 5, j: 4 },
      { i: 4, j: 4 },
    ],
    dest: { x: 32, y: 144, i: 5, j: 4 },
    destHasMoved: () => false,
    isUnitAtDest: () => false,
    affectNewDest: noop,
    applyReliefLift(level) {
      this.sampledHeight = level
      this.reliefUpdates = (this.reliefUpdates ?? 0) + 1
    },
  })
  return {
    grid,
    map,
    moveAnimalToPath,
    moveUnitToPath,
    commitDirectMove,
    attemptDirectMove,
    UnitDirectMovement,
    makeUnit,
  }
}

for (const reverse of [false, true])
  test(`path and direct movement agree without easing (${reverse ? 'uphill' : 'downhill'})`, () => {
    const { grid, map, moveUnitToPath, commitDirectMove, makeUnit } = fixture()
    const pathUnit = makeUnit()
    const directUnit = makeUnit()
    if (reverse) {
      for (const unit of [pathUnit, directUnit]) {
        Object.assign(unit, {
          i: 5,
          j: 4,
          z: 0,
          x: 32,
          y: 144,
          currentCell: grid[5][4],
          path: [
            { i: 3, j: 4 },
            { i: 4, j: 4 },
          ],
          dest: { x: -32, y: 112, i: 3, j: 4 },
        })
      }
    }
    let sampledSlope = 0
    let iterations = 0
    while (pathUnit.path.length && iterations++ < 250) {
      moveUnitToPath(pathUnit, () => false)
      const [i, j] = maths.isometricToCartesian(pathUnit.x, pathUnit.y)
      commitDirectMove(
        {
          unit: directUnit,
          contextMap: map,
          map,
          candidateX: pathUnit.x,
          candidateY: pathUnit.y,
          newI: i,
          newJ: j,
          crossingCell: i !== directUnit.i || j !== directUnit.j,
          targetCell: grid[i][j],
          heroControlled: false,
          effectiveDistance: 0.5,
        },
        1,
        0.5
      )
      assert.equal(pathUnit.sampledHeight, directUnit.sampledHeight)
      assert.equal(pathUnit.reliefUpdates, iterations)
      assert.equal(directUnit.reliefUpdates, iterations)
      if (pathUnit.sampledHeight > 0 && pathUnit.sampledHeight < 1) sampledSlope++
    }
    assert.equal(pathUnit.path.length, 0)
    assert.ok(sampledSlope > 3)
    assert.equal(pathUnit.sampledHeight, reverse ? 1 : 0)
  })

for (const reverse of [false, true])
  test(`direct controls respect the visible movement budget (${reverse ? 'uphill' : 'downhill'})`, () => {
    const { grid, attemptDirectMove, makeUnit } = fixture()
    const unit = makeUnit()
    // Vertical screen traversal through the centre of the bright front face.
    Object.assign(unit, { i: 4, j: 4, x: 0, y: 128 + (reverse ? 10 : -10), currentCell: grid[4][4] })
    const state = { unit, directMoveBlocker: null }
    const { getReliefLevelAtPoint } = loadTsModule('app/lib/terrain/reliefSurface.ts')
    const startHeight = getReliefLevelAtPoint(unit.context.map, unit, unit.currentCell)
    let before = { x: unit.x, y: unit.y - startHeight * 16 }
    let steps = 0
    while ((reverse ? unit.y > 118 : unit.y < 138) && steps++ < 100) {
      assert.equal(attemptDirectMove(state, 0, reverse ? -1 : 1, 1.5, 0, reverse ? -1 : 1), true)
      const after = { x: unit.x, y: unit.y - unit.sampledHeight * 16 }
      assert.ok(Math.hypot(after.x - before.x, after.y - before.y) <= 1.501)
      before = after
    }
    assert.ok(steps >= 24 && steps < 100)
    assert.equal(unit.sampledHeight, reverse ? 1 : 0)
  })

for (const frame of [14, 18])
  test(`diagnostic preview matches actual movement on slope ${frame}, including energy slowdown`, () => {
    const { grid, UnitDirectMovement, makeUnit } = fixture()
    grid[4][4]._terrainAppearance.relief.index = frame
    for (const direction of [-1, 1]) {
      for (const energySpeedFactor of [1, 0.5]) {
        const unit = makeUnit()
        Object.assign(unit, {
          x: 0,
          y: 130,
          i: 4,
          j: 4,
          currentCell: grid[4][4],
          energySpeedFactor,
        })
        const movement = new UnitDirectMovement(unit)
        const before = [unit.x, unit.y, unit.i, unit.j, unit.currentCell, unit.sampledHeight]
        const preview = movement.getDirectMoveCandidateDebug(0, direction, 1.5)
        assert.deepEqual([unit.x, unit.y, unit.i, unit.j, unit.currentCell, unit.sampledHeight], before)
        assert.equal(movement.attemptMoveDirect(0, direction, 1.5), true)
        assert.equal(preview.candidateX, Math.round(unit.x * 100) / 100)
        assert.equal(preview.candidateY, Math.round(unit.y * 100) / 100)
        assert.equal(preview.newI, unit.i)
        assert.equal(preview.newJ, unit.j)
        // The old diagnostic predicted the full flat-grid step here.
        assert.ok(Math.abs(unit.y - before[1]) < 1.5 * energySpeedFactor * 0.5)
      }
    }
  })

for (const reverse of [false, true]) {
  test(`animals and units traverse the entire slope identically (${reverse ? 'uphill' : 'downhill'})`, () => {
    const { grid, moveAnimalToPath, moveUnitToPath, makeUnit } = fixture()
    for (const row of grid)
      for (const cell of row) {
        cell.has = null
        cell.place = function (entity) {
          this.has = entity
        }
      }
    const unit = makeUnit()
    const animal = makeUnit()
    if (reverse)
      for (const entity of [unit, animal])
        Object.assign(entity, {
          i: 5,
          j: 4,
          x: 32,
          y: 144,
          currentCell: grid[5][4],
          path: [
            { i: 3, j: 4 },
            { i: 4, j: 4 },
          ],
          dest: { i: 3, j: 4, x: -32, y: 112 },
        })
    let ticks = 0
    while (unit.path.length && ticks++ < 300) {
      moveUnitToPath(unit, () => false)
      moveAnimalToPath(animal)
      assert.deepEqual(
        [animal.x, animal.y, animal.sampledHeight, animal.path.length],
        [unit.x, unit.y, unit.sampledHeight, unit.path.length]
      )
      assert.equal(animal.reliefUpdates, ticks)
      assert.equal(unit.reliefUpdates, ticks)
    }
    assert.ok(ticks < 300)
    assert.equal(animal.path.length, 0)
    assert.equal(animal.x, animal.dest.x)
    assert.equal(animal.y, animal.dest.y)
  })
}

test('flying animals cross slopes at flying speed while their ground lift follows the surface', () => {
  const { grid, moveAnimalToPath, makeUnit } = fixture()
  const { getReliefLevelAtPoint } = loadTsModule('app/lib/terrain/reliefSurface.ts')
  const animal = makeUnit()
  Object.assign(animal, { x: 2, y: 129, altitude: 20, currentCell: grid[4][4], path: [{ i: 5, j: 4 }] })
  const before = { x: animal.x, y: animal.y }
  moveAnimalToPath(animal)
  assert.ok(Math.abs(Math.hypot(animal.x - before.x, animal.y - before.y) - animal.speed) < 1e-9)
  assert.equal(animal.sampledHeight, getReliefLevelAtPoint(animal.context.map, animal, animal.currentCell))
})

test('keyboard contour travel crosses several cells without vertical drift or slowdown', () => {
  const { grid, UnitDirectMovement, makeUnit } = fixture()
  const { syncEntityRelief } = loadTsModule('app/lib/terrain/reliefSurface.ts')
  for (const sign of [-1, 1]) {
    const unit = makeUnit()
    const i = 4 + 4 / 64,
      j = sign > 0 ? 3 : 5
    const [x, y] = maths.cartesianToIsometric(i, j)
    Object.assign(unit, { x, y, i: 4, j, currentCell: grid[4][j] })
    syncEntityRelief(unit.context.map, unit)
    const startHeight = unit.sampledHeight
    assert.ok(startHeight > 0 && startHeight < 1)
    const movement = new UnitDirectMovement(unit)
    const dx = (-2 / Math.sqrt(5)) * sign,
      dy = (1 / Math.sqrt(5)) * sign
    for (let tick = 0; tick < 60; tick++) {
      const before = { x: unit.x, y: unit.y }
      assert.equal(movement.attemptMoveDirect(dx, dy, 1), true)
      assert.ok(Math.abs(unit.sampledHeight - startHeight) < 1e-9)
      assert.ok(Math.abs(unit.x - before.x - dx) < 1e-9)
      assert.ok(Math.abs(unit.y - before.y - dy) < 1e-9)
    }
  }
})
