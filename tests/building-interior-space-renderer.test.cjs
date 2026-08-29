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
      '../classes/cell': { Cell: class {} },
      '../constants': {
        BUILDING_TYPES: {
          campCrate: 'CampCrate',
          campJarSmall: 'CampJarSmall',
          campRockPile: 'CampRockPile',
          fireCamp: 'FireCamp',
          house: 'House',
        },
        CELL_HEIGHT: 32,
        CELL_WIDTH: 64,
        LABEL_TYPES: { interiorExit: 'interiorExit' },
      },
      '../lib/buildings/interiors': {
        getBuildingInteriorEntryCell: () => null,
        getBuildingInteriorPortalId: building => building.label || 'building',
      },
      '../lib/grid/cells': { getCellsAroundPoint: overrides.getCellsAroundPoint ?? (() => []) },
      '../lib/grid/placement': { canPlaceBuildingAt: () => false },
      '../lib/grid/visibility': {
        updateInstanceRenderVisibility: overrides.updateInstanceRenderVisibility ?? (() => {}),
        updateInstanceVisibility: overrides.updateInstanceVisibility ?? (() => {}),
      },
      '../lib/mapSpaces': {
        OUTSIDE_SPACE_ID: 'outside',
        ensureMapSpaces: map => (map.spaces ??= new Map()),
        getEntityMapSpace: () => null,
        getMapSpace: () => null,
        moveEntityToMapSpace: overrides.moveEntityToMapSpace ?? (() => {}),
        sameMapSpace: () => true,
      },
      '../lib/ui/InteractionCellMarker': {
        INTERACTION_CELL_MARKER_PULSE_MS: 1400,
        INTERACTION_CELL_MARKER_Z_INDEX: 100,
        drawInteractionCellMarker: () => {},
        interactionCellPulse: () => 1,
      },
      '../lib/entities/overheadIndicator': { setUnitOverheadIndicator: () => {} },
      './UnitSleepVisuals': {
        setDetachedShadowsVisible: () => {},
        setSleepingOutsideFinalVisual: () => {},
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

  assert.deepEqual(renderer.children.map(child => child.label), ['building-interior-backdrop', 'building-interior-scene'])
  assert.deepEqual(renderer.sceneLayer.children.map(child => child.label), [
    'building-interior-terrain',
    'building-interior-entities',
  ])
  assert.equal(renderer.exitMarker.parent, renderer.entityLayer)
  assert.equal(renderer.entityLayer.sortableChildren, true)
  assert.equal(renderer.sceneLayer.sortableChildren, true)
  assert.equal(renderer.terrainLayer.sortableChildren, true)
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
  assert.deepEqual(visibilityUpdates, [
    'outside-villager',
    'inside-villager',
    'outside-villager',
    'inside-villager',
  ])
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
