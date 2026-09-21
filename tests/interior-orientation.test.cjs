const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { mirrorInteriorBlueprint } = loadTsModule('app/lib/buildings/interiorOrientation.ts')
const { getInteriorWallGeometry } = loadTsModule('app/lib/terrain/interiorWallGeometry.ts')
const catalog = require('../public/maps/interiors/cave/catalog.json')
const { decodeInteriorPayload } = loadTsModule('app/serialization/InteriorBlueprintLoader.ts')

test('reflection keeps cave floor, slopes, minerals, doors and walls aligned without mutating the catalog', () => {
  for (const payload of catalog.blueprints) {
    const source = decodeInteriorPayload(
      payload,
      { blueprint: { id: payload.id, size: payload.size, path: payload.id } },
      'Cave'
    )
    const original = structuredClone(source)
    const mirrored = mirrorInteriorBlueprint(source)
    assert.deepEqual(source, original)
    assert.deepEqual(mirrorInteriorBlueprint(mirrored), source)
    for (const node of mirrored.resources) assert.equal(mirrored.floorMask[node.i][node.j], 1)
    for (const exit of mirrored.exits) {
      assert.equal(mirrored.floorMask[exit.i][exit.j], 1)
      assert.ok(!mirrored.walls.some(wall => wall.i === exit.i && wall.j === exit.j))
    }
    source.walls.forEach((wall, index) => {
      const normal = getInteriorWallGeometry(source, wall)
      const reflected = getInteriorWallGeometry(mirrored, mirrored.walls[index])
      const vertices = normal.polygon.map(([x, y]) => [-x || 0, y]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
      assert.deepEqual(
        reflected.polygon.sort((a, b) => a[0] - b[0] || a[1] - b[1]),
        vertices
      )
    })
  }
})
