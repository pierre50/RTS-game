const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { restoreAIState } = loadTsModule('app/classes/map/MapSaveAI.ts', {
  mocks: {
    '../../lib/playerState': { isAIControlledPlayer: player => player.type === 'AI' },
    '../../constants': { FAMILY_TYPES: { unit: 'unit', building: 'building' } },
  },
})
function fixture() {
  const entities = new Map()
  const player = {
    type: 'AI',
    phase: 'economy',
    getNow: () => 10000,
    enemyUnitMemory: new Map(),
    enemyBuildingMemory: new Map(),
    threatenedTargets: new Map(),
    foundedEnemyUnits: new Set(),
    foundedEnemyBuildings: new Set(),
    views: { isVisible: (i, j) => i === j },
    isEnemy: owner => owner === 'enemy',
    rememberEnemy(entity) {
      ;(entity.family === 'building' ? this.enemyBuildingMemory : this.enemyUnitMemory).set(entity.label, {
        instance: entity,
      })
    },
  }
  const map = { grid: [[{ i: 0, j: 0 }]], getChildByLabel: label => entities.get(label) ?? null }
  function entity(label, options = {}) {
    const result = { label, family: 'unit', type: 'Soldier', owner: 'enemy', i: 1, j: 1, ...options }
    entities.set(label, result)
    return result
  }
  return { player, map, entity }
}
test('AI memories restore only living enemies and convert saved attack phases into preparation', () => {
  const f = fixture()
  const enemy = f.entity('enemy')
  const building = f.entity('building', { family: 'building', i: 2 })
  f.entity('dead', { isDead: true })
  f.entity('destroyed', { isDestroyed: true })
  f.entity('ally', { owner: 'ally' })
  f.player.enemyUnitMemory.set('stale', {})
  restoreAIState(
    f.player,
    {
      aiState: {
        phase: 'attack',
        enemyUnits: [
          null,
          1,
          { instance: 'missing' },
          { instance: 'dead' },
          { instance: 'destroyed' },
          { instance: 'ally' },
          { instance: 'enemy', lastSeenAgo: 250 },
        ],
        enemyBuildings: [{ instance: 'building', lastSeenAgo: -20 }],
      },
    },
    f.map
  )
  assert.equal(f.player.phase, 'military_build')
  assert.deepEqual([...f.player.enemyUnitMemory.keys()], ['enemy'])
  assert.equal(f.player.enemyUnitMemory.get('enemy').lastSeenAt, 9750)
  assert.equal(f.player.enemyUnitMemory.get('enemy').visible, true)
  assert.equal(f.player.enemyBuildingMemory.get('building').visible, false)
  assert.equal(f.player.enemyBuildingMemory.get('building').lastSeenAt, 10000)
  assert.ok(f.player.foundedEnemyUnits.has(enemy))
  assert.ok(f.player.foundedEnemyBuildings.has(building))
})
test('AI threat restoration resolves references and supports both elapsed and legacy timestamps', () => {
  const f = fixture()
  const target = f.entity('target')
  const attacker = f.entity('attacker', { family: 'building', type: 'Tower' })
  f.entity('dead', { isDead: true })
  f.player.threatenedTargets.set('stale', {})
  for (const [timeFields, expected] of [
    [{ lastSeenAgo: 250 }, 9750],
    [{ lastSeenAt: 700 }, 9700],
    [{}, 10000],
  ]) {
    restoreAIState(
      f.player,
      {
        aiState: {
          savedAt: 1000,
          threatenedTargets: [
            null,
            1,
            { target: 'missing' },
            { target: 'dead' },
            { target: [0, 0] },
            { target: [0, 0, 'target'], attacker: 'attacker', count: 2, ...timeFields },
          ],
        },
      },
      f.map
    )
    const threat = f.player.threatenedTargets.get('target')
    assert.equal(f.player.threatenedTargets.size, 1)
    assert.equal(threat.target, target)
    assert.equal(threat.attacker, attacker)
    assert.equal(threat.lastSeenAt, expected)
    assert.equal(threat.attackerFamily, 'building')
    assert.equal(threat.attackerType, 'Tower')
    assert.equal(threat.count, 2)
  }
  restoreAIState(
    f.player,
    {
      aiState: {
        threatenedTargets: [{ target: 'target', attackerFamily: 'unit', attackerType: 'Archer', count: NaN }],
      },
    },
    f.map
  )
  const threat = f.player.threatenedTargets.get('target')
  assert.equal(threat.attacker, null)
  assert.equal(threat.attackerType, 'Archer')
  assert.equal(threat.count, 0)
})
test('AI restore ignores human players and absent state while empty AI state clears memories', () => {
  const f = fixture()
  f.player.enemyUnitMemory.set('old', {})
  restoreAIState(f.player, {}, f.map)
  assert.equal(f.player.enemyUnitMemory.size, 1)
  f.player.type = 'Human'
  restoreAIState(f.player, { aiState: {} }, f.map)
  assert.equal(f.player.enemyUnitMemory.size, 1)
  f.player.type = 'AI'
  restoreAIState(f.player, { aiState: { phase: 'unknown' } }, f.map)
  assert.equal(f.player.phase, 'economy')
  assert.equal(f.player.enemyUnitMemory.size, 0)
})
