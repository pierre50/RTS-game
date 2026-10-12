const test = require('node:test')
const assert = require('node:assert/strict')
const { performanceCatalogue } = require('../tools/economy/performance.cjs')
const equipment = require('../public/assets/data/gameplay/equipment.json')
const units = require('../public/assets/data/gameplay/units.json')
const data = performanceCatalogue(equipment, units)
test('damage applies armor floor before skill bonus, including unarmed and ranged combinations', () => {
  const pick = data.weapons.find(w => w.id === 'pickaxe_ceramic')
  assert.equal(pick.scenarios[4].damages[3].damage, 3)
  assert.equal(pick.scenarios[4].damages[3].critical, 6)
  assert.equal(data.weapons.find(w => w.id === 'unarmed').scenarios[0].damages[3].damage, 0.5)
  assert.equal(data.weapons.find(w => w.id === 'bow+arrow_bronze').power, 8)
  assert.equal(data.weapons.find(w => w.id === 'axe_bronze').scenarios[0].damages[0].damage, 4)
  assert.equal(data.levels.length, 20)
})
test('equipped tool and skill bonuses combine without equating combat power and harvest yield', () => {
  const initial = data.tools.filter(t => t.type === 'Hero' && t.level === 1)
  assert.deepEqual(
    initial.map(t => t.wood),
    [1, 3, 4]
  )
  assert.deepEqual(
    initial.map(t => t.buildMultiplier),
    [1, 1.5, 1.75]
  )
  const experienced = data.tools.find(t => t.type === 'Hero' && t.level === 4 && t.tier === 2)
  assert.equal(experienced.wood, 4)
  assert.ok(Math.abs(experienced.buildMultiplier - 1.725) < 1e-10)
  assert.equal(data.swings.wood, 2)
  assert.equal(data.swings.iron, 4)
})

test('audit treats slingshot as ranged and identifies the four tools separately from weapons', () => {
  assert.equal(data.weapons.find(w => w.id === 'slingshot').category, 'ranged')
  for (const family of ['axe', 'pickaxe', 'hammer', 'scythe']) {
    const item = data.weapons.find(w => w.id === `${family}_iron`)
    assert.equal(item.tool, true)
    assert.equal(item.power, 5)
  }
})

test('NPC audit runs all material payments and combat fallback scenarios against game rules', () => {
  const { npcEquipmentCatalogue } = require('../tools/economy/npc-equipment.cjs')
  const result = npcEquipmentCatalogue()
  assert.equal(result.replacements.length, 12)
  assert.equal(result.passed, true)
  assert.ok(result.checks.length >= 14)
  assert.ok(result.loadouts.find(u => u.label === 'Bandit1').equipment.includes('mace_bronze'))
  assert.ok(result.loadouts.find(u => u.label === 'Bandit2').equipment.includes('sword_bronze'))
  for (const item of result.replacements) {
    assert.equal(item.durability, 100)
    assert.deepEqual(item.consumed, item.recipeCost)
  }
})

test('wheat audit compares hand picking with equipped scythes at every skill level', () => {
  for (const type of ['Hero', 'Villager']) {
    const initial = data.tools.filter(t => t.type === type && t.level === 1)
    assert.deepEqual(
      initial.map(t => t.wheat),
      [2, 3, 4]
    )
    assert.ok(data.tools.filter(t => t.type === type).every(t => t.handWheat === 1))
  }
  assert.equal(data.swings.wheat, 2)
})

