const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const test = require('node:test')

const ROOT = path.join(__dirname, '..')
const TERRAIN_TYPES = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest', 'Dirt', '', 'Snow']
const DIRT_INDEX = TERRAIN_TYPES.indexOf('Dirt')

test('town center interior generator writes an oval dirt blueprint', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'interior-blueprint-'))

  try {
    execFileSync(
      process.execPath,
      [
        path.join(ROOT, 'tools/generate-interior-maps.cjs'),
        '--type',
        'town-center',
        '--count',
        '1',
        '--seed',
        '12345',
        '--out',
        out,
      ],
      { cwd: ROOT, stdio: 'pipe' }
    )

    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'))
    assert.equal(manifest.format, 'interior-map-manifest')
    assert.equal(manifest.interiors.length, 1)
    assert.equal(manifest.interiors[0].interiorType, 'TownCenter')

    const blueprintPath = path.join(out, manifest.interiors[0].path)
    const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'))
    const expectedCells = (blueprint.size + 1) ** 2
    const terrain = Buffer.from(blueprint.terrain, 'base64')
    const relief = Buffer.from(blueprint.relief, 'base64')
    const floorMask = Buffer.from(blueprint.floorMask, 'base64')

    assert.equal(blueprint.kind, 'interior')
    assert.equal(blueprint.interiorType, 'TownCenter')
    assert.equal(blueprint.size, 15)
    assert.equal(blueprint.cellCount, expectedCells)
    assert.equal(terrain.length, expectedCells)
    assert.equal(relief.length, expectedCells)
    assert.equal(floorMask.length, expectedCells)
    assert.ok([...terrain].every(value => value === DIRT_INDEX))
    assert.ok([...relief].every(value => value === 0))
    assert.ok([...floorMask].some(value => value === 1))
    assert.ok([...floorMask].some(value => value === 0))
    assert.deepEqual(blueprint.spawns, [{ i: 8, j: 10 }])
    assert.deepEqual(blueprint.exits, [{ id: 'main', i: 8, j: 11, direction: 'south' }])
  } finally {
    fs.rmSync(out, { recursive: true, force: true })
  }
})
