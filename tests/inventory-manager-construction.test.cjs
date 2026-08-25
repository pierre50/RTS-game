const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadInventoryManager() {
  const filename = path.join(__dirname, '../app/ui/InventoryManager.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../lib': { Modal: class {} },
    '../lib/avatar': {},
    '../lib/equipmentLoot': {},
    '../lib/lang': { t: key => key },
    '../lib/uiSound': { playUiSound() {} },
    '../constants': {
      BUILDING_TYPES: { banditCamp: 'BanditCamp' },
      SOUND_CUES: { ui: { menuClick: 'menuClick' } },
    },
    './EntityInfoModalManager': {},
    '../lib/heroTools': {
      EQUIPPED_ITEM_WEAPON: {},
      HERO_TOOL_ORDER: [],
      getEquippedItemWeapon: () => null,
      isHeroToolAvailable: () => false,
    },
    '../lib/settings': { getReservedGameplayHotkeys: () => [] },
    './Tabs': { ModalTabs: class {} },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('hero construction tab hides internal bandit camp decoration buildings', () => {
  const { isHeroConstructionBuildingType } = loadInventoryManager()

  assert.equal(isHeroConstructionBuildingType('House'), true)
  assert.equal(isHeroConstructionBuildingType('Farm'), true)
  assert.equal(isHeroConstructionBuildingType('BanditCamp'), false)
  assert.equal(isHeroConstructionBuildingType('BanditCampDecoration'), false)
  assert.equal(isHeroConstructionBuildingType('BanditCampTotemSkull'), false)
})
