const { loadTsModule } = require('./loadTsModule.cjs')
const moduleCache = new Map()
const mocks = {
  'pixi.js': { Assets: { cache: { get: () => ({}) } } },
  '../../lib/economy/configuredWorkTiming': { offlineWorkCycleMs: () => 1000 },
  '../../lib/mapSpaces': {
    isOutsideSpaceId: id => !id || id === 'outside',
    getEntitySpaceId: entity => entity?.spaceId ?? 'outside',
    ensureOutsideMapSpace: map => ({ grid: map.grid }),
    moveEntityToMapSpace(map, unit, _space, cell) {
      if (map.grid[unit.i][unit.j].has === unit) map.grid[unit.i][unit.j].has = null
      Object.assign(unit, { i: cell.i, j: cell.j })
      cell.has = unit
    },
  },
}
const { advanceDistantVillageEconomy, planDistantVillageBuildings } = loadTsModule(
  'app/services/world/distantVillages/DistantVillageEconomy.ts',
  { mocks, moduleCache }
)
const { setUnitSuspension } = loadTsModule('app/lib/units/unitSuspension.ts', { mocks, moduleCache })
const { DAY_NIGHT_CONFIG } = loadTsModule('app/config/gameplay.ts')
const DAY = DAY_NIGHT_CONFIG.dayLengthMs

function fixture(builder = false) {
  const grid = Array.from({ length: 90 }, (_, i) =>
    Array.from({ length: 90 }, (_, j) => ({ i, j, category: 'Grass', z: 0 }))
  )
  const home = { id: 'village', i: 40, j: 40, spaceId: 'outside' }
  const owner = {
    label: 'ai',
    type: 'AI',
    civ: 'Hellas',
    age: 0,
    units: [],
    buildings: [],
    population: 1,
    populationMax: 5,
    hasBuilt: ['TownCenter'],
    config: {
      units: { Villager: { speed: 1.5 } },
      buildings: { House: { size: 1, totalHitPoints: 96, constructionTime: 48, shelterCapacity: 5 } },
    },
  }
  const store = {
    label: 'center',
    type: 'TownCenter',
    family: 'building',
    i: 36,
    j: 36,
    isBuilt: true,
    hitPoints: 100,
    totalHitPoints: 100,
    inventory: { resources: { wheat: 100 } },
  }
  owner.buildings.push(store)
  const worker = {
    type: 'Villager',
    label: 'worker',
    family: 'unit',
    owner,
    i: 40,
    j: 40,
    hitPoints: 18,
    totalHitPoints: 18,
    autonomousJob: builder ? 'construction' : 'wood',
    work: builder ? 'builder' : 'woodcutter',
    path: [],
    inventory: { resources: { wood: 3, wheat: 12 } },
  }
  owner.units.push(worker)
  setUnitSuspension(worker, { reason: 'distant-work', wake() {} })
  const context = {
    map: { grid, difficulty: 'medium', worldId: 'world-test-1000', worldRegionId: 'region', spaces: new Map() },
    dayNight: { state: { day: 1 } },
  }
  const house = {
    label: 'house',
    type: 'House',
    family: 'building',
    i: 42,
    j: 40,
    size: 1,
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 96,
    updateHitPoints() {
      if (!this.isBuilt && this.hitPoints >= this.totalHitPoints) {
        this.isBuilt = true
        owner.populationMax += 5
      }
    },
  }
  if (builder) owner.buildings.push(house)
  for (const entity of [...owner.units, ...owner.buildings]) grid[entity.i][entity.j].has = entity
  return { context, owner, homes: [home], worker, store, house }
}
function advance(f, from, to) {
  advanceDistantVillageEconomy(f.context, f.owner, f.homes, from, to)
}

module.exports = { fixture, advance, planDistantVillageBuildings, setUnitSuspension, DAY }
