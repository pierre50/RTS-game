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
      destroy() {
        calls.push(`destroy:${name}`)
      }
      register() {}
      getDarknessLevel() {
        return 0
      }
    }

  const module = loadTsModule('app/screens/game/runtimeServices.ts', {
    mocks: {
      '../../services/VillageActivitySystem': { VillageActivitySystem: service('villageActivity') },
      '../../services/WildlifeSystem': { WildlifeSystem: service('wildlife') },
      '../../services/quests/NeutralVillageQuests': { NeutralVillageQuests: service('neutralVillageQuests') },
      '../../services/buildingInterior/BuildingInteriorEntryMarkerSystem': {
        BuildingInteriorEntryMarkerSystem: service('buildingInteriorEntryMarker'),
      },
      '../../services/patrol/CampPatrolSystem': { CampPatrolSystem: service('campPatrols') },
      '../../services/DailyWorldEventSystem': { DailyWorldEventSystem: service('dailyWorldEvents') },
      '../../services/DayNightSystem': { DayNightSystem: service('dayNight') },
      '../../services/HeroFollowerPatrolSystem': { HeroFollowerPatrolSystem: service('heroFollowerPatrols') },
      '../../services/IdleUnitPatrolSystem': { IdleUnitPatrolSystem: service('idleUnitPatrols') },
      '../../services/VillagerAutonomySystem': { VillagerAutonomySystem: service('villagerAutonomy') },
      '../../services/InteriorExitMarkerSystem': { InteriorExitMarkerSystem: service('interiorExitMarker') },
      '../../services/lighting/LightSystem': { LightSystem: service('lights') },
      '../../services/ShadowSystem': { ShadowSystem: service('shadows') },
      '../../services/TimeSkipSystem': { TimeSkipSystem: service('timeSkip') },
      '../../services/TributeRaidSystem': { TributeRaidSystem: service('tributeRaids') },
      '../../services/UnitEnergyRegenSystem': { UnitEnergyRegenSystem: service('unitEnergyRegen') },
      '../../services/rest/UnitRestSystem': { UnitRestSystem: service('unitRest') },
      '../../services/weather/WeatherSystem': { WeatherSystem: service('weather') },
      './GameResourceDelivery': { ResourceDeliverySystem: service('resourceDelivery') },
    },
  })

  return { ...module, calls }
}

test('saved training resumes after the clock is installed and before incoming trainee orders', () => {
  const { createRuntimeServices } = loadRuntimeServices()
  const calls = []
  const context = { players: [] }
  const building = {
    resumeSavedTraining() {
      assert.ok(context.dayNight)
      calls.push('training')
    },
  }
  const unit = {
    trainingTargetType: 'Fantassin',
    action: 'train',
    dest: building,
    sendToEvt(dest, action) {
      assert.ok(context.dayNight)
      assert.equal(dest, building)
      assert.equal(action, 'train')
      calls.push('order')
    },
  }
  context.players.push({ buildings: [building], units: [unit] })
  createRuntimeServices(context, { mapType: 'world-region' }, () => ({ height: 100, width: 100, x: 0, y: 0 }))
  assert.deepEqual(calls, ['training', 'order'])
})

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
  const { addRuntimeServiceLayers, calls, createRuntimeServices } = loadRuntimeServices()
  const context = {}
  const map = { mapType: 'world-region' }

  const services = createRuntimeServices(context, map, () => ({ height: 100, width: 100, x: 0, y: 0 }))

  assert.ok(services.weather)
  assert.ok(services.buildingInteriorEntryMarker)
  assert.equal(services.interiorExitMarker, null)
  assert.equal(context.weather, services.weather)
  assert.equal(context.timeSkip, services.timeSkip)
  assert.equal(calls.includes('weather'), true)
  assert.equal(calls.includes('buildingInteriorEntryMarker'), true)

  const layers = []
  addRuntimeServiceLayers({ addChild: child => layers.push(child) }, services)
  assert.deepEqual(
    layers.map(layer => layer.name),
    ['weather-layer', 'lights-layer']
  )
  assert.ok(services.weather.layer.zIndex < services.lights.layer.zIndex)
})

test('autonomy monitor mounts after rest and delivery and is destroyed between visits', () => {
  const { createRuntimeServices, destroyRuntimeServices, calls } = loadRuntimeServices()
  const context = {}
  const services = createRuntimeServices(context, { mapType: 'world-region' }, () => ({
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  }))
  assert.ok(calls.indexOf('villagerAutonomy') > calls.indexOf('unitRest'))
  assert.ok(calls.indexOf('villagerAutonomy') > calls.indexOf('resourceDelivery'))
  assert.ok(services.villagerAutonomy)
  const cleared = destroyRuntimeServices(services, context)
  assert.equal(cleared.villagerAutonomy, null)
  assert.equal(calls.filter(call => call === 'destroy:villagerAutonomy').length, 1)
})

test('outdoor runtime installs no automatic region travel service, including for legacy hosts', () => {
  const { createRuntimeServices, createEmptyRuntimeServices } = loadRuntimeServices()
  let travelRequests = 0
  const context = { controls: { heroUnit: { i: 0, j: 0 } }, players: [] }
  const map = { mapType: 'world-region', worldRegion: { x: 0, y: 0 }, worldId: 'world' }
  const legacyHost = {
    preloadWorldRegion() {
      travelRequests++
    },
    travelToWorldRegion() {
      travelRequests++
    },
  }
  const services = createRuntimeServices(
    context,
    map,
    () => ({ width: 100, height: 100, x: 0, y: 0 }),
    null,
    legacyHost
  )
  assert.equal('worldRegionTravel' in services, false)
  assert.equal('worldRegionTravel' in createEmptyRuntimeServices(), false)
  assert.equal(travelRequests, 0)
})
