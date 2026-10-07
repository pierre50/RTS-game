const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const variants = loadTsModule('app/lib/equipment/helmetVariants.ts')
const slots = loadTsModule('app/lib/equipment/equipmentSlots.ts')
const helmet = 'helmet_barbarian_ceramic'
const horns = `${helmet}~decor:upward_horns_ceramic`
const wings = `${helmet}~decor:helmet_wings`
const loot = loadTsModule('app/lib/equipment/equipmentLoot.ts', {
  mocks: {
    './equipmentStats': { getUnitEquipment: () => [helmet, 'upward_horns_ceramic'], refreshUnitEquipmentStats() {} },
    '../units/unitExperience': { getUnitEquipmentTier: () => 0 },
    '../lpc': { refreshBakedLpcUnitAssets() {} },
  },
})

test('corpse loot, pickup, equip, swap and unequip keep a decorated helmet indivisible', () => {
  const corpse = {
    isDead: true,
    type: 'BanditSword',
    equipment: [helmet, 'upward_horns_ceramic'],
    owner: { config: { units: {} } },
  }
  const hero = { inventory: { equipment: [wings] } }
  assert.deepEqual(loot.getUnitCorpseLootEquipment(corpse), [horns])
  assert.equal(loot.pickupCorpseEquipment(corpse, hero, 'upward_horns_ceramic'), false)
  assert.equal(loot.pickupCorpseEquipment(corpse, hero, horns), true)
  assert.deepEqual(corpse.lootEquipment, [])
  assert.deepEqual(corpse.equipment, [])
  assert.equal(loot.equipHeroInventoryItem(hero, horns), true)
  assert.deepEqual(hero.inventory.equipped, { helmet: horns })
  assert.equal(loot.equipHeroInventoryItem(hero, wings), true)
  assert.deepEqual(hero.inventory.equipment, [horns])
  assert.equal(loot.unequipHeroInventorySlot(hero, 'helmet'), true)
  assert.deepEqual(hero.inventory.equipment, [horns, wings])
  assert.deepEqual(JSON.parse(JSON.stringify(hero)).inventory.equipment, [horns, wings])
})

test('variant identity controls stacks and names; equipment panel has no decoration slot', () => {
  assert.deepEqual(loot.getEquipmentStacks([helmet, horns, wings, horns]), [
    { equipment: helmet, count: 1 },
    { equipment: horns, count: 2 },
    { equipment: wings, count: 1 },
  ])
  assert.equal(slots.getEquipmentSlot(horns), 'helmet')
  assert.notEqual(slots.formatEquipmentLootLabel(horns), slots.formatEquipmentLootLabel(wings))
  assert.equal(slots.formatEquipmentLootLabel(horns).includes('~'), false)
  assert.equal(slots.HERO_EQUIPMENT_SLOTS.includes('helmetDecor'), false)
  assert.deepEqual(variants.equipmentVisualParts(horns), [helmet, 'upward_horns_ceramic'])
})

test('legacy equipped and bag items migrate once without losing unmatched ornaments', () => {
  const inventory = {
    equipped: { helmet, helmetDecor: 'helmet_wings' },
    equippedCounts: { helmet: 1, helmetDecor: 1 },
    equipment: [helmet, 'upward_horns_ceramic'],
  }
  variants.migrateHelmetInventory(inventory)
  assert.deepEqual(inventory, { equipped: { helmet: wings }, equippedCounts: { helmet: 1 }, equipment: [horns] })
  variants.migrateHelmetInventory(inventory)
  assert.deepEqual(inventory.equipment, [horns])
  assert.deepEqual(variants.bundleHelmetDecorations(['plumage']), ['plumage'])
})

