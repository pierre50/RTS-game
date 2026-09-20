const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const { createInteriorWalls } = require('../tools/maps/interior-walls.cjs')
const { buildingInterior } = require('../tools/generate-interior-maps.cjs')
const { createCave, VARIANTS } = require('../tools/caves/layout.cjs')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const sides = [
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, 0],
]

test('every exposed floor edge has a wall, except every side of an exit', () => {
  const maps = [buildingInterior({ buildingSize: 2, id: 'test', seed: 123, size: 11 })]
  for (const tier of ['small', 'medium', 'large'])
    for (const variant of tier === 'small' ? ['circle'] : VARIANTS) maps.push(createCave(tier, variant, 4242))
  const { createInteriorWallEdges } = loadTsModule('app/lib/buildings/interiorWalls.ts')
  for (const map of maps) {
    const width = map.size + 1
    const floor = Buffer.from(map.floorMask, 'base64')
    const grid = Array.from({ length: width }, (_, i) => Array.from(floor.subarray(i * width, (i + 1) * width)))
    assert.deepEqual(map.walls, createInteriorWallEdges(grid, map.size, map.exits))
    const keys = new Set(map.walls.map(wall => `${wall.i},${wall.j},${wall.side}`))
    assert.equal(keys.size, map.walls.length)
    assert.ok(keys.size > 0)
    for (let i = 0; i < width; i++)
      for (let j = 0; j < width; j++) {
        let missing = 0
        for (let side = 0; side < 4; side++) {
          const [di, dj] = sides[side]
          const exposed = grid[i][j] === 1 && grid[i + di]?.[j + dj] !== 1
          const hasWall = keys.has(`${i},${j},${side}`)
          if (hasWall) assert.ok(!map.exits.some(exit => exit.i === i && exit.j === j))
          if (hasWall) assert.ok(exposed, `${map.id}: wall crosses floor`)
          if (exposed && !hasWall) missing++
        }
        assert.ok(missing === 0 || map.exits.some(exit => exit.i === i && exit.j === j))
      }
  }
})

test('isolated corner exit opens all four sides', () => {
  assert.deepEqual(createInteriorWalls([1], 1, [{ i: 0, j: 0 }]), [])
})

test('atlas keeps every panel inside the original PNG', () => {
  const atlas = JSON.parse(fs.readFileSync('public/assets/terrain/interior-walls/texture.json'))
  const png = fs.readFileSync('public/assets/terrain/interior-walls/texture.png')
  assert.equal(png.readUInt32BE(16), atlas.meta.size.w)
  assert.equal(png.readUInt32BE(20), atlas.meta.size.h)
  assert.equal(Object.keys(atlas.frames).length, 5)
  for (const { frame } of Object.values(atlas.frames)) {
    assert.ok(frame.x + frame.w <= atlas.meta.size.w)
    assert.ok(frame.y + frame.h <= atlas.meta.size.h)
  }
})

test('low wall atlas frames have native pixel dimensions for every slope', () => {
  for (const variant of ['wood', 'dirt']) {
    const directory = `public/assets/terrain/interior-walls/${variant}`
    const atlas = JSON.parse(fs.readFileSync(`${directory}/texture.json`))
    const png = fs.readFileSync(`${directory}/texture.png`)
    assert.equal(png.readUInt32BE(16), atlas.meta.size.w)
    assert.equal(png.readUInt32BE(20), atlas.meta.size.h)
    const frames = Object.values(atlas.frames)
    assert.equal(frames.length, 10)
    assert.deepEqual(
      frames.slice(5).map(({ frame }) => [frame.w, frame.h]),
      [
        [33, 41],
        [65, 25],
        [33, 57],
        [33, 41],
        [33, 25],
      ]
    )
    for (const { frame } of frames) {
      assert.ok(frame.x + frame.w <= atlas.meta.size.w)
      assert.ok(frame.y + frame.h <= atlas.meta.size.h)
    }
  }
})

test('wall panels align with the four floor edges and sort around occupants', () => {
  class Sprite {
    constructor(texture) {
      this.texture = texture
      this.scale = { x: 1, y: 1 }
    }
    addChild(child) {
      return child
    }
  }
  const { addInteriorWalls } = loadTsModule('app/lib/graphics/interiorWalls.ts', {
    mocks: {
      'pixi.js': { Sprite, Assets: {} },
      './textures': { getTextureByFrame: (sheet, frame) => ({ sheet, frame }) },
    },
  })
  const children = []
  addInteriorWalls(
    { floorMask: [[1]], walls: [0, 1, 2, 3].map(side => ({ i: 0, j: 0, side })) },
    {
      addChild: child => children.push(child),
    }
  )
  assert.deepEqual(
    children.map(child => [child.texture.frame, child.x, child.y, child.zIndex]),
    [
      [3, -32, -116, -0.5],
      [0, 0, -116, -0.5],
      [5, -32, -24, 0.5],
      [8, 0, -24, 0.5],
    ]
  )
  assert.ok(children.every(child => child.eventMode === 'none'))
  assert.ok(children.every(child => child.alpha === 1))
  assert.ok(children.every(child => !child.mask))
  assert.deepEqual(
    children.map(child => child.height),
    [117, 117, 41, 41]
  )
  assert.ok(children.every(child => child.texture.sheet === 'terrain/interior-walls/wood'))
  const caveChildren = []
  addInteriorWalls(
    { interiorType: 'Cave', floorMask: [[1]], walls: [{ i: 0, j: 0, side: 0 }] },
    { addChild: child => caveChildren.push(child) }
  )
  assert.equal(caveChildren[0].texture.sheet, 'terrain/interior-walls/dirt')
})

test('north-facing walls are detected when they cover floor behind a recess, including relief', () => {
  const { getInteriorWallGeometry } = loadTsModule('app/lib/terrain/interiorWallGeometry.ts')
  const { createInteriorWallOcclusionCheck } = loadTsModule('app/lib/terrain/interiorWallOcclusion.ts')
  function check(side, behind, wallElevation = 0) {
    const floorMask = Array.from({ length: 8 }, () => Array(8).fill(0))
    const relief = floorMask.map(row => [...row])
    floorMask[5][5] = 1
    relief[5][5] = wallElevation
    if (behind) floorMask[behind[0]][behind[1]] = 1
    const blueprint = { floorMask, relief }
    return createInteriorWallOcclusionCheck(blueprint)(getInteriorWallGeometry(blueprint, { i: 5, j: 5, side }))
  }
  for (const side of [0, 1]) {
    assert.equal(check(side, [4, 4]), true, 'floor behind either north-facing panel')
    assert.equal(check(side, [4, 4], 1), true, 'raised wall still overlaps the lower floor')
    assert.equal(check(side, null), false, 'outer perimeter faces only void')
    assert.equal(check(side, [0, 0]), false, 'floor farther away than the wall height')
    assert.equal(check(side, [1, 5]), false, 'floor outside the wall screen footprint')
    assert.equal(check(side, [6, 6]), false, 'floor in front of the wall')
    assert.equal(check(side, [4, 4], 20), false, 'elevation moves the wall clear of the floor')
  }
})
