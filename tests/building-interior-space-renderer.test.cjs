const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadBuildingInteriorSpaceSystem(overrides = {}) {
  class Container {
    constructor() {
      this.children = []
      this.eventMode = null
      this.label = null
      this.renderable = true
      this.sortableChildren = false
      this.visible = true
      this.x = 0
      this.y = 0
      this.position = { set: (x, y) => ((this.x = x), (this.y = y)) }
      this.zIndex = 0
    }

    addChild(...children) {
      this.children.push(...children)
      for (const child of children) child.parent = this
      return children[0]
    }

    removeChild(child) {
      this.children = this.children.filter(candidate => candidate !== child)
      child.parent = null
      return child
    }

    sortChildren() {}

    destroy() {}
  }

  class Graphics extends Container {
    clear() {
      return this
    }

    fill() {
      return this
    }

    rect() {
      return this
    }
  }

  return loadTsModule('app/services/BuildingInteriorSpaceSystem.ts', {
    mocks: {
      'pixi.js': { Container, Graphics },
      '../classes/cell': {
        Cell: class {
          constructor(options) {
            Object.assign(this, options)
            this.category = options.type
            this.corpses = new Set()
            this.has = null
            this.solid = false
            this.visible = true
            this.x = options.i * 32
            this.y = options.j * 16
          }

          place(entity) {
            this.has = entity
            this.solid = true
            entity.currentCell = this
            entity.i = this.i
            entity.j = this.j
            entity.x = this.x
            entity.y = this.y
          }
        },
      },
      '../constants': {
        BUILDING_TYPES: {
          campCrate: 'CampCrate',
          campJarSmall: 'CampJarSmall',
          campRockPile: 'CampRockPile',
          chest: 'Chest',
          fireCamp: 'FireCamp',
          granary: 'Granary',
          house: 'House',
          stable: 'Stable',
          storagePit: 'StoragePit',
          townCenter: 'TownCenter',
        },
        CELL_HEIGHT: 32,
        CELL_WIDTH: 64,
        FAMILY_TYPES: { animal: 'animal', unit: 'unit' },
        LABEL_TYPES: { interiorExit: 'interiorExit' },
        SHEET_TYPES: { standing: 'standing' },
      },
      '../lib/buildings/interiors': {
        getBuildingInteriorEntryCell: () => null,
        getBuildingInteriorPortalId: building => building.label || 'building',
      },
      '../lib/grid/cells': { getCellsAroundPoint: overrides.getCellsAroundPoint ?? (() => []) },
      '../lib/grid/placement': { canPlaceBuildingAt: overrides.canPlaceBuildingAt ?? (() => false) },
      '../lib/grid/visibility': {
        updateInstanceRenderVisibility: overrides.updateInstanceRenderVisibility ?? (() => {}),
        updateInstanceVisibility: overrides.updateInstanceVisibility ?? (() => {}),
      },
      '../lib/mapSpaces': {
        OUTSIDE_SPACE_ID: 'outside',
        ensureMapSpaces: map => (map.spaces ??= new Map()),
        getEntityMapSpace: () => null,
        getEntitySpaceId: entity => entity?.spaceId || 'outside',
        getMapSpace: (map, spaceId = 'outside') => map?.spaces?.get(spaceId || 'outside') ?? null,
        moveEntityToMapSpace: overrides.moveEntityToMapSpace ?? (() => {}),
        sameMapSpace: () => true,
      },
      '../lib/ui/InteractionCellMarker': {
        INTERACTION_CELL_MARKER_PULSE_MS: 1400,
        INTERACTION_CELL_MARKER_Z_INDEX: 100,
        drawInteractionCellMarker: () => {},
        interactionCellPulse: () => 1,
      },
      '../lib/entities/overheadIndicator': {
        clearUnitOverheadIndicator: () => {},
        setUnitOverheadIndicator: () => {},
      },
      './rest/UnitSleepVisuals': {
        setDetachedShadowsVisible: () => {},
        setSleepingOutsideFinalVisual: () => {},
      },
      '../lib/horses/horseTaming': {
        HORSE_TAMING_STATUS: { wild: 'wild', tamed: 'tamed' },
        setHorseTamingStatus: (horse, status) => {
          horse.tamingStatus = status
        },
        shouldHorseFleeFromThreat: horse => horse?.type !== 'Horse' || horse.tamingStatus !== 'tamed',
      },
      '../lib/horses/wildHorseBehavior': {
        spookWildHorse:
          overrides.spookWildHorse ??
          (horse => {
            horse.tamingStatus = 'wild'
            horse.strategy = 'runaway'
            horse.ambientMovement = true
            horse.animalBehavior?.start?.()
          }),
      },
      '../lib/horses/stableHorses': {
        getStableHorses: building => building.stableHorses ?? [],
      },
      './SpacePortalSystem': {
        prepareUnitForSpaceTransfer: overrides.prepareUnitForSpaceTransfer ?? (() => {}),
        routeUnitThroughSpacePortal: () => false,
        transferUnitThroughSpacePortal: () => false,
      },
    },
  })
}

