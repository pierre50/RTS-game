const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { Assets } = require('pixi.js')
const equipment = require('../public/assets/data/gameplay/equipment.json')
Assets.cache.set('config', { equipment })
const stats = loadTsModule('app/lib/equipment/equipmentStats.ts')
const { getNpcWeaponChoice } = loadTsModule('app/lib/units/combat/npcWeapons.ts')
const { wearEquippedWeapon } = loadTsModule('app/lib/equipment/equipmentWear.ts', {
  mocks: { '../lang': { t: key => key } },
})
const geometry = loadTsModule('app/lib/contact/contactGeometry.ts')
const frames = loadTsModule('app/lib/graphics.ts', {
  mocks: Object.fromEntries(
    ['assets', 'colors', 'canvas', 'isoFootprint', 'textures'].map(n => [`./graphics/${n}`, {}])
  ),
})
const attackLoop = loadTsModule('app/lib/combat/combatAttackLoop.ts', {
  mocks: {
    '../graphics': frames,
    '../units/unitEnergy': { hasEnergyForAction: () => true, spendOrWaitForEnergy: () => true },
  },
})

function fixture(items) {
  const hits = [],
    shots = [],
    timers = []
  const target = { family: 'unit', type: 'Hero', x: 160, y: 0, i: 5, j: 0, hitPoints: 100 }
  const sprite = {
    textures: Array(9),
    currentFrame: 0,
    onLoop: undefined,
    gotoAndPlay(frame) {
      this.currentFrame = frame
    },
  }
  const unit = {
    type: 'Priest',
    gender: 'female',
    family: 'unit',
    action: 'attack',
    x: 0,
    y: 0,
    i: 0,
    j: 0,
    degree: 180,
    hitPoints: 20,
    attackRecoveryMs: 800,
    inventory: { npcWeaponsInitialized: true, equipment: [...items] },
    owner: { config: { units: {}, equipment } },
    dest: target,
    realDest: { ...target },
    sprite,
    context: {
      map: {},
      scheduler: {
        addOneShot: fn => {
          timers.push(fn)
          return timers.length
        },
        remove() {},
      },
    },
    getActionCondition: () => true,
    isUnitAtDest() {
      const choice = getNpcWeaponChoice(unit)
      return choice.kind === 'ranged' || geometry.canReachContact(unit, target, choice.weapon)
    },
    setTextures() {},
    sendToEvt() {
      if (getNpcWeaponChoice(unit).kind === 'melee') unit.x = target.x - 15
      combat.handleAttackAction()
    },
  }
  const { UnitCombat } = loadTsModule('app/classes/unit/UnitCombat.ts', {
    mocks: {
      '../../lib': {
        ...frames,
        playAudibleSoundCue() {},
        prepareAutomaticParry() {},
        syncMovedActionTarget() {},
        applyCombatHit(attacker, victim) {
          const power = stats.getEntityWeaponPower(attacker)
          hits.push({ weapon: getNpcWeaponChoice(attacker).weapon, power })
          victim.hitPoints -= power
          wearEquippedWeapon(attacker, 'melee')
          return { killed: false }
        },
      },
      '../../lib/combat/combatAttackLoop': attackLoop,
      '../../lib/entities/slashRecoveryAnimation': { playReverseSlashRecovery: () => false },
      '../../lib/contact/contactDebug': { showContactDebug() {} },
      '../../lib/units/unitExperience': { getCombatXpBonus: () => 0, XP_CATEGORIES: { melee: 'melee' } },
      '../../services/BuildingInteriorSpaceSystem': {},
      '../../lib/projectiles': { attachProjectileToMapSpace() {} },
      '../Projectile': {
        Projectile: class {
          constructor(options) {
            shots.push(options)
          }
        },
      },
    },
  })
  const combat = new UnitCombat(unit)
  return {
    unit,
    combat,
    target,
    hits,
    shots,
    release() {
      unit.sprite.onFrameChange(8)
    },
    recover() {
      unit.sprite.onLoop?.()
      timers.shift()?.()
    },
  }
}

test('a priest fires a carried bow, then chains spare melee weapons and unarmed attacks after breakage', () => {
  const f = fixture(['arrow_iron', 'bow~uses:1', 'sword_iron~uses:1', 'dagger_bronze~uses:1'])
  f.combat.handleAttackAction()
  f.release()
  assert.equal(f.shots.length, 1)
  assert.equal(f.shots[0].type, 'ArrowIron')
  assert.equal(
    f.unit.inventory.equipment[0],
    'bow~condition:0',
    'arrow removal must not wear the wrong inventory entry'
  )
  for (let i = 0; i < 3; i++) {
    f.release()
    f.recover()
  }
  assert.deepEqual(
    f.hits.map(hit => hit.power),
    [equipment.sword_iron.weapon.power, equipment.dagger_bronze.weapon.power, 0.5]
  )
})

test('closing into melee range during bow windup switches animation without firing a stale arrow', () => {
  const f = fixture(['bow', 'arrow_ceramic', 'sword_iron'])
  f.combat.handleAttackAction()
  f.target.x = 30
  f.release()
  assert.equal(f.shots.length, 0)
  assert.ok(f.unit.inventory.equipment.includes('arrow_ceramic'))
  f.release()
  assert.equal(f.hits.length, 1)
})

test('removing a weapon during windup cannot release it and ordinary bow wear keeps recovery', () => {
  const f = fixture(['bow', 'arrow_ceramic', 'arrow_ceramic'])
  f.combat.handleAttackAction()
  f.release()
  assert.equal(f.shots.length, 1)
  assert.equal(f.unit.actionLocked, true, 'ordinary wear must not skip attack recovery')
  f.recover()
  f.unit.inventory.equipment.splice(0, 1)
  f.release()
  assert.equal(f.shots.length, 1)
  f.release()
  assert.equal(f.hits[0].power, 0.5)
})

for (const family of ['axe', 'pickaxe', 'hammer', 'scythe']) {
  test(`a villager's combat loop strikes with its equipped ${family}, then uses fists when it breaks`, () => {
    const f = fixture([])
    f.unit.type = 'Villager'
    f.unit.inventory.activeWeapons = { tool: `${family}_bronze~uses:1` }
    f.unit.x = f.target.x - 15
    f.combat.handleAttackAction()
    f.release()
    f.recover()
    f.release()
    assert.deepEqual(
      f.hits.map(hit => hit.power),
      [equipment[`${family}_bronze`].weapon.power, 0.5]
    )
    assert.equal(f.unit.inventory.activeWeapons.tool, `${family}_bronze~condition:0`)
    assert.equal(f.shots.length, 0)
  })
}
