const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function makeElement(tag = 'div') {
  return {
    tag,
    alt: '',
    children: [],
    className: '',
    src: '',
    textContent: '',
    append(...children) {
      this.children.push(...children)
    },
    appendChild(child) {
      this.children.push(child)
      return child
    },
    replaceChildren(...children) {
      this.children = children
    },
  }
}

function withFakeDocument(fn) {
  const previousDocument = global.document
  global.document = { createElement: tag => makeElement(tag) }
  try {
    return fn()
  } finally {
    global.document = previousDocument
  }
}

function loadPanel() {
  return loadTsModule('app/ui/minimap/MinimapResourcePanel.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: { chest: 'Chest', stable: 'Stable', storagePit: 'StoragePit', townCenter: 'TownCenter' },
        POPULATION_MAX: 200,
        RESOURCE_NAMES: ['wood', 'food', 'stone', 'gold'],
        RESOURCE_STORAGE_NAMES: ['wood', 'berry', 'meat', 'wheat', 'stone', 'gold'],
        UNIT_TYPES: { hero: 'Hero', villager: 'Villager' },
        WORK_TYPES: {
          attacker: 'attacker',
          builder: 'builder',
          farmer: 'farmer',
          forager: 'forager',
          goldminer: 'goldminer',
          healer: 'healer',
          horseCapture: 'horseCapture',
          hunter: 'hunter',
          stoneminer: 'stoneminer',
          woodcutter: 'woodcutter',
        },
      },
      '../../constants/consumption': {
        DAILY_CONSUMPTION_PER_VILLAGER: { food: 4 },
      },
      '../../lib/horses/stableHorses': {
        STABLE_HORSE_CAPACITY: 5,
        getStableHorseAmount: building => building.stableHorses?.length ?? building.horseAmount ?? 0,
      },
      '../../lib/lang': { t: key => key },
      '../../lib/mapSpaces': {
        getActiveMapSpace: map => map.spaces.get(map.activeSpaceId),
        getEntitySpaceId: entity => entity.spaceId || 'outside',
      },
      '../../lib/units/villagerAutonomyTargeting': {
        getAutonomyJobForWork: work =>
          ({
            farmer: 'food',
            forager: 'food',
            goldminer: 'gold',
            hunter: 'food',
            stoneminer: 'stone',
            woodcutter: 'wood',
          })[work] ?? null,
      },
    },
  })
}

test('minimap resource panel renders only active-map hero and stockpile resources', () => {
  withFakeDocument(() => {
    const { renderMinimapResourcePanel } = loadPanel()
    const container = makeElement()
    const player = { label: 'player', buildings: [], population: 5, populationMax: 12, units: [] }
    const hero = {
      owner: player,
      type: 'Hero',
      spaceId: 'outside',
      inventory: { resources: { wood: 5, berry: 2 } },
    }
    player.units = [
      hero,
      { type: 'Villager', work: 'woodcutter' },
      { type: 'Villager', work: 'farmer' },
      { type: 'Villager', autonomousJob: 'stone', inactif: true, work: 'forager' },
      { type: 'Villager', shelterState: { reason: 'sleep', previousAutonomousJob: 'gold' } },
      { type: 'Villager', isDead: true, work: 'hunter' },
    ]
    player.buildings = [
      {
        owner: player,
        type: 'TownCenter',
        spaceId: 'outside',
        inventory: { resources: { wheat: 7, stone: 3 } },
      },
      {
        owner: player,
        type: 'StoragePit',
        spaceId: 'other-map',
        inventory: { resources: { wood: 99, gold: 99 } },
      },
      {
        owner: player,
        type: 'StoragePit',
        spaceId: 'outside',
        inventory: { resources: { wood: 11, gold: 4 } },
      },
      {
        owner: player,
        type: 'Stable',
        stableHorses: [{}, {}, {}],
        queue: ['Bowman'],
        trainingQueue: [{ type: 'Fantassin' }],
      },
      {
        owner: player,
        type: 'Barracks',
        queue: ['Bowman', 'Fantassin'],
      },
    ]
    const menu = {
      context: {
        controls: { heroUnit: hero },
        map: { activeSpaceId: 'outside', spaces: new Map([['outside', { id: 'outside' }]]) },
        player,
      },
      icons: { wood: 'wood.png', food: 'food.png', stone: 'stone.png', gold: 'gold.png' },
    }

    renderMinimapResourcePanel(container, menu)

    const villagerRows = container.children[0].children[1].children
    assert.deepEqual(
      villagerRows.map(row => [row.children[0].textContent, row.children[1].textContent]),
      [
        ['minimapUnits', '5/12'],
        ['minimapVillagerConsumption', '16 minimapResourceFood'],
        ['minimapResourceFood', '1'],
        ['minimapResourceWood', '1'],
        ['minimapResourceStone', '1'],
        ['minimapResourceGold', '1'],
        ['minimapVillagerUnassigned', '0'],
      ]
    )

    const trainingRows = container.children[1].children[1].children
    assert.deepEqual(
      trainingRows.map(row => [row.children[0].textContent, row.children[1].textContent]),
      [
        ['Bowman', '2'],
        ['Fantassin', '1'],
        ['minimapStableHorses', '3/5'],
      ]
    )

    const rows = container.children[3].children
    assert.deepEqual(
      rows.map(row => [row.children[1].textContent, row.children[2].textContent]),
      [
        ['minimapResourceWood', '16'],
        ['minimapResourceFood', '9'],
        ['minimapResourceStone', '3'],
        ['minimapResourceGold', '4'],
      ]
    )
  })
})

