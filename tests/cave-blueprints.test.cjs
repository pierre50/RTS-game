const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { generateCaves } = require('../tools/generate-cave-maps.cjs')
const { createCave, validateCave, VARIANTS } = require('../tools/caves/layout.cjs')
const { planCaves } = require('../tools/caves/placement.cjs')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('seven reproducible connected cave blueprints with PNG previews and an exact 32/64 cell extent', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cave-blueprints-'))
  try {
    const entries = generateCaves({ out, seed: 123 })
    assert.equal(entries.length, 7)
    const first = fs.readFileSync(path.join(out, 'catalog.json'), 'utf8')
    generateCaves({ out, seed: 123 })
    assert.equal(fs.readFileSync(path.join(out, 'catalog.json'), 'utf8'), first)
    const masks = new Set()
    for (const entry of entries) {
      const blueprint = JSON.parse(fs.readFileSync(path.join(out, entry.path)))
      assert.ok(validateCave(blueprint) > 10)
      if (entry.tier !== 'small') assert.equal(blueprint.size + 1, entry.tier === 'medium' ? 32 : 64)
      masks.add(blueprint.floorMask)
      const png = fs.readFileSync(path.join(out, entry.path.replace('.map', '.png')))
      assert.equal(png.subarray(1, 4).toString(), 'PNG')
    }
    assert.equal(masks.size, 7)
    for (let seed = 0; seed < 20; seed++)
      for (const tier of ['medium', 'large']) {
        for (const variant of VARIANTS) validateCave(createCave(tier, variant, seed))
      }
  } finally {
    fs.rmSync(out, { recursive: true, force: true })
  }
})

function outdoor(seed) {
  return {
    size: 79,
    seed,
    terrain: Array.from({ length: 80 }, () => Array(80).fill('Dirt')),
    relief: Array.from({ length: 80 }, () => Array(80).fill(0)),
    resources: [],
    spawns: [{ i: 5, j: 5 }],
  }
}

test('offline placement is deterministic, avoids starts and blocked terrain, and chooses sizes before variants', () => {
  const counts = { small: 0, medium: 0, large: 0 }
  for (let seed = 0; seed < 300; seed++) {
    const blueprint = outdoor(seed)
    const result = planCaves(blueprint)
    assert.deepEqual(planCaves(outdoor(seed)), result)
    assert.equal(result.length, 1)
    assert.ok(Math.hypot(result[0].i - 5, result[0].j - 5) >= 18)
    counts[result[0].tier]++
  }
  for (const count of Object.values(counts)) assert.ok(count > 65 && count < 135, JSON.stringify(counts))
  const water = outdoor(1)
  water.terrain.forEach(row => row.fill('Water'))
  assert.deepEqual(planCaves(water), [])
})

test('runtime decodes the assigned cave without a random draw or reshaping its layout', () => {
  const catalog = require('../public/maps/interiors/cave/catalog.json')
  const { getCaveInteriorBlueprint } = loadTsModule('app/lib/buildings/caveBlueprint.ts', {
    mocks: { 'pixi.js': { Assets: { cache: { get: () => catalog } } } },
  })
  const { createSquareLocalBlueprint } = loadTsModule('app/classes/map/generation/LocalMapBlueprint.ts')
  for (const payload of catalog.blueprints) {
    const blueprint = getCaveInteriorBlueprint({ cave: { blueprintId: payload.id, seed: 99 } })
    assert.equal(blueprint.seed, 99)
    assert.equal(blueprint.size, payload.size)
    assert.equal(createSquareLocalBlueprint(blueprint), blueprint)
  }
  assert.throws(() => getCaveInteriorBlueprint({ cave: { blueprintId: 'missing' } }), /Missing cave blueprint/)
})
