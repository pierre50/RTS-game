const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const definitions = require('../public/assets/data/gameplay/buildings.json')
const placement = {
  ...loadTsModule('app/lib/grid/placement.ts'),
  ...loadTsModule('app/lib/grid/cells.ts'),
}
const reserved = new Set()
const mocks = {
  '../lib/buildings/walls': {},
  '../lib/audio/settings': {},
  '../lib': placement,
  '../../lib': placement,
  '../lib/buildings/passageCells': { createReservedPassageCellLookup: () => reserved },
  '../../lib/buildings/passageCells': { createReservedPassageCellLookup: () => reserved },
}
const { BuildingPlacementRules } = loadTsModule('app/controllers/BuildingPlacementRules.ts', { mocks })
const { buyPlayerBuilding } = loadTsModule('app/classes/players/PlayerBuildingPlacement.ts', { mocks })
const { getInventoryConstructionButtons } = loadTsModule('app/ui/InventoryConstruction.ts', {
  mocks: {
    './ActionDetailsFactory': {},
    '../lib/avatar': {},
    '../lib/audio/settings': {},
    './inventory/InventoryActionRow': {},
  },
})

function fixture() {
  reserved.clear()
  const id = 'interior:house'
  const grid = Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) => ({
      i,
      j,
      z: 0,
      spaceId: id,
      visible: true,
      category: 'Dirt',
      border: i === 0 || j === 0 || i === 4 || j === 4,
      solid: false,
      has: null,
      terrainHidden: false,
    }))
  )
  const space = { id, kind: 'interior', grid, size: 4 }
  const map = { grid: [], spaces: new Map([[id, space]]), activeSpaceId: id }
  const player = {
    age: 0,
    isPlayed: true,
    config: { buildings: definitions },
    buildings: [],
    isBuildingEligible: () => true,
    spawnBuilding(building) {
      this.buildings.push(building)
    },
  }
  const controls = {
    heroUnit: { i: 2, j: 2, spaceId: id, isChief: true },
    isHeroControlActive: () => true,
  }
  const menu = { updateTopbar() {}, getActionBuildingButton: type => ({ id: type }) }
  const context = { map, player, controls, menu }
  player.context = controls.context = menu.context = context
  return { grid, space, player, controls, menu, rules: new BuildingPlacementRules(controls) }
}

for (const type of loadTsModule('app/lib/buildings/furniture/interiorFurnitureCatalog.ts').INTERIOR_FURNITURE_TYPES) {
  if (type === 'CampBedroll') continue
  test(`${type} preview and purchase require clearance from interior edges and corners`, () => {
    const { grid, player, controls, rules } = fixture()
    controls.heroUnit.i = controls.heroUnit.j = 4
    controls.mouseBuilding = { ...definitions[type], type }
    for (const [i, j] of [
      [0, 0],
      [0, 2],
      [0, 4],
      [2, 0],
      [2, 4],
      [4, 0],
      [4, 2],
      [4, 4],
    ]) {
      assert.equal(rules.canPlaceMouseBuilding(grid[i][j]), false, `${i},${j}`)
      assert.equal(buyPlayerBuilding(player, i, j, type, { spaceId: grid[i][j].spaceId }), false)
    }
    assert.equal(player.buildings.length, 0)
    assert.equal(rules.canPlaceMouseBuilding(grid[1][1]), true)
    assert.equal(buyPlayerBuilding(player, 1, 1, type, { spaceId: grid[1][1].spaceId }), true)
    assert.equal(player.buildings.at(-1).spaceId, grid[1][1].spaceId)
  })
}