function readStock(menu) {
  const container = makeElement()
  loadPanel().renderMinimapResourcePanel(container, menu)
  return Object.fromEntries(
    container.children[3].children
      .filter(row => row.className === 'minimap-resource-row')
      .map(row => [row.children[1].textContent, Number(row.children[2].textContent)])
  )
}

test('outside stock includes local interior chests once, but excludes foreign and destroyed storage', () => {
  withFakeDocument(() => {
    const player = { label: 'player', units: [], buildings: [] }
    const building = (type, label, spaceId, wood, extra = {}) => ({
      type,
      label,
      spaceId,
      owner: player,
      inventory: { resources: { wood } },
      ...extra,
    })
    const chest = building('Chest', 'chest', 'inside', 25, { visible: false })
    player.buildings = [
      building('TownCenter', 'center', 'outside', 5),
      chest,
      chest,
      building('Chest', 'loose-chest', 'outside', 3),
      building('Chest', 'enemy', 'inside', 100, { owner: { label: 'enemy' } }),
      building('Chest', 'dead-chest', 'inside', 100, { isDestroyed: true }),
      building('TownCenter', 'dead-center', 'outside', 100, { isDead: true }),
      building('Chest', 'orphan', 'dead-room', 100),
      building('TownCenter', 'remote', 'other-map', 100),
      building('Chest', 'remote-chest', 'remote-room', 100),
    ]
    const map = {
      activeSpaceId: 'outside',
      spaces: new Map([
        ['outside', { id: 'outside' }],
        ['inside', { id: 'inside', kind: 'interior', buildingLabel: 'center' }],
        ['dead-room', { id: 'dead-room', kind: 'interior', buildingLabel: 'dead-center' }],
        ['remote-room', { id: 'remote-room', kind: 'interior', buildingLabel: 'remote' }],
      ]),
    }
    const menu = { context: { map, player, controls: {} }, icons: {} }
    assert.deepEqual(readStock(menu), { minimapResourceWood: 33 })
    map.activeSpaceId = 'inside'
    assert.deepEqual(readStock(menu), { minimapResourceWood: 25 })
  })
})

test('starting stock survives the real chest transfer and repeated region save/restores in the panel', () => {
  withFakeDocument(() => {
    const { groupInteriorBuildings } = loadTsModule('app/serialization/InteriorBuildingSave.ts')
    const { ensureInteriorDefaultBuildings } = loadTsModule('engine/services/BuildingInteriorSpaceDecorations.ts', {
      mocks: {
        '../../app/lib/buildings/interiorDecorations': {
          getBuildingInteriorDecorationLayout: () => [{ key: 'storage-chest', type: 'Chest', offsetI: 0, offsetJ: 0 }],
          findInteriorDecorationCell: ({ grid }) => grid[0][0],
          interiorCellKey: cell => `${cell.i}:${cell.j}`,
        },
        '../../app/lib/grid/placement': { canPlaceBuildingAt: () => true },
      },
    })
    const map = {
      grid: [[{}]],
      activeSpaceId: 'outside',
      spaces: new Map([['outside', { id: 'outside' }]]),
      randomItem: items => items[0],
    }
    const context = { map, controls: {} }
    const player = {
      label: 'player',
      buildings: [],
      units: [],
      config: { buildings: { Chest: { size: 1 } } },
      createBuilding(options) {
        const building = { ...options, owner: player, context }
        player.buildings.push(building)
        return building
      },
    }
    context.player = player
    const menu = { context, icons: {} }
    const center = player.createBuilding({
      type: 'TownCenter',
      label: 'center',
      i: 0,
      j: 0,
      inventory: { resources: { wood: 200, wheat: 100, berry: 50, meat: 50, stone: 150 } },
    })
    const expected = { minimapResourceFood: 200, minimapResourceStone: 150, minimapResourceWood: 200 }
    assert.deepEqual(readStock(menu), expected)
    const ensureRoom = (_context, building) => {
      const id = `interior:player:${building.label}`
      const cell = { i: 0, j: 0, category: 'Grass' }
      const space = {
        id,
        kind: 'interior',
        buildingLabel: building.label,
        building,
        grid: [[cell]],
        walkableCells: [cell],
      }
      map.spaces.set(id, space)
      ensureInteriorDefaultBuildings(context, space)
      return space
    }
    ensureRoom(context, center)
    assert.deepEqual(center.inventory.resources, {})
    assert.deepEqual(readStock(menu), expected)
    const { restorePlayerEntitiesFromSave } = loadTsModule('app/classes/map/MapSaveRestore.ts', {
      mocks: {
        '../../../engine/services/BuildingInteriorSpaceSystemRuntime': {
          ensureRuntimeBuildingInteriorSpace: ensureRoom,
        },
      },
    })
    for (let visit = 0; visit < 3; visit++) {
      const buildings = structuredClone(
        groupInteriorBuildings(
          player.buildings.map(building => ({
            type: building.type,
            label: building.label,
            i: building.i,
            j: building.j,
            spaceId: building.spaceId,
            inventory: building.inventory,
          })),
          player.label
        )
      )
      player.buildings = []
      map.spaces = new Map([['outside', { id: 'outside' }]])
      restorePlayerEntitiesFromSave(player, { buildings, units: [], corpses: [] })
      assert.deepEqual(readStock(menu), expected)
      assert.equal(player.wood, 200)
      assert.equal(player.food, 200)
      assert.equal(player.buildings.filter(building => building.type === 'Chest').length, 1)
    }
  })
})
