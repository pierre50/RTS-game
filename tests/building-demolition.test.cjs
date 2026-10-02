const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { canHeroDemolishBuilding } = loadTsModule('app/lib/buildings/buildingDemolition.ts')
const { INTERIOR_FURNITURE_TYPES } = loadTsModule('app/lib/buildings/interiorFurnitureCatalog.ts')
function fixture(type = 'CampBedroll', parentType = 'House') {
  const owner = { label: 'player', team: 1, population: 3, populationMax: 1, buildings: [] }
  const parent = { type: parentType, label: 'house', interiorPortalId: 'room', isBuilt: true, owner }
  const space = { id: 'interior:room', building: parent, grid: [] }
  const building = {
    type,
    label: 'furniture',
    spaceId: space.id,
    isBuilt: true,
    owner,
    indestructible: true,
    context: {
      player: owner,
      players: [owner],
      controls: { heroUnit: { owner }, instanceIsAudible: () => false },
      map: { spaces: new Map([[space.id, space]]), removeFromInstanceBucket() {} },
      menu: {},
    },
    sprite: { destroy() {} },
    stopInterval() {},
    startTimeout() {},
    getChildByLabel() {},
  }
  owner.buildings.push(parent, building)
  return { owner, parent, building }
}

test('all own furniture can be removed, but allies, neutral owners and enemies retain theirs', () => {
  for (const type of INTERIOR_FURNITURE_TYPES) {
    const { building } = fixture(type)
    assert.equal(canHeroDemolishBuilding(building), true, type)
    for (const owner of [{ team: 1 }, { team: 2 }, { type: 'Gaia', diplomacy: 'neutral' }]) {
      building.owner = owner
      assert.equal(canHeroDemolishBuilding(building), false, type)
    }
  }
})

test('only base depot chests are protected; manually added chests and forum chests are removable', () => {
  for (const type of ['StoragePit', 'Granary', 'TownCenter', 'House']) {
    const { building } = fixture('Chest', type)
    building.label = 'interior:room:default:storage-chest'
    assert.equal(canHeroDemolishBuilding(building), !['StoragePit', 'Granary'].includes(type), type)
    building.label = 'my-chest'
    assert.equal(canHeroDemolishBuilding(building), true, type)
  }
})

const { BuildingDestruction } = loadTsModule('app/classes/building/BuildingDestruction.ts', {
  mocks: {
    '../../lib': {
      isAIControlledPlayer: () => false,
      canUpdateMinimap: () => false,
      getBuildingFootprintCells: () => [],
      updateInstanceVisibility() {},
      spawnSpriteFragmentBurst() {},
    },
    '../../lib/buildings/walls': { isWall: () => false },
    '../../lib/mapSpaces': { getEntityMapSpace: building => building.context.map.spaces.get(building.spaceId) },
    '../../services/BuildingInteriorSpaceSystem': {
      expelBuildingInteriorOccupants() {},
      destroyBuildingInteriorInventory() {},
    },
    './BuildingFire': { stopFlameAmbientSound() {} },
    './BuildingVisuals': { clearBuildingConstructionReveal() {} },
  },
})

test('manual deletion runs cleanup, reduces bed capacity, and suppresses preset regrowth without allowing combat damage', () => {
  const { building, owner, parent } = fixture()
  const destruction = new BuildingDestruction(building)
  destruction.die()
  assert.equal(building.isDead, undefined, 'combat protection stays active')
  destruction.die(true)
  assert.equal(building.isDead, true)
  assert.equal(owner.buildings.includes(building), false)
  assert.equal(owner.populationMax, 0)
  assert.equal(owner.population, 3)
  assert.equal(parent.interiorUnfurnished, true)
})

test('destruction rechecks protected chests and ownership even when called directly', () => {
  const { building } = fixture('Chest', 'Granary')
  building.label = 'interior:room:default:storage-chest'
  new BuildingDestruction(building).die(true)
  assert.equal(building.isDead, undefined)
  building.label = 'ordinary-chest'
  building.owner = { buildings: [] }
  new BuildingDestruction(building).die(true)
  assert.equal(building.isDead, undefined)
})