test('bed fits against the front floor edge while its rear still cannot enter a wall', () => {
  for (const placementMirrored of [false, true]) {
    const { grid, player, controls, rules } = fixture()
    controls.heroUnit.i = controls.heroUnit.j = 0
    controls.mouseBuilding = { ...definitions.CampBedroll, type: 'CampBedroll', placementMirrored }
    const cell = grid[4][4]
    assert.equal(rules.canPlaceMouseBuilding(cell), true)
    assert.equal(buyPlayerBuilding(player, 4, 4, 'CampBedroll', { spaceId: cell.spaceId, placementMirrored }), true)
    assert.equal(player.buildings.length, 1)
    for (const [i, j] of [
      [3, 3],
      [3, 4],
      [4, 3],
    ]) {
      grid[i][j].solid = true
      assert.equal(rules.canPlaceMouseBuilding(cell), false)
      assert.equal(buyPlayerBuilding(player, 4, 4, 'CampBedroll', { spaceId: cell.spaceId, placementMirrored }), false)
      grid[i][j].solid = false
    }
    // The hero must be checked against the same rear cells as placement.
    controls.heroUnit.i = controls.heroUnit.j = 3
    assert.equal(rules.canPlaceMouseBuilding(cell), false)
  }
})

test('interior border placement still rejects obstacles, hidden floor, water, slopes and passages', () => {
  const { grid, player, controls, rules } = fixture()
  controls.mouseBuilding = { ...definitions.Chest, type: 'Chest' }
  const cell = grid[1][1]
  assert.equal(rules.canPlaceMouseBuilding(cell), true)
  for (const patch of [
    { solid: true },
    { has: {} },
    { terrainHidden: true },
    { category: 'Water' },
    { inclined: true },
  ]) {
    const before = { ...cell }
    Object.assign(cell, patch)
    assert.equal(rules.canPlaceMouseBuilding(cell), false)
    assert.equal(buyPlayerBuilding(player, cell.i, cell.j, 'Chest', { spaceId: cell.spaceId }), false)
    Object.assign(cell, before)
  }
  reserved.add(cell)
  assert.equal(rules.canPlaceMouseBuilding(cell), false)
  assert.equal(buyPlayerBuilding(player, cell.i, cell.j, 'Chest', { spaceId: cell.spaceId }), false)
})

test('outside camp placement retains border and clearance restrictions', () => {
  const { grid, space, player, controls, rules } = fixture()
  space.kind = 'outside'
  controls.mouseBuilding = { ...definitions.Chest, type: 'Chest' }
  for (const cell of [grid[0][2], grid[3][3]]) {
    assert.equal(rules.canPlaceMouseBuilding(cell), false)
    assert.equal(buyPlayerBuilding(player, cell.i, cell.j, 'Chest', { spaceId: cell.spaceId }), false)
  }
})

test('construction menu exposes only furniture inside and restores buildings outside', () => {
  const { menu, controls } = fixture()
  assert.deepEqual(
    getInventoryConstructionButtons(menu)
      .map(button => button.id)
      .sort(),
    [...loadTsModule('app/lib/buildings/furniture/interiorFurnitureCatalog.ts').INTERIOR_FURNITURE_TYPES].sort()
  )
  controls.heroUnit.spaceId = 'outside'
  const outside = getInventoryConstructionButtons(menu).map(button => button.id)
  assert.ok(outside.includes('House'))
  assert.ok(outside.includes('TownCenter'))
  assert.ok(outside.includes('Chest'))
  assert.ok(outside.includes('Trap'))
  assert.ok(!outside.includes('Cave'))
})

for (const type of ['CampTable', 'CampChair', 'CampTorchStand', 'CampRug']) {
  test(`${type} can be previewed and saved in a building or cave`, () => {
    const { grid, player, controls, rules } = fixture()
    controls.mouseBuilding = { ...definitions[type], type }
    assert.equal(rules.canPlaceMouseBuilding(grid[1][1]), true)
    assert.equal(buyPlayerBuilding(player, 1, 1, type, { spaceId: grid[1][1].spaceId, placementMirrored: true }), true)
    assert.equal(player.buildings[0].placementMirrored, true)
    assert.equal(player.buildings[0].spaceId, 'interior:house')
    assert.equal(player.buildings[0].assetType, type)
  })
}

