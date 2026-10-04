const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { point, reliefMap } = require('./helpers/reliefFixture.cjs')
const moduleCache = new Map()
const load = path => loadTsModule(path, { moduleCache })
const { registerFurnitureSurface, removeFurnitureSurface } = load('app/lib/terrain/furnitureSurface.ts')
const { getReliefLevelAtPoint: height } = load('app/lib/terrain/reliefSurface.ts')
const { getReliefMovementDistance } = load('app/lib/terrain/reliefMovement.ts')
const { isBuildingTraversable } = load('app/lib/buildings/buildingTraversal.ts')
const config = require('../public/assets/data/gameplay/buildings.json')
const atlas = require('../public/assets/graphics/structures/decorations/texture.json')
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)
const localPoint = (x, y) => ({ x, y: point(4, 4).y + y })

function fixture() {
  const map = reliefMap(() => 2)
  const bed = { type: 'CampBedroll', i: 4, j: 4, size: config.CampBedroll.size, isBuilt: true }
  const cells = []
  for (let i = 3; i < 5; i++)
    for (let j = 3; j < 5; j++) {
      cells.push(map.grid[i][j])
      registerFurnitureSurface(map.grid[i][j], bed)
    }
  return { map, bed, cells }
}

test('bed keeps its 2x2 placement but walking follows the anchored mattress artwork', () => {
  assert.equal(config.CampBedroll.size, 2)
  assert.equal(isBuildingTraversable('CampBedroll'), true)
  const frame = atlas.frames['000_graphics_buildings_bedroll.png']
  assert.deepEqual(frame.sourceSize, { w: 144, h: 96 })
  assert.equal(frame.anchor.x * 144, 72)
  assert.ok(Math.abs(frame.anchor.y * 96 - 80) < 0.001)
  const { map } = fixture()
  // Visible mattress centre (71,60), relative to anchor (72,80), plus 8px lift.
  near(height(map, localPoint(-1, -12)), 2.5)
  for (const [x, y] of [
    [-47, -12],
    [45, -12],
    [-1, -35],
    [-1, 11],
  ])
    near(height(map, localPoint(x, y)), 2)
  // The old logical footprint centre and its far cell are visibly below the bed.
  near(height(map, point(4.5, 4.5)), 2)
  near(height(map, point(5, 5)), 2)
  // The back of the real mattress is covered by the rear placement cells.
  assert.ok(height(map, localPoint(-1, -23)) > 2)
})

test('mattress height is continuous across neighbouring cells and mirrors with the sprite', () => {
  const { map, bed } = fixture()
  for (const axis of ['i', 'j']) {
    for (let other = 2.5; other <= 5.5; other += 0.125) {
      const a = axis === 'i' ? point(3.5 - 1e-7, other) : point(other, 3.5 - 1e-7)
      const b = axis === 'i' ? point(3.5 + 1e-7, other) : point(other, 3.5 + 1e-7)
      assert.ok(Math.abs(height(map, a) - height(map, b)) < 1e-5)
    }
  }
  for (let x = -60; x <= 60; x += 3)
    for (let y = -40; y <= 20; y += 3) {
      bed.placementMirrored = false
      const expected = height(map, localPoint(x, y))
      bed.placementMirrored = true
      near(height(map, localPoint(-x, y)), expected)
    }
})

test('bed height survives unit occupancy and disappears on removal or destruction', () => {
  const { map, bed, cells } = fixture()
  const center = localPoint(-1, -12)
  cells[0].has = { type: 'Villager' }
  near(height(map, center), 2.5)
  bed.isBuilt = false
  near(height(map, center), 2)
  bed.isBuilt = true
  bed.isDead = true
  near(height(map, center), 2)
  bed.isDead = false
  for (const cell of cells) removeFurnitureSurface(cell, bed)
  near(height(map, center), 2)
})

test('bed has a short eased step then a flat top, without slowing entry or exit', () => {
  const { map } = fixture()
  const normal = { x: 1 / Math.sqrt(5), y: 2 / Math.sqrt(5) }
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const edge = localPoint(-1 + sx * 23, -12 + sy * 11.5)
      const inward = distance => ({
        x: edge.x - sx * normal.x * distance,
        y: edge.y - sy * normal.y * distance,
      })
      near(height(map, inward(-1)), 2)
      near(height(map, inward(0)), 2)
      near(height(map, inward(1.5)), 2.25)
      near(height(map, inward(3)), 2.5)
      near(height(map, inward(6)), 2.5)
      for (const [from, to] of [
        [inward(-2), inward(6)],
        [inward(6), inward(-2)],
      ]) {
        near(getReliefMovementDistance(map, from, to, 4), 4)
      }
    }
})

test('furniture does not change terrain slope costs underneath it', () => {
  const { map, bed, cells } = fixture()
  for (const row of map.grid) for (const cell of row) cell.z = cell.i >= 5 ? 2 : 1
  const from = point(3.6, 4)
  const to = point(4.4, 4)
  const budget = Math.hypot(to.x - from.x, to.y - from.y)
  const withBed = getReliefMovementDistance(map, from, to, budget)
  for (const cell of cells) removeFurnitureSurface(cell, bed)
  near(getReliefMovementDistance(map, from, to, budget), withBed)
  assert.ok(withBed < budget)
})