test('lazy decorated avatar loads every part before refreshing the composite', async () => {
  const pending = new Map()
  const calls = []
  const { renderEquipmentAvatarLazy } = loadTsModule('app/ui/equipment/EquipmentAvatar.ts', {
    mocks: {
      '../../lib/avatar': {
        renderEquipmentAvatar: (_, item) => {
          calls.push(item)
          return false
        },
      },
      '../../lib/lpc/equipment': { dynamicEquipmentVisualKey: item => item },
      '../../lib/lpc/lazyEquipmentAssets': {
        loadDynamicEquipmentAssetQueued: item => new Promise(resolve => pending.set(item, resolve)),
      },
    },
  })
  renderEquipmentAvatarLazy({}, horns, { isConnected: true })
  assert.deepEqual([...pending.keys()], [helmet, 'upward_horns_ceramic'])
  pending.get(helmet)()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls.length, 1)
  pending.get('upward_horns_ceramic')()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls, [horns, horns])
})

test('avatar composites helmet and ornament at their original positions before cropping', () => {
  const previousDocument = global.document
  const draws = []
  global.document = {
    createElement: () => {
      const canvas = {
        width: 64,
        height: 64,
        getContext: () => ({
          clearRect() {},
          drawImage: (...args) => draws.push({ canvas, args }),
          getImageData: () => ({ data: new Uint8ClampedArray(64 * 64 * 4).fill(255) }),
        }),
      }
      return canvas
    },
  }
  try {
    const textures = new Map([
      [`equipments/${helmet}/front/walking`, { id: 'helmet-front', width: 64, height: 64 }],
      ['equipments/upward_horns_ceramic/back/walking', { id: 'horns-back', width: 64, height: 64 }],
      ['equipments/upward_horns_ceramic/front/walking', { id: 'horns-front', width: 64, height: 64 }],
    ])
    const { renderEquipmentAvatar } = loadTsModule('app/lib/graphics/equipmentAvatar.ts', {
      mocks: {
        'pixi.js': {
          Assets: { cache: { has: id => textures.has(id), get: id => ({ textures: [textures.get(id)] }) } },
          Rectangle: class {
            constructor(x, y, width, height) {
              Object.assign(this, { x, y, width, height })
            }
          },
        },
        '../entities/spriteFrameSelection': { getAnimationFrames: frames => frames },
        '../lpc/equipment': { dynamicEquipmentVisualKey: item => item },
      },
    })
    const output = global.document.createElement('canvas')
    assert.equal(
      renderEquipmentAvatar({ renderer: { extract: { canvas: texture => texture.id } } }, horns, output),
      true
    )
    assert.deepEqual(
      draws.filter(draw => typeof draw.args[0] === 'string').map(draw => draw.args),
      [
        ['horns-back', 0, 0],
        ['helmet-front', 0, 0],
        ['horns-front', 0, 0],
      ]
    )
  } finally {
    global.document = previousDocument
  }
})

test('equipped and corpse variants expand into both appearance layers', () => {
  const received = []
  const { refreshBakedLpcUnitAssets } = loadTsModule('app/lib/lpc/bakedUnitAssets.ts', {
    mocks: {
      'pixi.js': { Assets: { cache: { has: () => true, get: id => ({ id }) } } },
      './equipment': {
        dynamicEquipmentLayersForEquipment: items => {
          received.push(items)
          return []
        },
        dynamicEquipmentLayersForUnit: () => [],
        dynamicEquipmentLayersForVillager: () => [],
      },
      './heroAppearance': { heroAppearanceLayersForPlayer: () => [] },
      '../units/unitExperience': { getUnitEquipmentTier: () => 6 },
    },
  })
  const unit = {
    type: 'Hero',
    owner: { civ: 'Kemet' },
    gender: 'male',
    currentSheet: 'standingSheet',
    inventory: { equipped: { helmet: horns } },
  }
  refreshBakedLpcUnitAssets(unit)
  assert.ok(received.some(items => items.includes(helmet) && items.includes('upward_horns_ceramic')))
  received.length = 0
  refreshBakedLpcUnitAssets({ ...unit, isDead: true, lootEquipment: [wings], currentSheet: 'corpseSheet' })
  assert.ok(received.some(items => items.includes(helmet) && items.includes('helmet_wings')))
})
