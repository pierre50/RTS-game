const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadAppearance() {
  return loadTsModule('app/lib/lpc/bakedUnitAssets.ts', {
    mocks: {
      'pixi.js': { Assets: { cache: { has: () => true, get: id => ({ id }) } } },
      './equipment': {
        dynamicEquipmentLayersForEquipment: () => [],
        dynamicEquipmentLayersForUnit: () => [],
        dynamicEquipmentLayersForVillager: () => [],
      },
      './heroAppearance': { heroAppearanceLayersForPlayer: () => [] },
      '../units/unitExperience': { getUnitEquipmentTier: unit => unit.tier ?? 0 },
    },
  })
}

function unitState(extra = {}) {
  return {
    type: 'Villager',
    label: 'worker',
    gender: 'female',
    owner: { civ: 'Kemet' },
    work: 'hunter',
    action: 'hunt',
    currentSheet: 'actionSheet',
    ...extra,
  }
}

test('equipment refresh preserves hunting and harvesting animations and orders', () => {
  const { refreshBakedLpcUnitAssets } = loadAppearance()
  for (const type of ['Villager', 'Hero']) {
    const unit = unitState({ type, dest: { label: 'prey' }, path: [{ i: 3, j: 4 }] })
    const dest = unit.dest
    const path = unit.path
    const root = `units/${type.toLowerCase()}/kemet/female`
    const rendered = []
    unit.setTextures = sheet => rendered.push([sheet, unit.actionSheet.id])
    assert.equal(refreshBakedLpcUnitAssets(unit), true)
    assert.equal(unit.actionSheet.id, `${root}/action/shoot`)
    assert.deepEqual(rendered, [['actionSheet', `${root}/action/shoot`]])
    unit.action = 'takemeat'
    refreshBakedLpcUnitAssets(unit)
    assert.equal(unit.actionSheet.id, `${root}/action/slash`)
    assert.equal(unit.work, 'hunter')
    assert.equal(unit.action, 'takemeat')
    assert.equal(unit.dest, dest)
    assert.equal(unit.path, path)
  }
})

test('role changes discard old work sprites and remain coherent after conversion and reload', () => {
  const { refreshBakedLpcUnitAssets } = loadAppearance()
  for (const type of ['Chief', 'Fantassin', 'Bowman', 'Priest']) {
    const unit = unitState()
    refreshBakedLpcUnitAssets(unit)
    unit.type = type
    unit.work = 'attacker'
    unit.action = 'attack'
    refreshBakedLpcUnitAssets(unit)
    const expected = unit.actionSheet.id
    assert.ok(!expected.includes('/villager/'))
    assert.equal(unit.allAssets.hunter, undefined)
    assert.equal(unit.harvestSheet, undefined)
    const saved = JSON.parse(JSON.stringify(unit))
    saved.owner = { civ: 'Nord' }
    refreshBakedLpcUnitAssets(saved)
    assert.equal(saved.actionSheet.id, expected)
    assert.equal(saved.gender, 'female')
    assert.equal(saved.assetCiv, 'Kemet')
  }
})

test('promoted archers use chief melee sprites rather than nonexistent chief shooting sprites', () => {
  const { refreshBakedLpcUnitAssets } = loadAppearance()
  const unit = unitState({ type: 'Bowman', isChief: true, work: 'attacker', action: 'attack' })
  refreshBakedLpcUnitAssets(unit)
  assert.equal(unit.actionSheet.id, 'units/chief/kemet/female/action')
})

test('helmet changes and corpse looting refresh the actual displayed base sheets', () => {
  const { refreshBakedLpcUnitAssets } = loadAppearance()
  const unit = unitState({ type: 'Fantassin', work: 'attacker', action: 'attack', tier: 6 })
  refreshBakedLpcUnitAssets(unit)
  assert.equal(unit.walkingSheet.id, 'units/infantry_nohair/kemet/female/walking')
  unit.isDead = true
  unit.currentSheet = 'corpseSheet'
  unit.lootEquipment = []
  const rendered = []
  unit.setTextures = sheet => rendered.push(unit[sheet].id)
  refreshBakedLpcUnitAssets(unit)
  assert.deepEqual(rendered, ['units/infantry/kemet/female/corpse'])
})