test('hero charge rounds base power before armor and adds skill bonus afterwards', () => {
  const axe = data.weapons.find(w => w.id === 'axe_iron')
  assert.equal(axe.power, 5)
  assert.equal(axe.heroCombat.chargeMs, 700)
  assert.equal(axe.heroCombat.chargedPower, 8)
  const hit = axe.scenarios[4].damages.find(d => d.armor === 3)
  assert.equal(hit.chargedDamage, 5 + axe.scenarios[4].bonus)
  assert.equal(hit.chargedCritical, hit.chargedDamage * 2)
})
test('tools and melee weapons share hero charge and defense costs, without charging ranged damage', () => {
  for (const family of ['axe', 'pickaxe', 'hammer', 'scythe', 'sword']) {
    const combat = data.weapons.find(w => w.id === family + '_iron').heroCombat
    assert.equal(combat.canBlock, true)
    assert.equal(combat.strikeEnergy, 2)
    assert.equal(combat.chargedStrikeEnergy, 4)
    assert.equal(combat.blockEnergyPerSecond, 2 / 0.7)
  }
  for (const id of ['unarmed', 'slingshot', 'bow+arrow_bronze']) {
    const weapon = data.weapons.find(w => w.id === id)
    assert.equal(weapon.heroCombat.canBlock, false)
    assert.equal(weapon.heroCombat.chargeMs, null)
    assert.equal(weapon.scenarios[0].damages[0].chargedDamage, null)
  }
})
test('audit reads hero energy overrides rather than hardcoding their default costs', () => {
  const changed = performanceCatalogue(equipment, {
    ...units,
    Hero: { ...units.Hero, energyCosts: { attack: 3, heroPowerCharge: 4, heroDefense: 7, heroWhiff: 1 } },
  })
  const combat = changed.weapons.find(w => w.id === 'axe_iron').heroCombat
  assert.equal(combat.strikeEnergy, 3)
  assert.equal(combat.chargedStrikeEnergy, 7)
  assert.equal(combat.blockEnergyPerSecond, 10)
  assert.equal(changed.whiffEnergy, 1)
})

test('report controls render charged damage and keep ranged charge cells empty', () => {
  const { performanceSections } = require('../tools/economy/performance.cjs')
  const vm = require('node:vm')
  const html = performanceSections(
    { performance: data },
    {
      escape: String,
      format: String,
      table: (_headers, rows) => rows.join(''),
      row: cells => cells.join(''),
    }
  )
  const ids = ['axe_iron', 'bow+arrow_bronze']
  const rows = ids.map(id => ({
    dataset: { weapon: id },
    cells: {},
    querySelector(selector) {
      return (this.cells[selector] ??= {})
    },
  }))
  const controls = Object.fromEntries(
    Object.entries({
      'combat-level': '5',
      'target-armor': '3',
      'weapon-search': '',
      'work-level': '1',
      'worker-type': 'Hero',
    }).map(([id, value]) => [
      id,
      {
        value,
        addEventListener(_event, fn) {
          this.update = fn
        },
      },
    ])
  )
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    Intl,
    document: {
      getElementById: id => controls[id],
      querySelectorAll: selector => (selector === '[data-weapon]' ? rows : []),
    },
  })
  assert.equal(rows[0].cells['[data-stat="chargedDamage"]'].textContent, '7')
  assert.equal(rows[1].cells['[data-stat="chargedDamage"]'].textContent, '—')
  controls['weapon-search'].value = 'axe_iron'
  controls['weapon-search'].update()
  assert.equal(rows[0].hidden, false)
  assert.equal(rows[1].hidden, true)
  assert.match(html, /Cadence et DPS : non mesurés/)
})

test('weapon audit exposes exact contact budgets and recipe-based repair without charging arrows', () => {
  assert.equal(data.weapons.find(w => w.id === 'spear_ceramic').maxUses, 300)
  assert.equal(data.weapons.find(w => w.id === 'dagger_bronze').maxUses, 600)
  assert.equal(data.weapons.find(w => w.id === 'sword_iron').maxUses, 900)
  assert.equal(data.weapons.find(w => w.id === 'slingshot').maxUses, 300)
  for (const weapon of data.weapons.filter(w => w.id.startsWith('bow'))) {
    assert.equal(weapon.maxUses, 600)
    assert.deepEqual(weapon.repairCost, { wood: 3, sinew: 1 })
  }
  assert.equal(data.weapons.find(w => w.id === 'unarmed').maxUses, null)
})
