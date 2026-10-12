const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { buildingInventory, mapInventory } = require('../tools/economy/model.cjs')
const { parseArgs, buildAudit, main } = require('../tools/economy-audit.cjs')
const { renderReport } = require('../tools/economy/report.cjs')
const definitions = { Tree: { totalQuantity: 180 }, Stone: { totalQuantity: 95 } }
const map = () => ({
  format: 'map-blueprint',
  version: 2,
  id: 'fixture',
  size: 1,
  terrain: [
    [0, 2],
    [255, 0],
  ],
  resources: [],
})

test('audit reuses level resolution and charges only positive upgrade differences', () => {
  const result = buildingInventory({
    House: {
      cost: { wood: 40, stone: 10 },
      shelterCapacity: 5,
      constructionTime: 48,
      totalHitPoints: 75,
      levelStats: {
        1: { cost: { wood: 30, stone: 30 }, shelterCapacity: 10 },
        2: { cost: { wood: 90, stone: 45 }, shelterCapacity: 10, totalHitPoints: 188 },
      },
    },
  })
  assert.deepEqual(result.upgrades[0].cost, { stone: 20 })
  assert.deepEqual(result.upgrades[0].costPerAddedShelterPlace, { stone: 4 })
  assert.equal(result.upgrades[1].costPerAddedShelterPlace, null)
  assert.equal(result.buildings[1].hitPoints, 75)
  assert.equal(result.findings.length, 1)
})
test('audit uses explicit renovation prices independently of construction prices', () => {
  const buildings = require('../public/assets/data/gameplay/buildings.json')
  const result = buildingInventory(buildings)
  for (const upgrade of result.upgrades) {
    assert.deepEqual(upgrade.cost, buildings[upgrade.type].levelStats[upgrade.toLevel].upgradeCost)
    assert.ok(Object.values(upgrade.cost).some(amount => amount > 0))
  }
  const house = result.upgrades.find(row => row.type === 'House' && row.fromLevel === 0)
  assert.deepEqual(house.costPerAddedShelterPlace, { wood: 8, stone: 6, fiber: 1.2 })
  assert.deepEqual(buildings.House.cost, { wood: 40, stone: 10 })
})
test('catalogue retains absent costs and rejects invalid amounts', () => {
  assert.equal(buildingInventory({ Scenery: {} }).buildings[0].cost, null)
  assert.throws(() => buildingInventory({ House: { cost: { wood: -1 } } }), /Valeur invalide/)
})
test('density excludes padding, distinguishes water, preserves zero quantities and node overrides', () => {
  const result = mapInventory(
    map(),
    [
      { type: 'Tree', i: 0, j: 0, quantity: 0, totalQuantity: 20 },
      { type: 'Stone', i: 1, j: 1, quantity: 7 },
    ],
    definitions,
    1
  )
  assert.equal(result.cells, 3)
  assert.equal(result.landCells, 2)
  assert.equal(result.waterCells, 1)
  assert.equal(result.resources[0].quantity, 0)
  assert.equal(result.resources[0].capacity, 20)
  assert.equal(result.resources[1].quantity, 7)
  assert.equal(result.resources[1].per100LandCells, 350)
  assert.equal(result.zones.find(z => z.i === 1 && z.j === 1).quantities.stone, 7)
})
test('packed and array terrain yield identical inventories and defaults', () => {
  const source = map(),
    resources = [{ type: 'Tree', i: 0, j: 0 }]
  const packed = { ...source, terrain: Buffer.from([0, 2, 255, 0]).toString('base64') }
  assert.deepEqual(mapInventory(source, resources, definitions), mapInventory(packed, resources, definitions))
  assert.equal(mapInventory(source, resources, definitions).resources[0].defaultsUsed, 1)
})
test('unknown resources and malformed maps fail; invalid positions are explicitly excluded', () => {
  assert.throws(() => mapInventory(map(), [{ type: 'Missing' }], definitions), /inconnue/)
  assert.throws(() => mapInventory({ ...map(), terrain: 'AA==' }, [], definitions), /Dimensions/)
  assert.throws(() => mapInventory({ ...map(), version: 1 }, [], definitions), /version 2/)
  const result = mapInventory(
    map(),
    [
      { type: 'Tree', i: 1, j: 0 },
      { type: 'Tree', i: -1, j: 0 },
    ],
    definitions
  )
  assert.equal(result.resources[0].nodes, 0)
  assert.match(result.warnings[0], /exclues.*2/)
})
test('empty and all-water maps have defined null denominators, not Infinity or NaN', () => {
  const result = mapInventory(
    {
      ...map(),
      terrain: [
        [2, 2],
        [255, 255],
      ],
    },
    [],
    definitions
  )
  assert.equal(result.resources[0].per100LandCells, null)
  assert.equal(result.resources[0].per100Cells, 0)
})
test('CLI validates parameters', () => {
  assert.throws(() => parseArgs(['--zone-size', '0']), /entier positif/)
  assert.throws(() => parseArgs(['--map']), /manquante/)
  assert.throws(() => parseArgs(['--typo']), /inconnu/)
})
test('prepared resources replace raw resources and mismatched preparations fail', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'economy-audit-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'fixture.map')
  const source = { ...map(), resources: [{ type: 'Tree', i: 0, j: 0, quantity: 99 }] }
  fs.writeFileSync(file, JSON.stringify(source))
  const prepared = {
    format: 'prepared-settlements',
    version: 1,
    mapId: source.id,
    size: source.size,
    source: { sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') },
    resources: [{ type: 'Tree', i: 1, j: 1, quantity: 7 }],
  }
  const sidecar = file.replace('.map', '.settlements.json')
  fs.writeFileSync(sidecar, JSON.stringify(prepared))
  const report = buildAudit({ map: file, zoneSize: 64 })
  assert.equal(report.map.resources.find(r => r.type === 'Tree').quantity, 7)
  assert.match(report.mode, /préparée/)
  main(['--map', file, '--out', path.join(dir, 'report')])
  assert.ok(fs.statSync(path.join(dir, 'report/index.html')).size > 1000)
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'report/economy.json'))).map.cells, 3)
  report.map.id = '<script>alert("x")</script>'
  report.findings.push({ title: '<img src=x>', detail: '"&' })
  const html = renderReport(report)
  assert.match(html, /Durée estimée³/)
  assert.match(html, /1 h de jeu/)
  assert.match(html, /4 jours de jeu/)
  assert.match(html, /deux ouvriers novices/)
  assert.match(html, /Coûts explicites de rénovation/)
  const forgeDuration = report.upgrades.find(row => row.type === 'Forge').constructionDuration
  assert.equal(forgeDuration.value, 4)
  assert.equal(forgeDuration.unit, 'days')
  assert.ok(!html.includes('<script>alert("x")</script>'))
  assert.ok(html.includes('&lt;img src=x&gt;'))
  fs.writeFileSync(file, JSON.stringify({ ...source, id: 'changed' }))
  assert.throws(() => buildAudit({ map: file, zoneSize: 64 }), /incompatible ou périmée/)
})

