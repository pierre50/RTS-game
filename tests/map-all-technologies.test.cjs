const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadMapGeneration() {
  return loadTsModule('app/classes/map/MapGeneration.ts', {
    mocks: {
      'pixi.js': { Assets: {}, Sprite: class {} },
      '../Resource': { Resource: class {} },
      '../players': { Human: class {}, AI: class {}, Gaia: class {} },
      './generation/MapBlueprintGeneration': {
        MapBlueprintGeneration: class {
          generateFromBlueprint() {}
          generateEditableFromBlueprint() {}
          applyBlueprintMetadata() {}
          loadBlueprintResources() {}
        },
      },
      './MapSaveRestore': {
        processUnit: () => {},
        restoreAIState: () => {},
        restoreBuildingAssignments: () => {},
        restorePlayerEntitiesFromSave: () => {},
        restorePlayerViewsAndFog: () => {},
        restoreSelection: () => {},
        restoreTransportCargo: () => {},
      },
      '../../lib': {
        colors: [],
        getCellsAroundPoint: () => [],
        getZoneInGridWithCondition: () => [],
        updateInstanceVisibility: () => {},
      },
      '../../services/FogOfWar': { rehydrateAIKnowledge: () => {} },
      '../../constants': {
        BUILDING_TYPES: {},
        FAMILY_TYPES: {},
        LABEL_TYPES: {},
        PLAYER_TYPES: {},
        RESOURCE_TYPES: {},
        UNIT_TYPES: {},
      },
      '../cell': { Cell: class {} },
      '../../lib/buildings/walls': { refreshOwnerWalls: () => {} },
    },
  }).MapGeneration
}

test('all technologies keeps the configured starting age and enables age-based auto techs', () => {
  const MapGeneration = loadMapGeneration()
  const context = {
    map: {
      startingAge: 2,
      allTechnologies: true,
    },
  }
  const player = {
    age: 0,
    technologies: [],
    applyEligibleTechnologies() {
      this.technologies.push('ResearchSmallWall', 'UpgradeMediumWall')
    },
  }

  MapGeneration.prototype.applyStartingBonuses.call(context, player)

  assert.equal(player.age, 2)
  assert.equal(player.autoTechnologyByAge, true)
  assert.deepEqual(player.technologies, ['ResearchSmallWall', 'UpgradeMediumWall'])
})

test('a player-specific age overrides the global starting age', () => {
  const MapGeneration = loadMapGeneration()
  const context = {
    map: {
      startingAge: 1,
      allTechnologies: false,
    },
  }
  const player = { age: 0 }

  MapGeneration.prototype.applyStartingBonuses.call(context, player, 3)

  assert.equal(player.age, 3)
})