test('runtime building interiors sort floor cells and entities in one scene layer', () => {
  const { BuildingInteriorSpaceRenderer } = loadBuildingInteriorSpaceSystem()
  const context = {
    app: { ticker: { add: () => {}, remove: () => {} } },
    controls: { getViewportMetrics: () => ({ visibleLeft: 0, visibleTop: 0, visibleWidth: 800, visibleHeight: 600 }) },
  }

  const renderer = new BuildingInteriorSpaceRenderer(context, 'interior:test', [], 12)

  assert.deepEqual(
    renderer.children.map(child => child.label),
    ['building-interior-backdrop', 'building-interior-scene']
  )
  assert.deepEqual(
    renderer.sceneLayer.children.map(child => child.label),
    ['building-interior-terrain', 'building-interior-entities']
  )
  assert.equal(renderer.exitMarker.parent, renderer.entityLayer)
  assert.equal(renderer.entityLayer.sortableChildren, true)
  assert.equal(renderer.sceneLayer.sortableChildren, true)
  assert.equal(renderer.terrainLayer.sortableChildren, true)
})

test('runtime stable interiors synchronize stored horses without default decorations', () => {
  const createdBuildings = []
  const createdAnimals = []
  const { ensureBuildingInteriorSpace, syncBuildingStableInteriorHorses } = loadBuildingInteriorSpaceSystem()
  const context = {
    app: { ticker: { add: () => {}, remove: () => {} } },
    controls: {},
    map: {
      addChild: child => {
        child.parent = context.map
        return child
      },
      addToInstanceBucket: () => {},
      gaia: {
        animals: createdAnimals,
        createAnimal(options) {
          const animal = {
            ...options,
            family: 'animal',
            label: `created-${createdAnimals.length}`,
            animalBehavior: { stop: () => {} },
            clear() {
              this.isDestroyed = true
              if (this.currentCell?.has === this) {
                this.currentCell.has = null
                this.currentCell.solid = false
              }
            },
            updateTexture: () => {},
          }
          context.map.spaces.get(options.spaceId).grid[options.i][options.j].place(animal)
          createdAnimals.push(animal)
          return animal
        },
      },
      grid: [[{ i: 0, j: 0 }]],
      random: () => 0,
      randomItem: items => items[0],
      randomRange: min => min,
      removeFromInstanceBucket: () => {},
      spaces: new Map(),
      updateInstanceBucket: () => {},
    },
  }
  const owner = {
    buildings: [],
    createBuilding: options => {
      createdBuildings.push(options)
      return options
    },
    isPlayed: true,
  }
  const building = {
    context,
    family: 'building',
    i: 3,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 4,
    label: 'stable-1',
    owner,
    stableHorses: [{ horseColor: 'dark' }, { horseColor: 'light' }],
    type: 'Stable',
    x: 120,
    y: 160,
  }
  const blueprint = {
    floorMask: [
      [0, 0, 0],
      [0, 1, 1],
      [0, 1, 1],
    ],
    borderMask: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
    exits: [{ i: 2, j: 2 }],
    relief: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
    size: 2,
    terrain: [
      ['Water', 'Water', 'Water'],
      ['Water', 'Dirt', 'Dirt'],
      ['Water', 'Dirt', 'Dirt'],
    ],
  }

  const space = ensureBuildingInteriorSpace(context, building, blueprint)

  assert.deepEqual(createdBuildings, [])
  assert.equal(space.size, 2)
  assert.equal(createdAnimals.length, 2)
  assert.deepEqual(
    createdAnimals.map(horse => ({
      ambientMovement: horse.ambientMovement,
      horseColor: horse.horseColor,
      spaceId: horse.spaceId,
      tamingStatus: horse.tamingStatus,
      type: horse.type,
    })),
    [
      {
        ambientMovement: false,
        horseColor: 'dark',
        spaceId: space.id,
        tamingStatus: 'tamed',
        type: 'Horse',
      },
      {
        ambientMovement: false,
        horseColor: 'light',
        spaceId: space.id,
        tamingStatus: 'tamed',
        type: 'Horse',
      },
    ]
  )
  assert.deepEqual(
    createdAnimals.map(horse => horse.label),
    [`${space.id}:stable-horse:0`, `${space.id}:stable-horse:1`]
  )

  building.stableHorses = [{ horseColor: 'dark' }]
  syncBuildingStableInteriorHorses(context, building)
  assert.equal(createdAnimals[1].isDestroyed, true)

  building.stableHorses = [{ horseColor: 'dark' }, { horseColor: 'gold' }]
  syncBuildingStableInteriorHorses(context, building)
  assert.equal(createdAnimals.length, 3)
  assert.equal(createdAnimals[2].label, `${space.id}:stable-horse:1`)
  assert.equal(createdAnimals[2].horseColor, 'gold')
  assert.equal(createdAnimals[2].tamingStatus, 'tamed')
})

