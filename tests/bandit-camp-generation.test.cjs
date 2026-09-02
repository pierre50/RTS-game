const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadBanditCampGeneration() {
  return loadTsModule('app/classes/map/BanditCampGeneration.ts', {
    mocks: {
      '../players': {
        AI: class AI {
          constructor(options) {
            Object.assign(this, options)
          }
        },
      },
      '../../lib': {
        canPlaceBuildingAt: () => true,
        getPlainCellsAroundPoint: (i, j, _grid, _distance, predicate) => {
          const cell = { i, j, category: 'Land', solid: false, has: null }
          return predicate(cell) ? [cell] : []
        },
      },
      '../../lib/units/unitExperience': {
        getUnitOverallLevel: () => 0,
      },
      '../../constants': {
        BUILDING_TYPES: {
          campAnimalBones: 'CampAnimalBones',
          campBoneSmall: 'CampBoneSmall',
          campBucket: 'CampBucket',
          campCrate: 'CampCrate',
          campDryingRack: 'CampDryingRack',
          campFencePost: 'CampFencePost',
          campJarLarge: 'CampJarLarge',
          campJarSmall: 'CampJarSmall',
          campMeatRack: 'CampMeatRack',
          campRockPile: 'CampRockPile',
          campSkull: 'CampSkull',
          campTotemHorns: 'CampTotemHorns',
          campTotemPlain: 'CampTotemPlain',
          campTotemSkull: 'CampTotemSkull',
          chest: 'Chest',
          fireCamp: 'FireCamp',
        },
        PLAYER_TYPES: { bandits: 'Bandits' },
        UNIT_TYPES: {
          banditArcher: 'BanditArcher',
          banditChief: 'BanditChief',
          banditSword: 'BanditSword',
          hero: 'Hero',
        },
        WORK_TYPES: { attacker: 'attacker' },
      },
    },
  })
}

function createBanditOwner() {
  const owner = {
    buildings: [],
    config: { buildings: {} },
    label: 'bandits',
    name: 'Bandits',
    population: 0,
    type: 'Bandits',
    createBuilding(options) {
      this.buildings.push(options)
      return options
    },
    createUnit(options) {
      return options
    },
  }
  for (const type of [
    'CampAnimalBones',
    'CampBoneSmall',
    'CampBucket',
    'CampCrate',
    'CampDryingRack',
    'CampFencePost',
    'CampJarLarge',
    'CampJarSmall',
    'CampMeatRack',
    'CampRockPile',
    'CampSkull',
    'CampTotemHorns',
    'CampTotemPlain',
    'CampTotemSkull',
    'Chest',
    'FireCamp',
  ]) {
    owner.config.buildings[type] = { size: 1 }
  }
  return owner
}

test('bandit camps place a bandit-owned chest with loot', () => {
  const { placeBanditCamps } = loadBanditCampGeneration()
  const owner = createBanditOwner()
  const map = {
    banditCampPositions: [{ i: 20, j: 20 }],
    context: {
      players: [owner],
    },
    grid: [],
    noAI: false,
    randomItem: items => items[0],
    randomRange: min => min,
  }

  placeBanditCamps(map, map.context)

  const chest = owner.buildings.find(building => building.type === 'Chest')
  assert.ok(chest)
  assert.equal(chest.isBuilt, true)
  assert.deepEqual(chest.inventory.resources, { food: 8, gold: 2, wood: 3 })
  assert.equal(chest.inventory.equipment.filter(item => item === 'arrow_ceramic').length, 6)
  assert.ok(chest.inventory.equipment.includes('trap'))
  assert.ok(chest.inventory.equipment.includes('sword_ceramic'))
  assert.equal(chest.i, 18)
  assert.equal(chest.j, 17)
})
