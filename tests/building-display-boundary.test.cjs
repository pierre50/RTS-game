const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('a building owns simulation coordinates while its Pixi view owns the display container', async () => {
  const pixi = await import('pixi.js')
  const { PixiBuildingView } = loadTsModule('app/rendering/pixi/PixiBuildingView.ts', {
    mocks: {
      'pixi.js': pixi,
      '../../lib': {},
      '../../lib/buildings/campConstruction': {},
      '../../classes/building/BuildingVisuals': {},
      './PixiBuildingTrainingPreview': { BuildingTrainingPreview: class {} },
      './PixiBuildingDestruction': { showBuildingDestruction() {} },
      './PixiBuildingVisuals': { destroyBuildingVisuals() {} },
      './PixiBuildingFinalTexture': {},
    },
  })
  const noop = () => {}
  const service = class {}
  const { Building } = loadTsModule('app/classes/building/Building.ts', {
    mocks: {
      '../../lib': { uuidv4: () => 'building-1' },
      '../../constants': { CAMP_DECORATION_BUILDING_TYPES: [], FAMILY_TYPES: { building: 'building' } },
      '../InstanceHudBars': {},
      '../../ui/entity/BuildingInterface': { BuildingInterface: service },
      './BuildingLifecycle': { BuildingLifecycle: service },
      './BuildingFire': { stopFlameAmbientSound: noop },
      './BuildingProduction': { BuildingProduction: service },
      './BuildingCombat': { BuildingCombat: service },
      '../../lib/audio/settings': { onVisualSettingsChange: () => noop },
      './BuildingInterfaceSetup': { createBuildingEntityInterface: () => ({}) },
      './BuildingSetup': {
        activateBuiltBuilding: noop,
        attachInitialBuildingVisuals: noop,
        createInitialBuildingSprite: noop,
        occupyBuildingFootprint: noop,
        resumeInitialBuildingWork: noop,
        setupBuildingTransform: noop,
        stableHorsesFromOptions: () => [],
      },
      '../../rendering/pixi/PixiBuildingView': { PixiBuildingView },
      '../../lib/mapSpaces': { getEntityMapSpace: building => building.context.map },
    },
  })
  const cell = { i: 2, j: 3, z: 2 }
  const map = { grid: Array.from({ length: 4 }, () => []), revealEverything: true, addToInstanceBucket: noop }
  map.grid[2][3] = cell
  const context = { map, controls: { instanceInCamera: () => true } }
  const owner = { config: { buildings: { House: { size: 1, totalHitPoints: 100, constructionTime: 1 } } } }
  const building = new Building({ type: 'House', i: 2, j: 3, owner, isBuilt: false }, context)
  const display = building.displayObject
  assert.ok(display instanceof pixi.Container)
  assert.notEqual(display, building)
  assert.equal(display.runtimeEntity, building)

  const state = building.getVisualState()
  building.buildingView.mount(state)
  assert.deepEqual(state.position.z, cell.z)
  assert.equal(building.z, cell.z)
  assert.equal(display.x, building.x)
  assert.equal(display.y, building.y)
  assert.equal(display.zIndex, state.sortOrder)
  assert.equal(display.visible, state.visible)

  const hudCalls = []
  for (const name of ['drawHealthBar', 'drawEnergyBar', 'removeHealthBar', 'removeEnergyBar']) {
    building.buildingView[name] = () => hudCalls.push(name)
    building[name]()
  }
  assert.deepEqual(hudCalls, ['drawHealthBar', 'drawEnergyBar', 'removeHealthBar', 'removeEnergyBar'])

  const layer = new pixi.Container()
  layer.addChild(display)
  building.destroy({ children: true, texture: false })
  assert.equal(display.destroyed, true)
  assert.equal(display.parent, null)
})