test('preview and purchase reject furniture that seals a corridor or a doorway', () => {
  const { grid, space, player, controls, rules } = fixture()
  controls.mouseBuilding = { ...definitions.CampTable, type: 'CampTable' }
  for (const row of grid) for (const cell of row) cell.solid = cell.j !== 1
  const cell = grid[2][1]
  assert.equal(rules.canPlaceMouseBuilding(cell), false)
  assert.equal(buyPlayerBuilding(player, 2, 1, 'CampTable', { spaceId: space.id }), false)
  for (const row of grid) for (const cell of row) cell.solid = false
  space.exitCell = grid[0][1]
  assert.equal(rules.canPlaceMouseBuilding(grid[1][1]), false)
  assert.equal(buyPlayerBuilding(player, 1, 1, 'CampTable', { spaceId: space.id }), false)
})

for (const type of ['House', 'Trap']) {
  test(`${type} cannot be constructed inside a building or cave`, () => {
    const { grid, space, player, controls, rules } = fixture()
    controls.mouseBuilding = { ...definitions[type], type, size: 1 }
    assert.equal(rules.canPlaceMouseBuilding(grid[1][1]), false)
    assert.equal(buyPlayerBuilding(player, 1, 1, type, { spaceId: space.id }), false)
    assert.equal(player.buildings.length, 0)
  })
}

test('interior construction lists furniture sections only and starts placement', () => {
  const previousDocument = global.document
  class Element {
    constructor() {
      this.children = []
      this.attributes = {}
    }
    appendChild(child) {
      this.children.push(child)
      return child
    }
    setAttribute(key, value) {
      this.attributes[key] = value
    }
    set textContent(value) {
      this.text = value
      this.children = []
    }
  }
  const rows = []
  global.document = { createElement: () => new Element() }
  try {
    const { renderInventoryConstruction } = loadTsModule('app/ui/InventoryConstruction.ts', {
      mocks: {
        '../lib/lang': { t: key => key, getLang: () => 'fr' },
        '../lib/avatar': { renderBuildingAvatar: () => false },
        '../lib/audio/settings': { getReservedGameplayHotkeys: () => [] },
        './inventory/InventoryCostMeta': { inventoryDeliveryMetaParts: () => [] },
        './inventory/InventorySection': {
          createInventorySection: ({ presentation, renderItems }) => {
            assert.equal(presentation, 'recipes')
            const section = new Element()
            section.className = 'inventory-section'
            const list = new Element()
            renderItems(list)
            section.appendChild(list)
            return section
          },
        },
        './inventory/InventoryActionRow': {
          createInventoryActionRow: row => {
            rows.push(row)
            return { element: new Element(), icon: new Element() }
          },
        },
      },
    })
    const { menu, controls } = fixture()
    const hotkeys = new Map()
    controls.mouse = { x: 0, y: 0 }
    menu.context.gamebox = {
      getBoundingClientRect: () => ({ left: 80, top: 40, width: 1000, height: 600 }),
    }
    menu.clearActionHotkeys = () => {}
    menu.assignActionHotkey = id => id
    menu.setActionHotkey = (key, action) => hotkeys.set(key, action)
    let previewPointer
    menu.getActionBuildingButton = type => ({
      id: type,
      onClick: () => {
        previewPointer = { ...controls.mouse }
        controls.mouseBuilding = { type }
      },
    })
    let closed = false
    const host = {
      menu,
      constructionPanel: new Element(),
      close: () => {
        closed = true
      },
    }
    renderInventoryConstruction(host)
    const ids = rows.map(row => row.id)
    assert.deepEqual(
      [...ids].sort(),
      getInventoryConstructionButtons(menu)
        .map(button => button.id)
        .sort()
    )
    assert.equal(new Set(ids).size, ids.length, 'every item appears in a single section')
    assert.ok(!ids.includes('House'))
    assert.ok(!ids.includes('Trap'))
    assert.ok(rows.every(row => row.metaParts[0].constructionSite))
    const sections = host.constructionPanel.children.filter(child => child.className === 'inventory-section')
    assert.ok(sections.length > 1)
    rows.find(row => row.id === 'CampTable').trailingAction.onClick({})
    assert.equal(controls.mouseBuilding.type, 'CampTable')
    assert.equal(closed, true)
    const place = rows.find(row => row.id === 'CampTable').trailingAction.onClick
    place({ detail: 0 })
    assert.deepEqual(previewPointer, { x: 580, y: 340 }, 'center before creating the keyboard preview')
    controls.mouse = { x: 200, y: 150 }
    place({ detail: 1 })
    assert.deepEqual(previewPointer, { x: 200, y: 150 }, 'mouse placement retains the pointer position')
    controls.mouse = { x: 0, y: 0 }
    closed = false
    hotkeys.get('CampTable')()
    assert.deepEqual(previewPointer, { x: 580, y: 340 }, 'construction shortcuts also center the preview')
    assert.equal(closed, true)
  } finally {
    global.document = previousDocument
  }
})

