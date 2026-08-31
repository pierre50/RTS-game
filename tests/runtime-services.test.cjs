const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadRuntimeServices() {
  const calls = []
  const service = name =>
    class {
      constructor() {
        calls.push(name)
        this.layer = { name: `${name}-layer` }
      }
      destroy() {}
      register() {}
      getDarknessLevel() {
        return 0
      }
    }

  const module = loadTsModule('app/screens/game/runtimeServices.ts', {
    mocks: {
      '../../services/BuildingInteriorEntryMarkerSystem': {
        BuildingInteriorEntryMarkerSystem: service('buildingInteriorEntryMarker'),
      },
      '../../services/CampPatrolSystem': { CampPatrolSystem: service('campPatrols') },
      '../../services/DailyWorldEventSystem': { DailyWorldEventSystem: service('dailyWorldEvents') },
      '../../services/DayNightSystem': { DayNightSystem: service('dayNight') },
      '../../services/HeroFollowerPatrolSystem': { HeroFollowerPatrolSystem: service('heroFollowerPatrols') },
      '../../services/IdleUnitPatrolSystem': { IdleUnitPatrolSystem: service('idleUnitPatrols') },
      '../../services/InteriorExitMarkerSystem': { InteriorExitMarkerSystem: service('interiorExitMarker') },
      '../../services/LightSystem': { LightSystem: service('lights') },
      '../../services/ShadowSystem': { ShadowSystem: service('shadows') },
      '../../services/TimeSkipSystem': { TimeSkipSystem: service('timeSkip') },
      '../../services/TributeRaidSystem': { TributeRaidSystem: service('tributeRaids') },
      '../../services/UnitEnergyRegenSystem': { UnitEnergyRegenSystem: service('unitEnergyRegen') },
      '../../services/rest/UnitRestSystem': { UnitRestSystem: service('unitRest') },
      '../../services/WeatherSystem': { WeatherSystem: service('weather') },
      './GameResourceDelivery': { ResourceDeliverySystem: service('resourceDelivery') },
    },
  })

  return { ...module, calls }
}

test('runtime services skip weather inside interior maps', () => {
  const { addRuntimeServiceLayers, calls, createRuntimeServices } = loadRuntimeServices()
  const context = {}
  const map = { mapType: 'interior' }

  const services = createRuntimeServices(context, map, () => ({ height: 100, width: 100, x: 0, y: 0 }))

  assert.equal(services.weather, null)
  assert.equal(services.buildingInteriorEntryMarker, null)
  assert.ok(services.interiorExitMarker)
  assert.equal(context.weather, null)
  assert.equal(context.timeSkip, services.timeSkip)
  assert.equal(calls.includes('weather'), false)
  assert.equal(calls.includes('timeSkip'), true)
  assert.equal(calls.includes('idleUnitPatrols'), true)
  assert.equal(calls.includes('buildingInteriorEntryMarker'), false)
  assert.equal(calls.includes('interiorExitMarker'), true)

  const layers = []
  addRuntimeServiceLayers({ addChild: child => layers.push(child) }, services)
  assert.deepEqual(
    layers.map(layer => layer.name),
    ['lights-layer']
  )
})

test('runtime services keep weather outside interior maps', () => {
  const { calls, createRuntimeServices } = loadRuntimeServices()
  const context = {}
  const map = { mapType: 'continent' }

  const services = createRuntimeServices(context, map, () => ({ height: 100, width: 100, x: 0, y: 0 }))

  assert.ok(services.weather)
  assert.ok(services.buildingInteriorEntryMarker)
  assert.equal(services.interiorExitMarker, null)
  assert.equal(context.weather, services.weather)
  assert.equal(context.timeSkip, services.timeSkip)
  assert.equal(calls.includes('weather'), true)
  assert.equal(calls.includes('buildingInteriorEntryMarker'), true)
})