test('runtime storage interiors create an indestructible default chest', () => {
  const createdBuildings = []
  const { ensureBuildingInteriorSpace } = loadBuildingInteriorSpaceSystem({
    canPlaceBuildingAt: () => false,
  })
  const context = {
    app: { ticker: { add: () => {}, remove: () => {} } },
    controls: {},
    map: {
      addChild: child => {
        child.parent = context.map
        return child
      },
      addToInstanceBucket: () => {},
      gaia: { animals: [] },
      grid: [[{ i: 0, j: 0 }]],
      random: () => 0,
      randomItem: items => items[0],
      randomRange: min => min,
      removeFromInstanceBucket: () => {},
      spaces: new Map(),
      updateInstanceBucket: () => {},
    },
  }
  const owner = {
    buildings: [],
    config: {
      buildings: {
        CampBucket: { size: 1 },
        CampDryingRack: { size: 1 },
        Chest: { size: 1 },
      },
    },
    createBuilding(options) {
      createdBuildings.push(options)
      const building = {
        ...options,
        isDestroyed: false,
      }
      this.buildings.push(building)
      return building
    },
    isPlayed: true,
  }
  const building = {
    context,
    family: 'building',
    i: 3,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    inventory: { resources: { food: 25, wood: 5 } },
    j: 4,
    label: 'granary-1',
    owner,
    type: 'Granary',
    x: 120,
    y: 160,
  }
  const blueprint = {
    floorMask: [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 1, 0, 0],
      [1, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ],
    borderMask: [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 1, 0, 0],
      [1, 0, 0, 0, 0, 1, 0],
      [0, 0, 1, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ],
    exits: [{ i: 3, j: 5 }],
    relief: [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ],
    size: 6,
    terrain: [
      ['Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt'],
      ['Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt'],
      ['Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt'],
      ['Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt'],
      ['Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt'],
      ['Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt'],
      ['Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt', 'Dirt'],
    ],
  }

  const space = ensureBuildingInteriorSpace(context, building, blueprint)

  assert.deepEqual(
    createdBuildings
      .filter(item => item.type === 'Chest')
      .map(item => ({
        indestructible: item.indestructible,
        i: item.i,
        isBuilt: item.isBuilt,
        inventory: item.inventory,
        j: item.j,
        label: item.label,
        spaceId: item.spaceId,
        type: item.type,
      })),
    [
      {
        indestructible: true,
        i: 3,
        isBuilt: true,
        inventory: { resources: { food: 25, wood: 5 } },
        j: 0,
        label: `${space.id}:default:storage-chest`,
        spaceId: space.id,
        type: 'Chest',
      },
    ]
  )
  assert.deepEqual(building.inventory.resources, {})
})

