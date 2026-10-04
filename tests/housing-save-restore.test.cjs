const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const config = { buildings: { House: { shelterCapacity: 5 }, TownCenter: {} } }
class RestoredPlayer {
  constructor(options) { Object.assign(this, options); this.config = config }
}
const { restoreSavedPlayers } = loadTsModule('app/classes/map/generation/MapSavedEntities.ts', {
  mocks: {
    '../../../lib': {},
    '../../../services/visibility/UnitPerception': {},
    '../../../services/wildlife/WildlifeStore': {},
    '../../cell/PackedCellRegistry': {},
    '../../Resource': {},
    '../../ResourceTexture': {},
    '../../resources/CompactResourceSet': {},
    '../MapSaveRestore': {},
    '../../players': { Human: RestoredPlayer, AI: RestoredPlayer, Player: RestoredPlayer } },
})

test('loading derives housing from saved beds in completed houses without changing the population', () => {
  const player = { type: 'Human', isPlayed: true, population: 8, populationMax: 25, buildings: [
    { type: 'TownCenter', isBuilt: true },
    { type: 'House', label: 'house', isBuilt: true, interiorBuildings: Array.from({ length: 2 }, (_, index) => ({ type: 'CampBedroll', label: `bed-${index}`, isBuilt: true })) },
    { type: 'House', isBuilt: false },
    { type: 'House', isBuilt: true, isDead: true },
  ] }
  const context = { app: {}, gamebox: {}, map: {}, scheduler: {} }
  const map = { context }
  restoreSavedPlayers(map, [player])
  assert.equal(context.player.populationMax, 2)
  assert.equal(player.populationMax, 2)
  assert.equal(context.player.population, 8)
  restoreSavedPlayers(map, [player])
  assert.equal(context.player.populationMax, 2)
  player.buildings = [player.buildings[0]]
  restoreSavedPlayers(map, [player])
  assert.equal(context.player.populationMax, 0)
  assert.equal(context.player.population, 8)
})

test('remote economy uses the same housing capacity as the active village', () => {
  const { economyRulesFor } = loadTsModule('app/services/world/WorldEconomyRuntime.ts', {
    mocks: {
      'pixi.js': { Assets: { cache: { get: () => ({ resources: {} }) } } },
      '../../config/playerConfig': { createPlayerData: () => config },
      '../../serialization/SaveSerializer': {},
      './WorldEconomy': {},
      './VillageStartingState': {},
      './VillageBaseState': {},
      './OfflineWorldSpatial': {},
    },
  })
  const player = { type: 'AI', population: 8, populationMax: 15,
    buildings: [{ type: 'TownCenter', isBuilt: true }, { type: 'House', isBuilt: true }] }
  const rules = economyRulesFor({ players: [player], resources: [] })
  assert.equal(player.populationMax, 2)
  assert.equal(player.population, 8)
  const { getPopulationCapacityFromBuildings } = loadTsModule('app/lib/buildings/buildingOccupancy.ts')
  assert.equal(getPopulationCapacityFromBuildings(player.buildings, player), 2)
  assert.equal(rules.buildingCapacity, undefined, 'capacity comes from beds, not a fixed house quota')
})
