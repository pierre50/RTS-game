const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup() {
  const mocks = {
    '../../constants': { BUILDING_TYPES: { stable: 'Stable' } },
    '../constants': { BUILDING_TYPES: { stable: 'Stable' } },
  }
  const { detachStableInteriorHorse } = loadTsModule('app/lib/horses/stableHorses.ts', { mocks })
  const { syncStableInteriorHorses } = loadTsModule('app/services/buildingInterior/StableInteriorHorses.ts', { mocks })
  const id = 'interior:stable'
  const cells = [0, 1, 2].map(i => ({ i, j: 0, solid: true }))
  const horses = ['black', 'brown', 'light'].map((horseColor, index) => ({
    family: 'animal',
    type: 'Horse',
    horseColor,
    spaceId: id,
    label: `${id}:stable-horse:${index}`,
    currentCell: cells[index],
    updateTexture() {},
    clear() {
      this.isDestroyed = true
      this.currentCell.has = null
      this.currentCell.solid = false
    },
  }))
  horses.forEach((horse, i) => {
    cells[i].has = horse
  })
  const building = { type: 'Stable', stableHorses: horses.map(({ horseColor }) => ({ horseColor })), horseAmount: 3 }
  const space = { id, kind: 'interior', building, sleepCells: cells }
  const map = {
    spaces: new Map([[id, space]]),
    gaia: {
      animals: horses,
      createAnimal() {
        throw new Error('Unexpected respawn')
      },
    },
  }
  const context = {
    map,
    syncStableInteriorHorses() {
      syncStableInteriorHorses(context, space)
    },
  }
  building.context = context
  return { detachStableInteriorHorse, syncStableInteriorHorses, horses, building, space, map, context }
}

test('taking the first stored horse preserves its color and the remaining physical horses', () => {
  const { detachStableInteriorHorse, horses, building, map, context, space, syncStableInteriorHorses } = setup()
  assert.equal(detachStableInteriorHorse(horses[0], map).horseColor, 'black')
  assert.equal(horses[0].horseColor, 'black')
  assert.equal(horses[0].isDestroyed, undefined)
  assert.equal(horses[1].label, `${space.id}:stable-horse:0`)
  assert.equal(horses[1].horseColor, 'brown')
  assert.equal(horses[2].horseColor, 'light')
  assert.equal(building.horseAmount, 2)
  syncStableInteriorHorses(context, space)
  assert.equal(detachStableInteriorHorse(horses[0], map), null)
  assert.equal(building.horseAmount, 2)
})

test('a dead assigned horse leaves stock once and keeps its corpse on later visits', () => {
  const { detachStableInteriorHorse, horses, building, map, context, space, syncStableInteriorHorses } = setup()
  horses[1].isDead = true
  detachStableInteriorHorse(horses[1], map)
  syncStableInteriorHorses(context, space)
  assert.equal(horses[1].isDestroyed, undefined)
  assert.equal(horses[1].horseColor, 'brown')
  assert.deepEqual(
    building.stableHorses.map(horse => horse.horseColor),
    ['black', 'light']
  )
  assert.equal(building.horseAmount, 2)
  assert.equal(detachStableInteriorHorse(horses[1], map), null)
})

test('a companion physically inside the stable is never deducted from its stock', () => {
  const { detachStableInteriorHorse, building, map, space } = setup()
  const companion = { type: 'Horse', spaceId: space.id, label: 'companion-horse' }
  assert.equal(detachStableInteriorHorse(companion, map), null)
  assert.equal(building.horseAmount, 3)
})

test('interior horses render even when the matching outdoor coordinates are fogged', () => {
  const { updateInstanceRenderVisibility, instanceIsInPlayerSight } = loadTsModule('app/lib/grid/visibility.ts', {
    mocks: { '../../services/FogOfWar': { updateVisibility() {} } },
  })
  const id = 'interior:stable'
  const map = { grid: [[]], size: 5, activeSpaceId: id, spaces: new Map() }
  map.spaces.set(id, { id, kind: 'interior', grid: [[]], size: 5, container: { x: 0, y: 0 } })
  const player = { views: { isVisible: () => false } }
  const horse = {
    type: 'Horse',
    family: 'animal',
    spaceId: id,
    i: 1,
    j: 1,
    x: 10,
    y: 10,
    owner: { isPlayed: false },
    context: { map, player, controls: { instanceInCamera: () => true } },
  }
  assert.equal(updateInstanceRenderVisibility(horse), true)
  assert.equal(instanceIsInPlayerSight(horse, player), true)
  map.activeSpaceId = null
  assert.equal(updateInstanceRenderVisibility(horse), false)
})

test('crossing the stable exit removes assignment before the horse enters the outside map', () => {
  const { horses, building, map, space } = setup()
  const { moveEntityToMapSpace } = loadTsModule('app/lib/mapSpaces.ts')
  const outsideCell = {
    i: 0,
    j: 0,
    z: 0,
    place(entity) {
      this.has = entity
    },
  }
  Object.assign(map, { grid: [[outsideCell]], size: 0, updateInstanceBucket() {} })
  const container = {
    addChild(entity) {
      entity.parent = this
    },
    sortChildren() {},
  }
  map.addChild = container.addChild
  const outside = { id: 'outside', kind: 'outside', size: 0, grid: map.grid, container }
  map.spaces.set('outside', outside)
  Object.assign(space, { grid: horses.map(horse => [horse.currentCell]), size: 2, container })
  moveEntityToMapSpace(map, horses[0], outside, outsideCell)
  assert.equal(horses[0].spaceId, undefined)
  assert.equal(horses[0].currentCell, outsideCell)
  assert.equal(building.horseAmount, 2)
  assert.equal(horses[1].horseColor, 'brown')
  assert.equal(horses[2].horseColor, 'light')
})