test('destroyed building interiors merge every interior chest inventory into one drop', () => {
  const removedBuckets = []
  const { extractBuildingInteriorChestInventory } = loadBuildingInteriorSpaceSystem()
  const context = {
    map: {
      grid: [[{ i: 0, j: 0 }]],
      removeFromInstanceBucket: building => removedBuckets.push(building.label),
      spaces: new Map(),
    },
  }
  const owner = { buildings: [] }
  const space = {
    id: 'interior:granary-1',
    kind: 'interior',
    renderer: {},
  }
  context.map.spaces.set(space.id, space)
  const parent = {
    context,
    inventory: { resources: { food: 2 }, equipment: ['basket'] },
    label: 'granary-1',
    owner,
    type: 'Granary',
  }
  const firstCell = { has: null, solid: true }
  const secondCell = { has: null, solid: true }
  const firstChest = {
    currentCell: firstCell,
    destroy: () => {},
    inventory: { resources: { food: 3, wood: 4 }, equipment: ['trap'] },
    isDead: false,
    isDestroyed: false,
    label: `${space.id}:default:storage-chest`,
    owner,
    parent: { removeChild: () => {} },
    spaceId: space.id,
    type: 'Chest',
  }
  const secondChest = {
    currentCell: secondCell,
    destroy: () => {},
    inventory: { resources: { food: 5, gold: 1 } },
    isDead: false,
    isDestroyed: false,
    label: `${space.id}:extra:storage-chest`,
    owner,
    parent: { removeChild: () => {} },
    spaceId: space.id,
    type: 'Chest',
  }
  const outsideChest = {
    inventory: { resources: { food: 999 } },
    isDead: false,
    isDestroyed: false,
    label: 'outside-chest',
    owner,
    spaceId: 'outside',
    type: 'Chest',
  }
  firstCell.has = firstChest
  secondCell.has = secondChest
  owner.buildings.push(parent, firstChest, secondChest, outsideChest)

  const inventory = extractBuildingInteriorChestInventory(context, parent)

  assert.deepEqual(inventory, {
    resources: { food: 10, wood: 4, gold: 1 },
    equipment: ['basket', 'trap'],
  })
  assert.deepEqual(owner.buildings, [parent, outsideChest])
  assert.deepEqual(removedBuckets, [firstChest.label, secondChest.label])
  assert.equal(firstChest.isDestroyed, true)
  assert.equal(secondChest.isDestroyed, true)
  assert.deepEqual(parent.inventory, { resources: {}, equipment: [] })
  assert.deepEqual(firstChest.inventory, { resources: {}, equipment: [] })
  assert.equal(firstCell.has, null)
  assert.equal(firstCell.solid, false)
})

