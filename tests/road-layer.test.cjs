const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { readRoadLayer, roadAtlasFrame } = loadTsModule('app/lib/terrain/roadLayer.ts')
const layer = () => ({
  version: 1,
  stride: 4,
  cells: [
    [5, 2],
    [9, 9],
    [8, 4],
  ],
})

test('road snapshots retain exact connections without sharing mutable tuples', () => {
  const source = layer(),
    restored = readRoadLayer(JSON.parse(JSON.stringify(source)), 4)
  assert.deepEqual(restored, source)
  const cloned = readRoadLayer(source, 4)
  cloned.cells[0][1] = 15
  assert.equal(source.cells[0][1], 2)
  assert.equal(readRoadLayer(undefined, 4), undefined)
  assert.deepEqual(readRoadLayer({ version: 1, stride: 4, cells: [] }, 4).cells, [])
})
test('road validation rejects wrong dimensions, duplicate cells, invalid masks and wrapped edges', () => {
  for (const invalid of [
    null,
    { ...layer(), stride: 3 },
    { ...layer(), version: 2 },
    { ...layer(), cells: [[5, 16]] },
    { ...layer(), cells: [[5, 0]] },
    {
      ...layer(),
      cells: [
        [5, 2],
        [5, 2],
      ],
    },
    { ...layer(), cells: [[5, 2]] },
    {
      ...layer(),
      cells: [
        [3, 4],
        [4, 1],
      ],
    },
  ])
    assert.throws(() => readRoadLayer(invalid, 4))
})
test('every relief silhouette and connection resolves to a supplied atlas frame', () => {
  const atlas = JSON.parse(fs.readFileSync('public/assets/terrain/paths/texture.json'))
  const names = Object.keys(atlas.frames)
  for (let relief = 0; relief < 25; relief++)
    for (let mask = 1; mask < 16; mask++) {
      const frame = atlas.frames[names[roadAtlasFrame(relief, mask)]].frame
      assert.equal(frame.x, mask * 80)
      assert.equal(frame.w, 80)
      assert.equal(frame.h, 64)
    }
  assert.equal(roadAtlasFrame('014', 5), roadAtlasFrame(14, 5))
  assert.equal(roadAtlasFrame(11, 3), roadAtlasFrame(19, 3))
  assert.equal(roadAtlasFrame(12, 3), roadAtlasFrame(20, 3))
})
test('road sprite matches flat, compressed and raised terrain origins without rescaling the image', () => {
  class Sprite {
    constructor(texture) {
      this.texture = texture
    }
    anchor = {
      set: (x, y) => {
        this.ax = x
        this.ay = y
      },
    }
  }
  const { createRoadTerrainSprite } = loadTsModule('app/classes/map/terrain/RoadTerrainSprite.ts', {
    mocks: {
      'pixi.js': { Assets: {}, Sprite },
      '../../../lib': { getTextureByFrame: (sheet, frame) => ({ sheet, frame }) },
    },
  })
  for (const [frame, height] of [
    [0, 33],
    [9, 17],
    [10, 49],
    [11, 33],
  ]) {
    const s = createRoadTerrainSprite(5, frame, height)
    assert.equal(s.ax * 80 - 7, 32)
    assert.equal(s.ay * 64 - 7, Math.floor(height / 2))
    assert.equal(s.texture.frame, roadAtlasFrame(frame, 5))
    assert.ok(s.zIndex > 10, 'roads cover biome transition borders')
    assert.equal(s.eventMode, 'none')
  }
})
