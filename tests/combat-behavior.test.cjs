const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadCombatBehavior() {
  const filename = path.join(__dirname, '../app/lib/combat/combatBehavior.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../constants': {
      ACTION_TYPES: { attack: 'attack' },
      BUILDING_TYPES: { house: 'House', townCenter: 'TownCenter' },
      CELL_HEIGHT: 32,
      CELL_WIDTH: 64,
      SHEET_TYPES: { standing: 'standingSheet' },
    },
    './grid': {
      getCellsAroundPoint: (startX, startY, grid, dist, callback) => {
        const cells = []
        for (let i = startX - dist; i <= startX + dist; i++) {
          for (let j = startY - dist; j <= startY + dist; j++) {
            const cell = grid[i]?.[j]
            if (!cell) continue
            if (Math.abs(i - startX) + Math.abs(j - startY) > dist) continue
            if (!callback || callback(cell)) cells.push(cell)
          }
        }
        return cells
      },
      getInstancePath: (_unit, i, j, map) => {
        const cell = map.grid[i]?.[j]
        return cell && !cell.unreachable ? [cell] : []
      },
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function buildGrid(size, spaceId) {
  const grid = []
  for (let i = 0; i < size; i++) {
    grid[i] = []
    for (let j = 0; j < size; j++) {
      grid[i][j] = {
        i,
        j,
        ...(spaceId ? { spaceId } : {}),
        x: i * 64,
        y: j * 32,
        solid: false,
        border: false,
        waterBorder: false,
      }
    }
  }
  return grid
}

function createRecoveryFixture(overrides = {}) {
  const grid = buildGrid(12)
  const calls = []
  const target = {
    family: 'unit',
    i: 5,
    j: 5,
    x: grid[5][5].x,
    y: grid[5][5].y,
    isDead: false,
    isDestroyed: false,
  }
  const unit = {
    action: 'attack',
    combatBehavior: {
      recoveryMode: 'orbit',
      recoveryMinDistance: 1.2,
      recoveryMaxDistance: 3,
      recoveryRepositionMs: 650,
      recoverySearchRadius: 5,
    },
    context: { map: { grid }, scheduler: { elapsedMs: 0 } },
    energy: 0,
    family: 'animal',
    i: 5,
    j: 4,
    label: 'aggressive-1',
    path: [],
    totalEnergy: 10,
    type: 'Boar',
    x: grid[5][4].x,
    y: grid[5][4].y,
    sendTo: cell => calls.push(['sendTo', cell]),
    setTextures: sheet => calls.push(['setTextures', sheet]),
    sprite: { stop: () => calls.push(['sprite.stop']) },
    waitingForEnergyTarget: target,
    ...overrides,
  }
  return { calls, grid, target, unit }
}

test('combat recovery leaves attack visuals and moves to a reachable orbit cell', () => {
  const { enterCombatRecovery } = loadCombatBehavior()
  const { calls, target, unit } = createRecoveryFixture()

  enterCombatRecovery(unit, target)

  assert.equal(unit.combatMode, 'recover')
  assert.equal(unit.action, null)
  assert.deepEqual(calls.slice(0, 2), [['setTextures', 'standingSheet'], ['sprite.stop']])
  const move = calls.find(([type]) => type === 'sendTo')
  assert.ok(move)
  assert.notDeepEqual([move[1].i, move[1].j], [unit.i, unit.j])
  assert.notEqual(move[1].solid, true)
})

test('combat recovery searches the unit runtime map space grid', () => {
  const { enterCombatRecovery } = loadCombatBehavior()
  const outsideGrid = buildGrid(12)
  const interiorGrid = buildGrid(12, 'interior:test')
  const { calls, target, unit } = createRecoveryFixture({
    context: {
      map: {
        grid: outsideGrid,
        size: 11,
        spaces: new Map([
          [
            'interior:test',
            {
              container: {},
              grid: interiorGrid,
              id: 'interior:test',
              kind: 'interior',
              origin: { x: 100, y: 50 },
              size: 11,
            },
          ],
        ]),
      },
      scheduler: { elapsedMs: 0 },
    },
    spaceId: 'interior:test',
  })
  target.spaceId = 'interior:test'

  enterCombatRecovery(unit, target)

  const move = calls.find(([type]) => type === 'sendTo')
  assert.ok(move)
  assert.equal(move[1].spaceId, 'interior:test')
})

test('combat recovery keeps orbiting only after its reposition delay', () => {
  const { enterCombatRecovery, updateCombatRecoveryMovement } = loadCombatBehavior()
  const { calls, target, unit } = createRecoveryFixture()

  enterCombatRecovery(unit, target)
  assert.equal(calls.filter(([type]) => type === 'sendTo').length, 1)

  unit.context.scheduler.elapsedMs = 300
  updateCombatRecoveryMovement(unit)
  assert.equal(calls.filter(([type]) => type === 'sendTo').length, 1)

  unit.context.scheduler.elapsedMs = 800
  updateCombatRecoveryMovement(unit)
  assert.equal(calls.filter(([type]) => type === 'sendTo').length, 2)
})

test('combat recovery reengages at the configured energy ratio', () => {
  const { isCombatRecoveryReadyToReengage } = loadCombatBehavior()
  const { unit } = createRecoveryFixture({
    combatBehavior: { reengageEnergyRatio: 0.75 },
    energy: 7,
    totalEnergy: 10,
  })

  assert.equal(isCombatRecoveryReadyToReengage(unit), false)
  unit.energy = 7.5
  assert.equal(isCombatRecoveryReadyToReengage(unit), true)
})

test('combat recovery presets can define reengage behavior', () => {
  const { isCombatRecoveryReadyToReengage } = loadCombatBehavior()
  const { unit } = createRecoveryFixture({
    combatBehavior: undefined,
    combatBehaviorPreset: 'rangedKite',
    energy: 7.5,
    totalEnergy: 10,
  })

  assert.equal(isCombatRecoveryReadyToReengage(unit), true)
})

test('combat recovery exposes a shared aggro suppression guard', () => {
  const { shouldSuppressAggroDuringCombatRecovery } = loadCombatBehavior()
  const { unit } = createRecoveryFixture({
    combatMode: 'recover',
    waitingForEnergyAction: 'attack',
  })

  assert.equal(shouldSuppressAggroDuringCombatRecovery(unit), true)
  unit.waitingForEnergyAction = 'chopwood'
  assert.equal(shouldSuppressAggroDuringCombatRecovery(unit), false)
})

test('combat recovery hold mode waits without moving', () => {
  const { enterCombatRecovery } = loadCombatBehavior()
  const { calls, target, unit } = createRecoveryFixture({
    combatBehavior: { recoveryMode: 'hold' },
  })

  enterCombatRecovery(unit, target)

  assert.equal(unit.combatMode, 'recover')
  assert.equal(calls.some(([type]) => type === 'sendTo'), false)
  assert.ok(calls.some(([type]) => type === 'setTextures'))
})

test('combat flee cancels a pending recovery attack resume', () => {
  const { markCombatFlee } = loadCombatBehavior()
  const removedTasks = []
  const { unit } = createRecoveryFixture({
    combatMode: 'recover',
    energyWaitTaskId: 42,
    waitingForEnergyAction: 'attack',
    waitingForEnergyTarget: { label: 'hero-1' },
  })
  unit.context.scheduler.remove = taskId => removedTasks.push(taskId)

  markCombatFlee(unit)

  assert.equal(unit.combatMode, 'flee')
  assert.equal(unit.waitingForEnergyAction, null)
  assert.equal(unit.waitingForEnergyTarget, null)
  assert.equal(unit.energyWaitTaskId, null)
  assert.deepEqual(removedTasks, [42])
})

test('combat morale roll is stable per labelled unit and supports overrides', () => {
  const { getCombatMoraleRoll } = loadCombatBehavior()

  const roll = getCombatMoraleRoll({ label: 'bandit-2-17', type: 'Bandit2' })

  assert.equal(getCombatMoraleRoll({ label: 'bandit-2-17', type: 'Bandit2' }), roll)
  assert.equal(roll >= 0 && roll <= 1, true)
  assert.equal(getCombatMoraleRoll({ combatMoraleRoll: -3 }), 0)
  assert.equal(getCombatMoraleRoll({ combatMoraleRoll: 2 }), 1)
  assert.equal(getCombatMoraleRoll({ type: 'Bandit2' }), 1)
})