test('runtime building interior exit marker sorts above its floor cell inside the scene layer', () => {
  const { BuildingInteriorSpaceRenderer } = loadBuildingInteriorSpaceSystem()
  const context = {
    app: { ticker: { add: () => {}, remove: () => {} } },
    controls: { getViewportMetrics: () => ({ visibleLeft: 0, visibleTop: 0, visibleWidth: 800, visibleHeight: 600 }) },
  }

  const renderer = new BuildingInteriorSpaceRenderer(context, 'interior:test', [], 12)
  renderer.space = { exitCell: { i: 4, j: 5, zIndex: 8.8 } }
  renderer.setActive(true)

  renderer.updateExitMarker(16)

  assert.ok(Math.abs(renderer.exitMarker.zIndex - 8.85) < 0.0001)
})

test('runtime building interior activation refreshes both interior and exterior shadows', () => {
  const renderUpdates = []
  const visibilityUpdates = []
  const { activateBuildingInteriorSpace, deactivateBuildingInteriorSpace } = loadBuildingInteriorSpaceSystem({
    updateInstanceVisibility: entity => {
      visibilityUpdates.push(entity.label)
    },
    updateInstanceRenderVisibility: entity => {
      renderUpdates.push(entity.label)
      const entitySpace = entity.spaceId ?? 'outside'
      const activeSpace = entity.context.map.activeSpaceId ?? 'outside'
      entity.visible = entitySpace === activeSpace
      if (entity.shadow) entity.shadow.visible = entity.visible
    },
  })
  const exteriorUnit = {
    context: null,
    label: 'outside-villager',
    shadow: { visible: true },
    visible: true,
  }
  const interiorUnit = {
    context: null,
    label: 'inside-villager',
    shadow: { visible: false },
    spaceId: 'interior:test',
    visible: false,
  }
  const exteriorContainer = { sortChildren() {} }
  const interiorSceneLayer = { sortChildren() {} }
  const context = {
    map: {
      activeSpaceId: null,
      spaces: new Map(),
    },
  }
  exteriorUnit.context = context
  interiorUnit.context = context
  const outsideSpace = {
    container: exteriorContainer,
    id: 'outside',
    instanceBuckets: [[new Set([exteriorUnit])]],
  }
  const interiorSpace = {
    container: interiorSceneLayer,
    id: 'interior:test',
    instanceBuckets: [[new Set([interiorUnit])]],
    renderer: {
      sceneLayer: interiorSceneLayer,
      setActive(active) {
        this.visible = active
      },
      update() {},
    },
  }
  context.map.spaces.set('outside', outsideSpace)
  context.map.spaces.set('interior:test', interiorSpace)

  activateBuildingInteriorSpace(context, interiorSpace)

  assert.equal(exteriorUnit.visible, false)
  assert.equal(exteriorUnit.shadow.visible, false)
  assert.equal(interiorUnit.visible, true)
  assert.equal(interiorUnit.shadow.visible, true)

  deactivateBuildingInteriorSpace(context, interiorSpace)

  assert.equal(exteriorUnit.visible, true)
  assert.equal(exteriorUnit.shadow.visible, true)
  assert.equal(interiorUnit.visible, false)
  assert.equal(interiorUnit.shadow.visible, false)
  assert.deepEqual(visibilityUpdates, ['outside-villager', 'inside-villager', 'outside-villager', 'inside-villager'])
  assert.deepEqual(renderUpdates, ['outside-villager', 'inside-villager', 'outside-villager', 'inside-villager'])
})

