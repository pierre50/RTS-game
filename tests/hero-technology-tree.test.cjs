const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('technology tree exposes saved tiers, prerequisites and costs, and revalidates research on click', () => {
  const previousDocument = global.document
  const element = () => ({
    children: [],
    append(...nodes) {
      this.children.push(...nodes)
    },
    appendChild(node) {
      this.children.push(node)
    },
  })
  let focused = false
  global.document = {
    createElement: element,
    querySelector: () => ({
      focus() {
        focused = true
      },
    }),
  }
  let reachable = true
  const rows = []
  const { createHeroTechnologyBody } = loadTsModule('app/ui/hero-building/HeroTechnologyBody.ts', {
    mocks: {
      '../../lib/lang': { t: (key, params) => key + (params ? JSON.stringify(params) : '') },
      '../hero/heroActionRange': { isHeroInteractionTargetReachable: () => reachable },
      './equipmentStats': { refreshUnitEquipmentStats() {} },
      [require('node:path').resolve(__dirname, '../app/lib/resources/playerResourceTotals.ts')]: {
        getPlayerResourceTotals: player => player.stock,
        getMissingPlayerResources: (player, cost) =>
          Object.fromEntries(Object.entries(cost).filter(([key, count]) => (player.stock[key] ?? 0) < count)),
        withdrawChestResources: (player, cost) => {
          for (const [key, count] of Object.entries(cost)) player.stock[key] -= count
          return true
        },
      },
      '../inventory/InventoryItemIcons': { createInventoryEquipmentIcon: element },
      '../inventory/InventoryActionRow': {
        createInventoryActionRow: (_, row) => {
          rows.push(row)
          return { element: element(), icon: element() }
        },
      },
    },
  })
  try {
    const player = { forgeUpgrades: { axes: 1 }, stock: { wood: 100, copper: 200, iron: 200 }, units: [] }
    const hero = { type: 'Hero', owner: player, isChief: true }
    const building = { type: 'TownCenter', owner: player, isBuilt: true }
    const menu = { context: { player, controls: { heroUnit: hero } }, showMessage() {}, updateTopbar() {} }
    const render = () => {
      rows.length = 0
      return createHeroTechnologyBody(building, menu, render)
    }
    render()
    const row = (family, tier) => rows.find(item => item.id === `technology-${family}-${tier}`)
    assert.equal(rows.length, 24)
    assert.equal(row('axes', 1).badge, 'technologyAcquired')
    assert.equal(row('axes', 1).trailingAction, undefined)
    assert.equal(row('axes', 2).trailingAction.disabled, false)
    assert.match(row('axes', 3).description, /forgeMaterial_bronze/)
    assert.equal(row('axes', 3).trailingAction.disabled, true)
    assert.ok(row('axes', 2).metaParts.length > 0)
    const buy = row('axes', 2).trailingAction.onClick
    reachable = false
    buy()
    assert.equal(player.forgeUpgrades.axes, 1)
    reachable = true
    buy()
    assert.equal(player.forgeUpgrades.axes, 2)
    assert.equal(player.stock.copper, 176)
    assert.equal(player.stock.wood, 90)
    assert.equal(focused, true)
    buy()
    assert.equal(player.stock.copper, 176, 'stale click does not buy another tier')
    player.stock.iron = 0
    render()
    assert.equal(row('axes', 3).trailingAction.disabled, true)
    assert.match(row('axes', 3).description, /forgeResourcesMissing/)
    assert.equal(row('weapons', 1).trailingAction.disabled, false)
  } finally {
    global.document = previousDocument
  }
})
