const assert = require('node:assert/strict')
const test = require('node:test')
const { AnimatedSprite, Texture, Assets } = require('pixi.js')
const fs = require('node:fs')
const path = require('node:path')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const frames = loadTsModule('app/lib/graphics.ts', {
  mocks: Object.fromEntries(
    ['assets', 'colors', 'canvas', 'isoFootprint', 'textures'].map(n => [`./graphics/${n}`, {}])
  ),
})
const loop = loadTsModule('app/lib/combat/combatAttackLoop.ts', {
  mocks: {
    '../graphics': frames,
    '../units/unitEnergy': {
      hasEnergyForAction: () => true,
      spendOrWaitForEnergy: () => true,
    },
  },
})
const geometry = loadTsModule('app/lib/contact/contactGeometry.ts')
const { setUnitTexture } = loadTsModule('app/lib/entities/spriteTextures.ts')
const stats = loadTsModule('app/lib/equipment/equipmentStats.ts')
const { canAttack } = loadTsModule('app/lib/combat/combatCapabilities.ts')
const { createPlayerData } = loadTsModule('app/config/playerConfig.ts')
const equipment = require('../public/assets/data/gameplay/equipment.json')
Assets.cache.set('config', { equipment })

for (const type of ['BanditArcher', 'Bowman']) {
  test(`${type} with an empty quiver animates and lands repeated dagger hits`, () => {
    const target = { family: 'unit', type: 'Hero', x: 30, y: 0, i: 1, j: 0, hitPoints: 100 }
    const tasks = new Map()
    let serial = 0
    const scheduler = {
      elapsedMs: 0,
      add(fn) {
        tasks.set(++serial, fn)
        return serial
      },
      addOneShot(fn) {
        const id = ++serial
        tasks.set(id, () => {
          tasks.delete(id)
          fn()
        })
        return id
      },
      remove(id) {
        tasks.delete(id)
      },
    }
    const config = createPlayerData({ units: { Bowman: {} }, buildings: {}, projectiles: {}, equipment }, 'Alba')
    const sprite = new AnimatedSprite({ textures: [new Texture()], autoUpdate: false })
    const unit = {
      sheetDirectionCounts: { actionSheet: 3, walkingSheet: 3, standingSheet: 3 },
      type,
      family: 'unit',
      action: 'attack',
      projectile: 'Arrow',
      x: 0,
      y: 0,
      i: 0,
      j: 0,
      degree: 180,
      hitPoints: 20,
      energy: 20,
      attackRecoveryMs: 800,
      owner: { civ: 'Alba', config },
      equipment: config.units[type].equipment,
      inventory: { equipment: [], npcArrows: { initialized: true } },
      dest: target,
      realDest: { ...target },
      sprite,
      context: { map: {}, scheduler },
      setTextures(sheet) {
        setUnitTexture(sheet, unit)
      },
      getActionCondition: () => canAttack(unit),
      isUnitAtDest: () => geometry.canReachContact(unit, target, stats.getEntityMeleeWeapon(unit)),
    }
    // Use the body atlas's actual names so alias/animation selection is exercised.
    const atlas = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../public/assets/graphics/units/bandit_archer/male/texture.json'), 'utf8')
    )
    for (const [sheet, suffix] of [
      ['actionSheet', '_action_slash.png'],
      ['walkingSheet', '_walking.png'],
    ]) {
      const alias = `test/${type}/${sheet}`
      const textures = Object.fromEntries(
        Object.keys(atlas.frames)
          .filter(n => n.endsWith(suffix))
          .map(n => [n, new Texture()])
      )
      Assets.cache.set(alias, { textures, data: { animationSpeed: 0.25 } })
      unit.assets ??= {}
      unit.assets[sheet] = alias
    }
    unit.assets.standingSheet = unit.assets.walkingSheet
    const { UnitCombat } = loadTsModule('app/classes/unit/UnitCombat.ts', {
      mocks: {
        '../../lib': {
          ...frames,
          playAudibleSoundCue() {},
          prepareAutomaticParry() {},
          applyCombatHit(_unit, dest) {
            dest.hitPoints -= 6
            return { killed: false }
          },
        },
        '../../lib/combat/combatAttackLoop': loop,
        '../../lib/contact/contactDebug': { showContactDebug() {} },
        '../../lib/units/unitExperience': { getCombatXpBonus: () => 0, XP_CATEGORIES: { melee: 'melee' } },
        '../Projectile': {},
        '../../services/BuildingInteriorSpaceSystem': {},
      },
    })
    const combat = new UnitCombat(unit)
    assert.equal(canAttack(unit), true, 'the configured archer must own a usable melee weapon')
    combat.handleAttackAction()
    assert.equal(sprite.textures.length, 6)
    for (let tick = 0; tick < 240; tick++) {
      sprite.update({ deltaTime: 1 })
      if (tick % 60 === 59) for (const fn of [...tasks.values()]) fn()
    }
    assert.ok(target.hitPoints <= 88, `Expected repeated hits, got HP ${target.hitPoints}`)
    sprite.destroy()
  })
}
