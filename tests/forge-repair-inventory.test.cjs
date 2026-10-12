const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function element() {
  return {
    children: [],
    dataset: {},
    attributes: {},
    className: '',
    classList: { add() {} },
    style: { setProperty() {} },
    get childElementCount() {
      return this.children.length
    },
    appendChild(child) {
      this.children.push(child)
      return child
    },
    append(...children) {
      this.children.push(...children)
    },
    setAttribute(key, value) {
      this.attributes[key] = value
    },
    getAttribute(key) {
      return this.attributes[key] ?? null
    },
    querySelectorAll(selector) {
      return this.children.flatMap(child => [
        ...(selector.startsWith('.') && child.className?.split(' ').includes(selector.slice(1)) ? [child] : []),
        ...(selector === '[data-equipment-durability]' && child.dataset?.equipmentDurability != null ? [child] : []),
        ...(child.querySelectorAll?.(selector) ?? []),
      ])
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null
    },
  }
}

function fixture(t, resources = { wood: 20, bronzeIngot: 3, leather: 2 }) {
  const before = global.document
  t.after(() => {
    global.document = before
  })
  global.document = { createElement: element }
  const rows = []
  let nearby = true
  let refreshes = 0
  const hero = {
    type: 'Hero',
    inventory: {
      resources,
      equipment: ['sword_bronze~condition:42', 'sword_bronze~condition:42', 'bow', 'arrow_ceramic'],
      activeWeapons: { melee: 'sword_copper~condition:65' },
    },
  }
  const building = { type: 'Forge', isBuilt: true }
  const row = options => {
    rows.push(options)
    const value = element()
    value.className = `inventory-action-row ${options.className ?? ''}`
    value.id = options.id
    return { element: value }
  }
  const { createForgeRepairInventory } = loadTsModule('app/ui/hero-building/HeroForgeInventory.ts', {
    mocks: {
      '../../lib/lang': { t: key => key },
      '../inventory/InventoryItemRows': {
        createInventoryEquipmentRow: (_context, options) => row(options),
        createInventoryResourceRow: row,
      },
      '../hero/heroActionRange': { isHeroInteractionTargetReachable: () => nearby },
      './equipmentStats': { refreshUnitEquipmentStats() {} },
      '../resources/playerResourceTotals': {
        getMissingPlayerResources: (_player, cost, { hero }) =>
          Object.fromEntries(
            Object.entries(cost).filter(([key, amount]) => (hero.inventory.resources[key] ?? 0) < amount)
          ),
        withdrawChestResources: (_player, cost, { hero }) => {
          for (const [key, amount] of Object.entries(cost)) hero.inventory.resources[key] -= amount
          return true
        },
      },
    },
  })
  const options = {
    menu: { context: { player: {}, controls: { heroUnit: hero } }, showMessage() {}, updateTopbar() {} },
    building,
    costParts: cost => [{ resourceCost: { cost, available: hero.inventory.resources } }],
    refresh: () => refreshes++,
  }
  const render = () => {
    rows.length = 0
    return createForgeRepairInventory(options)
  }
  return {
    hero,
    building,
    rows,
    render,
    setNearby: value => {
      nearby = value
    },
    refreshes: () => refreshes,
  }
}

test('forge shows only repair targets, groups worn copies and keeps equipped repairs separate', t => {
  const f = fixture(t)
  const panel = f.render()
  const sword = f.rows.find(row => row.equipment === 'sword_bronze~condition:42')
  assert.equal(sword.count, 2)
  assert.equal(sword.className, 'forge-repairable-item')
  assert.equal(sword.trailingAction.disabled, false)
  assert.equal(
    f.rows.some(row => row.resource || ['bow', 'arrow_ceramic'].includes(row.equipment)),
    false
  )
  assert.ok(f.rows.some(row => row.id === 'forge-weapon-melee'))
  assert.equal(panel.querySelector('.inventory-section-list').children.length, 1)
})

test('missing materials disable repair without graying a damaged item', t => {
  const f = fixture(t, { wood: 20 })
  f.render()
  const sword = f.rows.find(row => row.equipment === 'sword_bronze~condition:42')
  assert.equal(sword.className, 'forge-repairable-item')
  assert.equal(sword.trailingAction.disabled, true)
  assert.deepEqual(sword.metaParts[0].resourceCost.cost, { bronzeIngot: 1, wood: 1, leather: 1 })
  sword.trailingAction.onClick()
  assert.equal(f.hero.inventory.resources.wood, 20)
  assert.equal(f.hero.inventory.equipment[0], 'sword_bronze~condition:42')
})

test('repair changes only one stacked copy, charges once and refreshes the bag', t => {
  const f = fixture(t)
  f.render()
  const action = f.rows.find(row => row.equipment === 'sword_bronze~condition:42').trailingAction
  action.onClick()
  assert.deepEqual(f.hero.inventory.equipment.slice(0, 2), ['sword_bronze', 'sword_bronze~condition:42'])
  assert.deepEqual(f.hero.inventory.resources, { wood: 19, bronzeIngot: 2, leather: 1 })
  assert.equal(f.refreshes(), 1)
  action.onClick()
  assert.deepEqual(f.hero.inventory.resources, { wood: 19, bronzeIngot: 2, leather: 1 })
  f.render()
  assert.equal(
    f.rows.some(row => row.equipment === 'sword_bronze'),
    false
  )
  assert.equal(f.rows.find(row => row.equipment === 'sword_bronze~condition:42').count, 1)
})

test('repair rechecks distance and forge destruction at activation', t => {
  const f = fixture(t)
  f.render()
  const action = f.rows.find(row => row.equipment === 'sword_bronze~condition:42').trailingAction
  f.setNearby(false)
  action.onClick()
  f.setNearby(true)
  f.building.isDestroyed = true
  action.onClick()
  assert.deepEqual(f.hero.inventory.resources, { wood: 20, bronzeIngot: 3, leather: 2 })
  assert.equal(f.hero.inventory.equipment[0], 'sword_bronze~condition:42')
})

test('forge live signature changes when bag or worn equipment changes without a resource change', () => {
  const { getHeroBuildingInteractiveInventorySignature: signature } = loadTsModule(
    'app/ui/hero-building/HeroBuildingInventorySignature.ts'
  )
  const forge = { type: 'Forge' }
  const hero = {
    inventory: { equipment: ['bow'], activeWeapons: { melee: 'sword_copper' }, equipped: { armor: 'armor_leather' } },
  }
  let before = signature(forge, hero)
  for (const change of [
    () => hero.inventory.equipment.push('sword_bronze~condition:42'),
    () => {
      hero.inventory.activeWeapons.melee = 'sword_copper~condition:65'
    },
    () => {
      hero.inventory.equipped.armor = 'armor_leather~condition:30'
    },
  ]) {
    change()
    const after = signature(forge, hero)
    assert.notEqual(after, before)
    before = after
  }
})

test('forge shows an empty message when no equipment needs repair', t => {
  const f = fixture(t)
  f.hero.inventory.equipment = ['bow', 'arrow_ceramic']
  f.hero.inventory.activeWeapons = { melee: 'sword_copper' }
  const panel = f.render()
  assert.equal(f.rows.length, 0)
  assert.equal(panel.querySelector('.inventory-transfer-empty').textContent, 'forgeRepairNothing')
})
