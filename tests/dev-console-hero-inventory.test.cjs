const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadHeroInventoryAction() {
  const filename = path.join(__dirname, '../app/dev-console/actions/heroInventory.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  const module = { exports: {} }
  const localRequire = request => {
    if (request === '../../constants') return { UNIT_TYPES: { hero: 'Hero' } }
    if (request === '../../lib/equipmentLoot') {
      return {
        getEquipmentSlot: item =>
          item.startsWith('helmet_') ||
          item.startsWith('armor_') ||
          item.startsWith('shoulder_') ||
          item.startsWith('leg_') ||
          item.includes('shield') ||
          item.startsWith('arrow_')
            ? 'gear'
            : null,
        getWeaponSlot: item => (['sword_ceramic', 'bow', 'lasso'].includes(item) ? 'weapon' : null),
      }
    }
    if (request === '../../lib/lpc/equipment') {
      return {
        DYNAMIC_EQUIPMENT_KEYS: [
          'sword_ceramic',
          'longsword',
          'bow',
          'arrow_copper',
          'helmet_barbarian_ceramic',
          'armor_leather',
          'shoulder_legion_ceramic',
          'leg_armor_ceramic',
          'meat',
          'round_shield_ceramic_slash',
          'quiver',
        ],
      }
    }
    if (request === './shared') {
      return {
        findKey: (object, query) =>
          Object.keys(object || {}).find(key => key.toLowerCase() === String(query).toLowerCase()),
      }
    }
    throw new Error(`Unexpected require: ${request}`)
  }

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('hero inventory dev command fills the hero bag with assignable equipment only', () => {
  const { addAllHeroInventoryEquipment } = loadHeroInventoryAction()
  let inventoryRefreshes = 0
  const hero = {
    controlMode: 'hero',
    inventory: {
      equipment: ['bow'],
      equipped: { helmet: 'helmet_barbarian_ceramic' },
      activeWeapons: {},
    },
  }
  const result = addAllHeroInventoryEquipment({
    controls: { heroUnit: hero },
    player: { units: [hero] },
    menu: {
      refreshInventory: () => inventoryRefreshes++,
      updateActionTarget: () => {},
    },
  })

  assert.deepEqual(result, { ok: true, message: 'Added 9 hero inventory items' })
  assert.deepEqual(hero.inventory.equipment, [
    'bow',
    'sword_ceramic',
    'bow',
    'arrow_copper',
    'helmet_barbarian_ceramic',
    'armor_leather',
    'shoulder_legion_ceramic',
    'leg_armor_ceramic',
    'round_shield_ceramic_slash',
    'lasso',
  ])
  assert.equal(inventoryRefreshes, 1)
})

test('hero inventory dev command can add one requested item', () => {
  const { addHeroInventoryEquipment } = loadHeroInventoryAction()
  const hero = { controlMode: 'hero' }
  const context = {
    controls: { heroUnit: hero },
    player: { units: [hero] },
    menu: {
      refreshInventory: () => {},
      updateActionTarget: () => {},
    },
  }

  assert.deepEqual(addHeroInventoryEquipment(context, 'SWORD_CERAMIC'), {
    ok: true,
    message: 'Added sword_ceramic to hero inventory',
  })
  assert.deepEqual(hero.inventory.equipment, ['sword_ceramic'])

  assert.deepEqual(addHeroInventoryEquipment(context, 'sword_ceramic'), {
    ok: true,
    message: 'Added sword_ceramic to hero inventory',
  })
  assert.deepEqual(hero.inventory.equipment, ['sword_ceramic', 'sword_ceramic'])

  assert.deepEqual(addHeroInventoryEquipment(context, 'not_real'), {
    ok: false,
    message: 'Unknown hero inventory item: not_real',
  })
})

test('hero inventory dev command can add a requested quantity', () => {
  const { addHeroInventoryEquipment } = loadHeroInventoryAction()
  const hero = { controlMode: 'hero' }
  const context = {
    controls: { heroUnit: hero },
    player: { units: [hero] },
    menu: {
      refreshInventory: () => {},
      updateActionTarget: () => {},
    },
  }

  assert.deepEqual(addHeroInventoryEquipment(context, 'arrow_copper', '20'), {
    ok: true,
    message: 'Added 20 arrow_copper to hero inventory',
  })
  assert.equal(hero.inventory.equipment.length, 20)
  assert.equal(
    hero.inventory.equipment.every(item => item === 'arrow_copper'),
    true
  )

  assert.deepEqual(addHeroInventoryEquipment(context, 'arrow_copper', '0'), {
    ok: false,
    message: 'Quantity must be a positive integer: 0',
  })
})