test('runtime interior sleep fallback never settles a unit on the exit passage cell', () => {
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({
      border: false,
      category: 'Land',
      has: null,
      i,
      j,
      solid: false,
      terrainHidden: false,
      waterBorder: false,
    }))
  )
  const exitCell = grid[1][1]
  exitCell.spaceId = 'interior:test'
  const fallbackCell = grid[0][1]
  fallbackCell.spaceId = 'interior:test'
  const building = { label: 'house-1', owner: { units: [] }, type: 'House' }
  const context = { map: { spaces: new Map() } }
  const space = {
    building,
    entryCell: exitCell,
    exitCell,
    grid,
    id: 'interior:test',
    portals: [{ sourceCell: exitCell, targetCell: null }],
    sleepCells: [],
    size: 2,
  }
  context.map.spaces.set(space.id, space)
  const unit = {
    context,
    currentCell: exitCell,
    i: exitCell.i,
    j: exitCell.j,
    label: 'villager-1',
    shelterState: { reason: 'sleep', shelter: building, status: 'inside' },
  }
  const { moveUnitToBuildingInteriorSleep } = loadBuildingInteriorSpaceSystem({
    getCellsAroundPoint: (_i, _j, _grid, _radius, condition) => [exitCell, fallbackCell].filter(condition),
    moveEntityToMapSpace: (_map, targetUnit, _space, cell) => {
      targetUnit.currentCell = cell
      targetUnit.i = cell.i
      targetUnit.j = cell.j
      cell.has = targetUnit
      cell.solid = true
    },
  })

  assert.equal(moveUnitToBuildingInteriorSleep(context, unit, space), true)

  assert.equal(unit.currentCell, fallbackCell)
  assert.equal(exitCell.has, null)
})

test('destroyed building interiors expel living units back outside', () => {
  const calls = []
  const outsideGrid = Array.from({ length: 4 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => ({
      border: false,
      category: 'Land',
      has: null,
      i,
      j,
      solid: false,
      terrainHidden: false,
      waterBorder: false,
    }))
  )
  const entryCell = outsideGrid[1][1]
  const secondCell = outsideGrid[1][2]
  const building = { i: 1, j: 1, isBuilt: true, label: 'town-center-1', owner: {}, size: 3, type: 'TownCenter' }
  const renderer = {
    setActive: active => calls.push(['setActive', active]),
  }
  const container = { sortChildren: () => calls.push(['sortInterior']) }
  const space = {
    building,
    container,
    exteriorEntryCell: entryCell,
    grid: [],
    id: 'interior:town-center-1',
    kind: 'interior',
    renderer,
    size: 15,
  }
  const outsideSpace = { container: { sortChildren: () => calls.push(['sortOutside']) }, grid: outsideGrid, id: 'outside', kind: 'outside' }
  const context = {
    map: {
      activeSpaceId: space.id,
      grid: outsideGrid,
      spaces: new Map([
        ['outside', outsideSpace],
        [space.id, space],
      ]),
    },
    players: [],
  }
  const villager = {
    context,
    family: 'unit',
    isDead: false,
    isDestroyed: false,
    label: 'villager-1',
    owner: null,
    shelterState: { status: 'inside', reason: 'sleep', shelter: building },
    spaceId: space.id,
    sprite: { stop: () => calls.push(['stopSprite', 'villager-1']) },
    syncAppearanceLayers: sheet => calls.push(['syncAppearance', sheet]),
    setTextures: sheet => calls.push(['setTextures', sheet]),
  }
  const secondVillager = {
    context,
    family: 'unit',
    isDead: false,
    isDestroyed: false,
    label: 'villager-2',
    spaceId: space.id,
  }
  const outsideVillager = { family: 'unit', isDead: false, isDestroyed: false, label: 'villager-3', spaceId: 'outside' }
  context.players.push({ units: [villager, secondVillager, outsideVillager] })

  const { expelBuildingInteriorOccupants } = loadBuildingInteriorSpaceSystem({
    getCellsAroundPoint: (_i, _j, _grid, _radius, condition) => [entryCell, secondCell].filter(condition),
    moveEntityToMapSpace: (_map, unit, targetSpace, cell) => {
      calls.push(['move', unit.label, targetSpace.id, cell.i, cell.j])
      unit.spaceId = targetSpace.id
      unit.currentCell = cell
      cell.has = unit
      cell.solid = true
    },
    prepareUnitForSpaceTransfer: unit => calls.push(['prepare', unit.label]),
    updateInstanceRenderVisibility: unit => calls.push(['renderVisibility', unit.label]),
    updateInstanceVisibility: unit => calls.push(['visibility', unit.label]),
  })

  const evacuated = expelBuildingInteriorOccupants(context, building)

  assert.deepEqual(
    evacuated.map(unit => unit.label),
    ['villager-1', 'villager-2']
  )
  assert.deepEqual(
    calls.filter(call => call[0] === 'move'),
    [
      ['move', 'villager-1', 'outside', 1, 1],
      ['move', 'villager-2', 'outside', 1, 2],
    ]
  )
  assert.equal(villager.shelterState, null)
  assert.equal(context.map.activeSpaceId, null)
  assert.deepEqual(calls.find(call => call[0] === 'setActive'), ['setActive', false])
})