test('right construction menu updates the duration description when switching building levels', () => {
  const previousDocument = global.document
  class Element {
    constructor() {
      this.childNodes = []
      this.attributes = {}
    }
    appendChild(child) {
      this.childNodes.push(child)
      return child
    }
    replaceChildren(...children) {
      this.childNodes = children
    }
    setAttribute(key, value) {
      this.attributes[key] = value
    }
    getAttribute(key) {
      return this.attributes[key]
    }
  }
  global.document = { createElement: () => new Element() }
  const rows = []
  let variant
  try {
    const { renderInventoryConstruction } = loadTsModule('app/ui/InventoryConstruction.ts', {
      mocks: {
        '../lib/avatar': { renderBuildingAvatar: () => false },
        '../lib/audio/settings': { getReservedGameplayHotkeys: () => [] },
        '../lib/ui/VariantRow': {
          attachVariantRow: (_row, options) => {
            variant = options
          },
        },
        './inventory/InventorySection': {
          createInventorySection: ({ renderItems }) => {
            const list = new Element()
            renderItems(list)
            return list
          },
        },
        './inventory/InventoryActionRow': {
          createInventoryActionRow: options => {
            rows.push(options)
            return { element: new Element(), icon: new Element() }
          },
        },
      },
    })
    const { menu, controls, player } = fixture()
    controls.heroUnit.spaceId = 'outside'
    player.config.buildings = { House: definitions.House }
    menu.clearActionHotkeys = () => {}
    menu.assignActionHotkey = () => null
    menu.setActionHotkey = () => {}
    menu.getActionBuildingButton = type => ({ id: type, details: { title: 'Maison', description: 'Un abri.' } })
    renderInventoryConstruction({ menu, constructionPanel: new Element(), close() {} })
    assert.equal(rows[0].description, 'Un abri.')
    assert.equal(rows[0].metaParts[0].constructionSite.level, 0)
    assert.equal(
      rows[0].metaParts[0].constructionSite.config.constructionWorkRequired,
      definitions.House.constructionWorkRequired
    )
    variant.onChange(1)
    assert.equal(rows[1].metaParts[0].constructionSite.level, 1)
    assert.equal(
      rows[1].metaParts[0].constructionSite.config.constructionWorkRequired,
      definitions.House.levelStats[1].constructionWorkRequired
    )
    variant.onChange(2)
    assert.equal(rows[2].metaParts[0].constructionSite.level, 2)
    assert.deepEqual(rows[2].metaParts[0].constructionSite.cost, definitions.House.levelStats[2].cost)
  } finally {
    global.document = previousDocument
  }
})
