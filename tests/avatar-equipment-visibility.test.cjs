const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('body and head portraits hide hair under a helmet and restore it when unequipped', t => {
  const previousDocument = global.document
  t.after(() => {
    global.document = previousDocument
  })
  const drawn = []
  global.document = {
    createElement: () => ({ getContext: () => ({ drawImage: texture => drawn.push(texture.id) }) }),
  }
  const texture = id => ({ id, width: 64, height: 64, frame: { x: 0, y: 0 } })
  const sheets = new Map(['hair-back', 'hair-front', 'helmet'].map(id => [id, { textures: [texture(id)] }]))
  const api = loadTsModule('app/lib/avatar.ts', {
    mocks: {
      'pixi.js': { Assets: { cache: sheets } },
      './graphics/avatarCrop': { extractSquareCanvasAvatar: () => true },
      './extra': { getAnimationFrames: textures => textures },
      './graphics/assets': {},
      './graphics/colors': { recolorCanvasByPalette() {}, SOURCE_COLORS: [] },
      './graphics/textures': {},
      './lpc/baked': {},
      './equipment/forgeUpgrades': {},
      './resources/miningEquipment': {},
      './units/unitExperience': { getUnitEquipmentTier: () => 0 },
      './graphics/equipmentAvatar': {},
    },
  })
  const hair = (id, zIndex) => ({ walkingSheet: id, zIndex, hideWhenEquippedSlots: ['helmet'] })
  const hairLayers = [hair('hair-back', 9), hair('hair-front', 11)]
  const hero = {
    standingSheet: { textures: [texture('body')] },
    inventory: { equipped: {} },
    appearance: { layers: hairLayers },
  }
  const app = { renderer: { extract: { canvas: texture => texture } } }
  for (const render of [api.renderUnitBodyAvatar, api.renderUnitHeadAvatar]) {
    for (const equipped of [false, true, false]) {
      hero.inventory.equipped = equipped ? { helmet: 'helmet' } : {}
      hero.appearance.layers = equipped ? [...hairLayers, { walkingSheet: 'helmet', zIndex: 12 }] : hairLayers
      drawn.length = 0
      assert.equal(render(app, hero, {}), true)
      assert.deepEqual(drawn, equipped ? ['body', 'helmet'] : ['hair-back', 'body', 'hair-front'])
    }
  }
})