test('destroyed active building interior expels the hero back to the outside map', () => {
  const calls = []
  const outsideGrid = Array.from({ length: 4 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => ({
      border: false,
      category: 'Land',
      has: null,
      i,
      j,
      solid: false,
      terrainHidden: false,
      waterBorder: false,
    }))
  )
  const entryCell = outsideGrid[1][1]
  const building = { i: 1, j: 1, isBuilt: true, label: 'house-1', owner: {}, size: 2, type: 'House' }
  const space = {
    building,
    container: { sortChildren: () => {} },
    exteriorEntryCell: entryCell,
    grid: [],
    id: 'interior:house-1',
    kind: 'interior',
    renderer: { setActive: active => calls.push(['setActive', active]) },
    size: 15,
  }
  const outsideSpace = { container: { sortChildren: () => {} }, grid: outsideGrid, id: 'outside', kind: 'outside' }
  const hero = {
    context: null,
    family: 'unit',
    isDead: false,
    isDestroyed: false,
    label: 'hero',
    spaceId: space.id,
    sprite: { stop: () => calls.push(['stopSprite', 'hero']) },
    syncAppearanceLayers: sheet => calls.push(['syncAppearance', sheet]),
    setTextures: sheet => calls.push(['setTextures', sheet]),
  }
  const context = {
    controls: { heroUnit: hero },
    map: {
      activeSpaceId: space.id,
      grid: outsideGrid,
      spaces: new Map([
        ['outside', outsideSpace],
        [space.id, space],
      ]),
    },
    players: [{ units: [hero] }],
  }
  hero.context = context

  const { expelBuildingInteriorOccupants } = loadBuildingInteriorSpaceSystem({
    getCellsAroundPoint: (_i, _j, _grid, _radius, condition) => [entryCell].filter(condition),
    moveEntityToMapSpace: (_map, unit, targetSpace, cell) => {
      calls.push(['move', unit.label, targetSpace.id, cell.i, cell.j])
      if (targetSpace.id === 'outside') delete unit.spaceId
      else unit.spaceId = targetSpace.id
      unit.currentCell = cell
      cell.has = unit
      cell.solid = true
    },
    prepareUnitForSpaceTransfer: unit => calls.push(['prepare', unit.label]),
    updateInstanceRenderVisibility: unit => calls.push(['renderVisibility', unit.label]),
    updateInstanceVisibility: unit => calls.push(['visibility', unit.label]),
  })

  const expelled = expelBuildingInteriorOccupants(context, building)

  assert.deepEqual(
    expelled.map(unit => unit.label),
    ['hero']
  )
  assert.equal(hero.spaceId, undefined)
  assert.equal(hero.currentCell, entryCell)
  assert.equal(context.map.activeSpaceId, null)
  assert.deepEqual(calls.find(call => call[0] === 'prepare'), ['prepare', 'hero'])
  assert.deepEqual(calls.find(call => call[0] === 'move'), ['move', 'hero', 'outside', 1, 1])
  assert.deepEqual(calls.find(call => call[0] === 'setActive'), ['setActive', false])
})

