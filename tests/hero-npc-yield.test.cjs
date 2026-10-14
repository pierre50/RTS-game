const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup(freeCell = false, type = 'Villager') {
  const sent = []
  const grid = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => ({
    i, j, x: i * 32, y: j * 32, solid: true, category: 'Ground', has: { type: 'wall' },
  })))
  const npc = { type, i: 1, j: 1, x: 32, y: 32, path: [], sendToEvt: (...args) => {
    sent.push(args)
    npc.dest = args[0]
    npc.path = [args[0]]
  } }
  grid[1][1].has = npc
  if (freeCell) {
    grid[2][1].solid = false
    grid[2][1].has = null
  }
  const map = { grid }
  npc.context = { map }
  const hero = { x: 0, y: 32 }
  const { shouldIgnoreYieldingNpc, clearNpcYieldWhenSeparated } = loadTsModule(
    'app/classes/unit/movement/HeroNpcYield.ts', {
      mocks: {
        '../../../constants': { UNIT_TYPES: { villager: 'Villager', hero: 'Hero' } },
        '../../../lib/units/unitControl': { isHeroControlled: unit => unit.controlMode === 'hero' },
        '../../../lib/mapSpaces': { getEntitySpaceMapLike: unit => unit.context?.map },
        '../../../lib/grid/movement': { getInstancePath: () => [{}] },
        '../../../lib/buildings/passageCells': {
          createReservedPassageCellLookup: () => ({ has: () => false }),
          canUnitUseCellAsIdleDestination: (_unit, cell) => Boolean(cell && !cell.solid),
        },
      },
    }
  )
  return { npc, hero, sent, shouldIgnoreYieldingNpc, clearNpcYieldWhenSeparated }
}

test('idle villager steps aside after sustained contact when a free cell exists', () => {
  const f = setup(true)
  const originalNow = Date.now
  let now = 1000
  Date.now = () => now
  try {
    assert.equal(f.shouldIgnoreYieldingNpc(f.hero, f.npc), false)
    now += 200
    assert.equal(f.shouldIgnoreYieldingNpc(f.hero, f.npc), false)
    assert.equal(f.sent.length, 1)
    assert.deepEqual([f.sent[0][0].i, f.sent[0][0].j], [2, 1])
    assert.equal(f.shouldIgnoreYieldingNpc(f.hero, f.npc), false)
    assert.equal(f.sent.length, 1)
  } finally { Date.now = originalNow }
})

test('idle villager permits only the pushing hero through when no side cell is free', () => {
  const f = setup(false)
  const otherHero = { x: 0, y: 32 }
  const originalNow = Date.now
  let now = 1000
  Date.now = () => now
  try {
    assert.equal(f.shouldIgnoreYieldingNpc(f.hero, f.npc), false)
    now += 200
    assert.equal(f.shouldIgnoreYieldingNpc(f.hero, f.npc), true)
    assert.equal(f.shouldIgnoreYieldingNpc(otherHero, f.npc), false)
    assert.equal(f.sent.length, 0)
    f.hero.x = 100
    f.clearNpcYieldWhenSeparated(f.hero)
    assert.equal(f.shouldIgnoreYieldingNpc(f.hero, f.npc), false)
  } finally { Date.now = originalNow }
})

test('hero can pass when an apparently free side cell is rejected by movement', () => {
  const f = setup(true)
  f.npc.sendToEvt = () => {}
  const originalNow = Date.now
  let now = 1000
  Date.now = () => now
  try {
    assert.equal(f.shouldIgnoreYieldingNpc(f.hero, f.npc), false)
    now += 200
    assert.equal(f.shouldIgnoreYieldingNpc(f.hero, f.npc), true)
  } finally { Date.now = originalNow }
})

test('busy villagers never yield or become traversable', () => {
  const f = setup(false)
  f.npc.action = 'build'
  const originalNow = Date.now
  let now = 1000
  Date.now = () => now
  try {
    assert.equal(f.shouldIgnoreYieldingNpc(f.hero, f.npc), false)
    now += 500
    assert.equal(f.shouldIgnoreYieldingNpc(f.hero, f.npc), false)
  } finally { Date.now = originalNow }
})

test('other idle NPC types yield, while heroes and enemies remain solid', () => {
  const originalNow = Date.now
  let now = 1000
  Date.now = () => now
  try {
    for (const type of ['Chief', 'Priest', 'Fantassin', 'Bowman', 'Scout']) {
      const f = setup(false, type)
      assert.equal(f.shouldIgnoreYieldingNpc(f.hero, f.npc), false)
      now += 200
      assert.equal(f.shouldIgnoreYieldingNpc(f.hero, f.npc), true, type)
    }
    const hero = setup(false, 'Hero')
    assert.equal(hero.shouldIgnoreYieldingNpc(hero.hero, hero.npc), false)
    now += 200
    assert.equal(hero.shouldIgnoreYieldingNpc(hero.hero, hero.npc), false)

    const enemy = setup(false, 'BanditSword')
    enemy.hero.owner = { isEnemy: () => true }
    enemy.npc.owner = { isEnemy: () => true }
    assert.equal(enemy.shouldIgnoreYieldingNpc(enemy.hero, enemy.npc), false)
    now += 200
    assert.equal(enemy.shouldIgnoreYieldingNpc(enemy.hero, enemy.npc), false)
  } finally { Date.now = originalNow }
})
