const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('leather hood uses separate slash and shooting sheets with matching animation speeds', () => {
  const { dynamicEquipmentAliases, dynamicEquipmentLayersForEquipment } = loadTsModule('app/lib/lpc/equipment.ts')
  const [hood] = dynamicEquipmentLayersForEquipment(['sack_cloth_hood_leather'])
  assert.equal(hood.actionSheet, 'equipments/sack_cloth_hood_leather/front/action')
  assert.equal(hood.shootingSheet, 'equipments/sack_cloth_hood_leather/front/shooting')
  const aliases = dynamicEquipmentAliases()
  assert.equal(aliases.find(alias => alias.alias === hood.actionSheet).animationSpeed, 0.25)
  assert.equal(aliases.find(alias => alias.alias === hood.shootingSheet).animationSpeed, 0.3)

  const atlas = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../public/assets/graphics/equipments/helmet/sack_cloth_hood/texture.json'),
      'utf8'
    )
  )
  const frames = Object.keys(atlas.frames)
  // Three rendered directions, six slash frames and thirteen shooting frames each.
  assert.equal(frames.filter(name => name.endsWith('_front_action.png')).length, 18)
  assert.equal(frames.filter(name => name.endsWith('_front_shooting.png')).length, 39)
  for (const sheet of ['walking', 'dying', 'corpse']) {
    assert.ok(
      frames.some(name => name.endsWith(`_front_${sheet}.png`)),
      `${sheet} remains available`
    )
  }
})