test('destroyed stable releases interior and stored horses as wild runaways', () => {
  const calls = []
  const outsideGrid = Array.from({ length: 4 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => ({
      border: false,
      category: 'Land',
      has: null,
      i,
      j,
      solid: false,
      terrainHidden: false,
      waterBorder: false,
    }))
  )
  const firstCell = outsideGrid[1][1]
  const secondCell = outsideGrid[1][2]
  const building = {
    i: 1,
    j: 1,
    isBuilt: true,
    label: 'stable-1',
    owner: {},
    size: 3,
    stableHorses: [{ horseColor: 'light', tamingStatus: 'tamed' }, { horseColor: 'dark', tamingStatus: 'tamed' }],
    horseAmount: 2,
    type: 'Stable',
  }
  const space = {
    building,
    container: { sortChildren: () => {} },
    exteriorEntryCell: firstCell,
    grid: [],
    id: 'interior:stable-1',
    kind: 'interior',
    renderer: { setActive: () => {} },
    size: 15,
  }
  const outsideSpace = { container: { sortChildren: () => {} }, grid: outsideGrid, id: 'outside', kind: 'outside' }
  const interiorHorse = {
    ambientMovement: false,
    animalBehavior: { start: () => calls.push(['startBehavior', 'interior-horse']) },
    family: 'animal',
    isDead: false,
    isDestroyed: false,
    label: `${space.id}:stable-horse:0`,
    spaceId: space.id,
    strategy: undefined,
    tamingStatus: 'tamed',
    type: 'Horse',
    updateTexture: () => calls.push(['updateTexture', 'interior-horse']),
  }
  const createdAnimals = []
  const context = {
    map: {
      activeSpaceId: null,
      gaia: {
        animals: [interiorHorse],
        createAnimal(options) {
          const horse = {
            ...options,
            animalBehavior: { start: () => calls.push(['startBehavior', options.horseColor]) },
            family: 'animal',
            isDead: false,
            isDestroyed: false,
            label: `created-${createdAnimals.length}`,
            updateTexture: () => calls.push(['updateTexture', options.horseColor]),
          }
          createdAnimals.push(horse)
          this.animals.push(horse)
          return horse
        },
      },
      grid: outsideGrid,
      spaces: new Map([
        ['outside', outsideSpace],
        [space.id, space],
      ]),
    },
    players: [],
  }

  const { expelBuildingInteriorOccupants } = loadBuildingInteriorSpaceSystem({
    getCellsAroundPoint: (_i, _j, _grid, _radius, condition) => [firstCell, secondCell].filter(condition),
    moveEntityToMapSpace: (_map, entity, targetSpace, cell) => {
      calls.push(['move', entity.label, targetSpace.id, cell.i, cell.j])
      entity.spaceId = targetSpace.id
      cell.has = entity
      cell.solid = true
    },
    updateInstanceRenderVisibility: entity => calls.push(['renderVisibility', entity.label]),
    updateInstanceVisibility: entity => calls.push(['visibility', entity.label]),
  })

  const expelled = expelBuildingInteriorOccupants(context, building)

  assert.deepEqual(
    expelled.map(entity => entity.label),
    [`${space.id}:stable-horse:0`, 'created-0']
  )
  assert.equal(interiorHorse.spaceId, 'outside')
  assert.equal(interiorHorse.tamingStatus, 'wild')
  assert.equal(interiorHorse.strategy, 'runaway')
  assert.equal(interiorHorse.ambientMovement, true)
  assert.equal(createdAnimals.length, 1)
  assert.equal(createdAnimals[0].horseColor, 'dark')
  assert.equal(createdAnimals[0].tamingStatus, 'wild')
  assert.equal(createdAnimals[0].strategy, 'runaway')
  assert.equal(createdAnimals[0].ambientMovement, true)
  assert.deepEqual(building.stableHorses, [])
  assert.equal(building.horseAmount, 0)
  assert.deepEqual(
    calls.filter(call => call[0] === 'move'),
    [['move', `${space.id}:stable-horse:0`, 'outside', 1, 1]]
  )
})
