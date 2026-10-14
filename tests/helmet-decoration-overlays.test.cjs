const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { getInventoryEquipmentImagePath, renderInventoryEquipmentImage } = loadTsModule(
  'app/ui/inventory/InventoryItemIcons.ts',
  {
    mocks: {
      '../../constants': { RESOURCE_ICON_IDS: {} },
      '../../lib': { getIconPath: () => '' },
      '../../lib/avatar': { renderBuildingAvatar: () => false },
      '../equipment/EquipmentAvatar': { renderEquipmentAvatarLazy: () => {} },
    },
  }
)

const decorations = [
  'centurion_crest', 'legion_plumage', 'plumage',
  'helmet_wings', 'upward_horns_white', 'horns_short',
]

test('six transparent decoration images are shared by every helmet material', () => {
  const iconDirectory = path.join(__dirname, '../public/assets/icons/helmet-decorations')
  assert.deepEqual(fs.readdirSync(iconDirectory).sort(), decorations.map(key => `${key}.png`).sort())
  for (const helmet of ['helmet_legion_bronze', 'helmet_legion_iron', 'helmet_pointed_leather']) {
    for (const decoration of decorations) {
      assert.equal(
        getInventoryEquipmentImagePath(`${helmet}~decor:${decoration}`),
        `assets/icons/armor/${helmet}.png`
      )
    }
  }
})

test('the inventory draws the white ornament over its helmet, with the crest behind', () => {
  const originalImage = global.Image
  const sources = []
  class ReadyImage {
    complete = true
    naturalWidth = 128
    naturalHeight = 128
    set src(value) { this._src = value; sources.push(value) }
    get src() { return this._src }
  }
  global.Image = ReadyImage
  try {
    const draws = []
    const canvas = {
      width: 64,
      height: 64,
      dataset: {},
      getContext: () => ({ clearRect() {}, drawImage: (image, ...args) => draws.push({ src: image.src, args }) }),
    }
    assert.equal(renderInventoryEquipmentImage(canvas, 'helmet_legion_iron~decor:helmet_wings~condition:40'), true)
    assert.deepEqual(draws.map(draw => draw.src), [
      'assets/icons/armor/helmet_legion_iron.png',
      'assets/icons/helmet-decorations/helmet_wings.png',
      'assets/icons/helmet-decorations/helmet_wings.png',
    ])
    assert.equal(draws[1].args[4], 5)
    assert.equal(draws[2].args[4], 27)
    draws.length = 0
    assert.equal(renderInventoryEquipmentImage(canvas, 'helmet_pointed_leather~decor:centurion_crest'), true)
    assert.deepEqual(draws.map(draw => draw.src), [
      'assets/icons/helmet-decorations/centurion_crest.png',
      'assets/icons/armor/helmet_pointed_leather.png',
    ])
    for (const decor of ['upward_horns_white', 'horns_short']) {
      draws.length = 0
      assert.equal(renderInventoryEquipmentImage(canvas, `helmet_pointed_leather~decor:${decor}`), true)
      assert.deepEqual(draws.map(draw => draw.src), [
        `assets/icons/helmet-decorations/${decor}.png`,
        `assets/icons/helmet-decorations/${decor}.png`,
        'assets/icons/armor/helmet_pointed_leather.png',
      ])
      assert.equal(draws[0].args[5], decor === 'horns_short' ? 2 : 0)
      assert.equal(draws[1].args[5], decor === 'horns_short' ? 2 : 0)
    }
    assert.ok(sources.every(src => !src.includes('_iron_helmet_wings')))
  } finally {
    global.Image = originalImage
  }
})
