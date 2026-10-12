const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { getTowerCombatProfile, getBuildingAttackRange } = loadTsModule('app/lib/buildings/towerCombat.ts')

function fixture(buildingLevel) {
  const shots = [],
    candidates = []
  let tick,
    intervalStarts = 0
  const { BuildingCombat } = loadTsModule('app/classes/building/BuildingCombat.ts', {
    mocks: {
      '../../lib': {
        findInstancesInSight: () => candidates,
        getActionCondition: (_building, target) => target.hostile,
        instancesDistance: (_building, target) => target.distance,
      },
      '../Projectile': {
        Projectile: class {
          constructor(options) {
            Object.assign(this, options)
            shots.push(options)
          }
        },
      },
      '../../lib/projectiles': { attachProjectileToMapSpace() {} },
    },
  })
  const building = {
    type: 'WatchTower',
    family: 'building',
    buildingLevel,
    range: 6,
    isBuilt: true,
    projectile: 'Arrow',
    rateOfFire: 1.9,
    context: { map: {} },
    startAttackInterval(callback, interval) {
      intervalStarts++
      assert.equal(interval, 1.9)
      tick = callback
      this.attackIntervalId = 1
    },
    stopAttackInterval() {
      this.attackIntervalId = null
    },
  }
  const combat = new BuildingCombat(building)
  const enemy = (label, distance = 5, extra = {}) => ({ label, family: 'unit', hostile: true, distance, ...extra })
  return { building, combat, enemy, candidates, shots, tick: () => tick(), starts: () => intervalStarts }
}

test('tower levels fire at distinct enemies with unchanged cadence', () => {
  for (const [level, power] of [3, 5, 7].entries()) {
    const f = fixture(level)
    const enemies = [f.enemy('a'), f.enemy('b'), f.enemy('c'), f.enemy('d')]
    f.candidates.push(...enemies, enemies[0])
    f.combat.attackAction(enemies[0])
    f.tick()
    assert.equal(f.shots.length, level + 1)
    assert.equal(new Set(f.shots.map(shot => shot.target)).size, level + 1)
    assert.ok(f.shots.every(shot => shot.weaponPower === power))
    f.combat.attackAction(enemies[1])
    assert.equal(f.starts(), 1)
  }
})

test('a lone enemy receives only one arrow even at the highest level', () => {
  const f = fixture(2),
    target = f.enemy('a')
  f.candidates.push(target, target)
  f.combat.attackAction(target)
  f.tick()
  assert.equal(f.shots.length, 1)
})

test('salvos exclude allies, dead targets, animals, other interiors and out-of-range targets', () => {
  const f = fixture(2),
    target = f.enemy('primary')
  f.candidates.push(
    target,
    f.enemy('ally', 2, { hostile: false }),
    f.enemy('dead', 2, { isDead: true }),
    f.enemy('animal', 2, { family: 'animal' }),
    f.enemy('interior', 2, { spaceId: 'inside' }),
    f.enemy('far', 9),
    f.enemy('edge', 8)
  )
  f.combat.attackAction(target)
  f.tick()
  assert.deepEqual(
    f.shots.map(shot => shot.target.label),
    ['primary', 'edge']
  )
  target.isDead = true
  f.shots.length = 0
  f.tick()
  assert.deepEqual(
    f.shots.map(shot => shot.target.label),
    ['edge']
  )
  f.building.isDestroyed = true
  f.shots.length = 0
  f.tick()
  assert.equal(f.shots.length, 0)
  assert.equal(f.building.attackIntervalId, null)
})

test('an ongoing interval reads the completed level each volley and stops without valid targets', () => {
  const f = fixture(0),
    target = f.enemy('primary')
  f.candidates.push(target, f.enemy('edge', 8), f.enemy('middle', 7))
  f.combat.attackAction(target)
  f.tick()
  assert.equal(f.shots.length, 1)
  f.building.buildingLevel = 2
  f.shots.length = 0
  f.tick()
  assert.equal(f.shots.length, 3)
  assert.ok(f.shots.every(shot => shot.weaponPower === 7))
  f.candidates.forEach(enemy => {
    enemy.hostile = false
  })
  f.tick()
  assert.equal(f.building.attackIntervalId, null)
})

test('range and combat power derive from saved tower level, including legacy asset level', () => {
  const { getEntityWeaponPower } = loadTsModule('app/lib/equipment/equipmentStats.ts')
  for (const level of [0, 1, 2]) {
    const saved = JSON.parse(JSON.stringify({ type: 'WatchTower', buildingLevel: level, range: 6 }))
    assert.equal(getBuildingAttackRange(saved), 6 + level)
    assert.equal(getEntityWeaponPower(saved), 3 + level * 2)
  }
  assert.equal(getTowerCombatProfile({ type: 'WatchTower', assetLevel: 2 }).targets, 3)
  assert.equal(getBuildingAttackRange({ type: 'Other', range: 4 }), 4)
  assert.equal(getTowerCombatProfile({ type: 'Other' }), undefined)
})

test('detection reaches upgraded range and does not restart an active salvo timer', () => {
  const f = fixture(0),
    enemy = f.enemy('edge', 8)
  f.combat.detect(enemy)
  assert.equal(f.starts(), 0)
  f.building.buildingLevel = 2
  f.combat.detect(enemy)
  assert.equal(f.starts(), 1)
  f.combat.detect(enemy)
  assert.equal(f.starts(), 1)
})

test('town center reuses salvos with its own slower cadence, range and power', () => {
  for (const [level, arrows] of [1, 1, 2].entries()) {
    const f = fixture(level)
    f.building.type = 'TownCenter'
    let tick
    f.building.startAttackInterval = (callback, interval) => {
      assert.equal(interval, 2.5)
      tick = callback
      f.building.attackIntervalId = 1
    }
    const target = f.enemy('primary', 4)
    f.candidates.push(target, f.enemy('secondary', 5), f.enemy('far', 6))
    f.combat.attackAction(target)
    tick()
    assert.equal(f.shots.length, arrows)
    assert.ok(f.shots.every(shot => shot.weaponPower === [2, 3, 4][level]))
  }
})