test('craft catalogue uses exact batches, cultural restrictions and recursively includes ingot fuel', () => {
  const { craftCatalogue, technologyCatalogue } = require('../tools/economy/catalogue.cjs')
  const recipes = craftCatalogue()
  const bronze = recipes.find(r => r.id === 'arrow_bronze')
  assert.equal(bronze.outputCount, 1)
  assert.deepEqual(bronze.rawCost, { wood: 0.7, copper: 0.2, tin: 0.1 })
  assert.equal(bronze.costPerOutput.wood, 0.5)
  assert.ok(recipes.some(r => r.civilizations.length < 8))
  assert.equal(new Set(recipes.map(r => r.id)).size, recipes.length)
  const tiers = technologyCatalogue()
  assert.equal(tiers[0].canMineIron, false)
  assert.equal(tiers.find(t => t.tier === 2).canMineIron, true)
  assert.equal(tiers.find(t => t.tier === 3).buildMultiplier, 1.75)
  assert.equal(tiers.find(t => t.tier === 3).woodBonus, 3)
})
test('captures reject non-finite, unknown and inconsistent input rather than displaying false measurements', () => {
  const { validateCapture } = require('../tools/economy/capture.cjs')
  const valid = {
    format: 'economy-flow-capture',
    version: 1,
    active: false,
    startedAtMs: 0,
    endedAtMs: 10,
    elapsedMs: 10,
    rows: [],
    stocks: [],
    offlineWindows: [],
    incomplete: false,
  }
  assert.equal(validateCapture(valid), valid)
  assert.throws(() => validateCapture({ ...valid, elapsedMs: Infinity }), /invalide/)
  assert.throws(() => validateCapture({ ...valid, elapsedMs: 20 }), /invalide/)
  assert.throws(
    () =>
      validateCapture({ ...valid, rows: [{ mode: 'live', player: 'p', kind: 'fake', resource: 'wood', amount: 1 }] }),
    /invalide/
  )
})

test('audit reports the real storage capacity for each depot level', () => {
  const definitions = require('../public/assets/data/gameplay/buildings.json')
  const { buildings } = buildingInventory(definitions)
  for (const type of ['StoragePit', 'Granary']) {
    assert.deepEqual(
      buildings.filter(building => building.type === type).map(building => building.storageCapacity),
      type === 'StoragePit' ? [300, 900] : [300, 600, 900]
    )
  }
})
