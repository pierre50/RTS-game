const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function createContainer(label) {
  return {
    children: [],
    label,
    addChild(...children) {
      this.children.push(...children)
      for (const child of children) child.parent = this
      return children[0]
    },
    removeChild(child) {
      this.children = this.children.filter(candidate => candidate !== child)
      child.parent = null
      return child
    },
    sortChildren() {
      this.sorted = true
    },
  }
}

function createCell(i, j) {
  return {
    i,
    j,
    solid: false,
    z: 0,
    place(entity) {
      this.has = entity
    },
  }
}

function createMap() {
  const map = createContainer('map')
  const outsideShadowLayer = createContainer('outside-shadow-source')
  const grid = [[createCell(0, 0)]]
  return Object.assign(map, {
    grid,
    instanceBuckets: null,
    mapType: 'test',
    shadowLayer: outsideShadowLayer,
    size: 0,
    spaces: new Map(),
  })
}

const {
  addDisplayObjectToMapSpaceContainer,
  attachEntityShadowsToMapSpace,
  ensureOutsideMapSpace,
  getEntitySpaceGrid,
  moveEntityToMapSpace,
} = loadTsModule('app/lib/mapSpaces.ts', {
  mocks: {
    '../constants': { BUCKET_SIZE: 8, CELL_HEIGHT: 32, CELL_WIDTH: 64 },
  },
})

test('space-aware helpers resolve the grid and container for plain display objects', () => {
  const map = createMap()
  const interior = {
    container: createContainer('interior-entities'),
    grid: [[createCell(0, 0), createCell(0, 1)]],
    id: 'interior:test',
    kind: 'interior',
    origin: { x: 100, y: 50 },
    size: 1,
  }
  map.spaces.set(interior.id, interior)
  const display = { label: 'projectile', spaceId: interior.id }

  addDisplayObjectToMapSpaceContainer(map, display)

  assert.equal(display.parent, interior.container)
  assert.equal(getEntitySpaceGrid({ context: { map }, spaceId: interior.id }), interior.grid)
  assert.equal(interior.container.sorted, true)
})

test('entity shadows attach to the entity runtime map space shadow source', () => {
  const map = createMap()
  const outside = ensureOutsideMapSpace(map)
  const interiorShadowLayer = createContainer('interior-shadow-source')
  const interior = {
    container: createContainer('interior-entities'),
    grid: [[createCell(0, 0)]],
    id: 'interior:test',
    kind: 'interior',
    origin: { x: 100, y: 50 },
    shadowLayer: interiorShadowLayer,
    shadowRenderContainer: createContainer('interior-scene'),
    size: 0,
  }
  map.spaces.set(interior.id, interior)
  const entity = {
    horseShadow: { label: 'horse-shadow' },
    shadow: { label: 'shadow' },
    spaceId: interior.id,
  }

  attachEntityShadowsToMapSpace(map, entity)

  assert.equal(entity.shadow.parent, interiorShadowLayer)
  assert.equal(entity.horseShadow.parent, interiorShadowLayer)
  assert.deepEqual(interiorShadowLayer.children, [entity.shadow, entity.horseShadow])

  delete entity.spaceId
  attachEntityShadowsToMapSpace(map, entity)

  assert.equal(entity.shadow.parent, outside.shadowLayer)
  assert.equal(entity.horseShadow.parent, outside.shadowLayer)
  assert.deepEqual(interiorShadowLayer.children, [])
})

test('moving an entity between runtime map spaces moves its detached shadows too', () => {
  const map = createMap()
  const sourceCell = map.grid[0][0]
  const targetCell = createCell(1, 1)
  sourceCell.has = null
  const interiorShadowLayer = createContainer('interior-shadow-source')
  const interior = {
    container: createContainer('interior-entities'),
    grid: [[null, null], [null, targetCell]],
    id: 'interior:test',
    kind: 'interior',
    origin: { x: 100, y: 50 },
    shadowLayer: interiorShadowLayer,
    shadowRenderContainer: createContainer('interior-scene'),
    size: 1,
  }
  map.spaces.set(interior.id, interior)
  const entity = {
    currentCell: sourceCell,
    i: 0,
    j: 0,
    label: 'villager',
    shadow: { label: 'shadow' },
    syncShadow() {
      this.shadowSynced = true
    },
  }
  sourceCell.has = entity

  moveEntityToMapSpace(map, entity, interior, targetCell)

  assert.equal(entity.spaceId, interior.id)
  assert.equal(entity.parent, interior.container)
  assert.equal(entity.shadow.parent, interiorShadowLayer)
  assert.equal(entity.shadowSynced, true)
  assert.equal(sourceCell.has, null)
  assert.equal(targetCell.has, entity)
})
