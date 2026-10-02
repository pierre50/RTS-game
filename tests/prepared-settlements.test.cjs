const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { prepareSettlements } = require('../tools/maps/settlements/prepare-settlements.cjs')
const { settlementTerrain } = require('../tools/maps/settlements/settlement-terrain.cjs')
const { validateSettlements } = require('../tools/maps/settlements/validate-settlements.cjs')
const { main } = require('../tools/prepare-world-settlements.cjs')
const { settlementAnimalZones } = require('../tools/maps/settlements/settlement-animals.cjs')

function source() {
  return {
    format: 'map-blueprint',
    version: 2,
    id: 'fixture',
    seed: 321,
    size: 99,
    terrain: Array.from({ length: 100 }, () => Array(100).fill('Grass')),
    resources: [],
    animals: [],
    settlements: [{ id: 'village', kind: 'village', civ: 'Hellas', local: { i: 30, j: 30 } }],
    banditCampPositions: [
      {
        id: 'bandits',
        i: 80,
        j: 80,
        profile: 'small',
        seed: 23,
        unitTypes: ['BanditSword', 'BanditArcher', 'BanditChief'],
      },
    ],
  }
}

test('generator assigns age 2 to cities, age 1 to villages and age 0 to outposts', () => {
  const definitions = require('../public/assets/data/gameplay/buildings.json')
  const assets = require('../public/assets/data/civilizations/hellas.json')
  const { loadTsModule } = require('./helpers/loadTsModule.cjs')
  const { getBuildingAsset } = loadTsModule('app/lib/graphics/assets.ts')
  for (const [settlementType, level] of [
    ['city', 2],
    ['village', 1],
    ['outpost', 0],
  ]) {
    const input = source()
    input.settlements[0].settlementType = settlementType
    const prepared = prepareSettlements(input)
    const owner = prepared.players.find(player => player.type === 'AI')
    for (const building of owner.buildings) {
      const usesAgeAtlas = definitions[building.type].levelStats || building.type === 'Forge'
      assert.equal(building.buildingLevel, usesAgeAtlas ? level : 0, `${settlementType}: ${building.type}`)
      if (usesAgeAtlas) {
        const asset = getBuildingAsset(
          building.type,
          { level: building.buildingLevel },
          { cache: { get: () => assets } }
        )
        assert.equal(asset.images.final.sheet, `buildings/age-${level}`)
      }
    }
  }
})

test('wildlife in a settlement is moved outside without losing animals or changing the source', () => {
  const input = source()
  input.settlements[0].settlementType = 'city'
  input.animals = [
    { label: 'deer', type: 'Deer', i: 30, j: 30, hitPoints: 7 },
    { label: 'horse', type: 'Horse', i: 31, j: 30, horseColor: 'bay' },
    { label: 'distant', type: 'Deer', i: 95, j: 10 },
  ]
  const original = structuredClone(input)
  const prepared = prepareSettlements(input)
  assert.deepEqual(input, original)
  assert.deepEqual(prepareSettlements(input), prepared)
  assert.equal(prepared.animals.length, input.animals.length)
  const zones = settlementAnimalZones(prepared)
  for (const animal of prepared.animals.slice(0, 2)) {
    assert.ok(!zones.some(z => animal.i >= z.minI && animal.i <= z.maxI && animal.j >= z.minJ && animal.j <= z.maxJ))
  }
  const withoutAnimals = prepareSettlements({ ...input, animals: [] })
  assert.deepEqual(prepared.players, withoutAnimals.players)
  assert.deepEqual(prepared.resources, withoutAnimals.resources)
  assert.equal(prepared.animals[0].hitPoints, 7)
  assert.equal(prepared.animals[1].horseColor, 'bay')
  assert.deepEqual(prepared.animals[2], input.animals[2])
  validateSettlements(prepared, settlementTerrain(input))
})

test('prepared stables contain a seeded variable number of tamed horses within capacity', () => {
  const { stockSettlementStables } = require('../tools/maps/settlements/settlement-animals.cjs')
  const input = source()
  input.settlements[0].settlementType = 'city'
  const prepared = prepareSettlements(input)
  const stable = prepared.players.flatMap(p => p.buildings).find(b => b.type === 'Stable')
  assert.ok(stable)
  assert.equal(stable.stableHorses.length, stable.horseAmount)
  const counts = new Set()
  for (let seed = 0; seed < 30; seed++) {
    stockSettlementStables(prepared, seed)
    assert.ok(stable.horseAmount >= 3 && stable.horseAmount <= 5)
    assert.equal(stable.stableHorses.length, stable.horseAmount)
    assert.ok(stable.stableHorses.every(h => h.tamingStatus === 'tamed'))
    counts.add(stable.horseAmount)
  }
  assert.ok(counts.size > 1)
})

test('preparation is deterministic, preserves the source and includes stocked villages and bandit camps', () => {
  const input = source(),
    original = structuredClone(input)
  const first = prepareSettlements(input)
  assert.deepEqual(input, original)
  assert.deepEqual(prepareSettlements(input), first)
  assert.equal(first.summary.settlements, 1)
  assert.equal(first.summary.banditCamps, 1)
  const village = first.players.find(player => player.type === 'AI')
  assert.equal(
    village.buildings.some(building => building.type === 'TownCenter'),
    false
  )
  assert.equal(village.buildings.find(building => building.type === 'Granary').inventory.resources.wheat, 200)
  const bandits = first.players.find(player => player.type === 'Bandits')
  assert.equal(bandits.units.length, 3)
  assert.ok(bandits.buildings.some(building => building.type === 'Chest' && building.inventory.equipment.length))
  assert.ok(
    first.players.every(player => player.units.every(unit => !unit.dest && !unit.action && !unit.autonomousJob))
  )
})

test('validation rejects overlaps, excessive stocks and blocked entrances', () => {
  const input = source(),
    prepared = prepareSettlements(input),
    terrain = settlementTerrain(input)
  const overlap = structuredClone(prepared)
  overlap.players[0].units[1].i = overlap.players[0].units[0].i
  overlap.players[0].units[1].j = overlap.players[0].units[0].j
  assert.throws(() => validateSettlements(overlap, terrain), /Overlap/)
  const stock = structuredClone(prepared)
  stock.players.find(p => p.type === 'AI').buildings.find(b => b.type === 'Granary').inventory.resources.wheat = 99999
  assert.throws(() => validateSettlements(stock, terrain), /invalid depot stock/)
  const blocked = structuredClone(prepared)
  const center = blocked.players.find(p => p.type === 'AI').buildings.find(b => b.type === 'Granary')
  blocked.resources.push({
    type: 'Stone',
    i: center.i + (center.placementMirrored ? 2 : 1),
    j: center.j + (center.placementMirrored ? 1 : 2),
  })
  assert.throws(() => validateSettlements(blocked, terrain), /blocked entrance/)
})

test('cave camps retain their cave link and loot without creating an outdoor loot chest', () => {
  const input = source()
  input.caves = [{ id: 'cave-1', i: 75, j: 75 }]
  input.banditCampPositions[0].caveId = 'cave-1'
  input.banditCampPositions[0].profile = 'lair'
  const prepared = prepareSettlements(input)
  assert.equal(prepared.banditCamps[0].caveContent.caveId, 'cave-1')
  assert.ok(prepared.banditCamps[0].caveContent.inventory.resources)
  assert.equal(
    prepared.players.find(p => p.type === 'Bandits').buildings.some(b => b.type === 'Chest'),
    false
  )
  input.caves = []
  assert.throws(() => prepareSettlements(input), /missing cave/)
})

test('CLI check detects stale output without rewriting source or existing preparation', t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'rts-preparation-test-'))
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }))
  const file = path.join(folder, 'fixture.map'),
    output = path.join(folder, 'fixture.settlements.json')
  const raw = JSON.stringify(source())
  fs.writeFileSync(file, raw)
  main([file])
  const prepared = fs.readFileSync(output, 'utf8')
  main([file, '--check'])
  assert.equal(fs.readFileSync(file, 'utf8'), raw)
  fs.writeFileSync(file, raw + '\n')
  assert.throws(() => main([file, '--check']), /stale/)
  assert.equal(fs.readFileSync(output, 'utf8'), prepared)
})

test('unsupported terrain and invalid CLI flags fail explicitly', () => {
  assert.throws(() => settlementTerrain({ ...source(), version: 1 }), /Finalize/)
  assert.throws(() => settlementTerrain({ ...source(), terrain: 'AA==', relief: 'AA==' }), /dimensions/)
  assert.throws(() => main(['--unknown']), /Unknown argument/)
})

test('world preparation registers checksums and check detects a stale manifest without rewriting it', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prepared-world-'))
  try {
    fs.mkdirSync(path.join(directory, 'maps'))
    const mapPath = path.join(directory, 'maps', 'fixture.map')
    fs.writeFileSync(mapPath, JSON.stringify(source()))
    const manifestPath = path.join(directory, 'manifest.json')
    fs.writeFileSync(manifestPath, JSON.stringify({ maps: [{ path: 'fixture.map' }] }))
    main([directory])
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    assert.equal(manifest.maps[0].preparedSettlements.path, 'fixture.settlements.json')
    assert.equal(manifest.maps[0].preparedSettlements.sha256.length, 64)
    main([directory, '--check'])
    delete manifest.maps[0].preparedSettlements
    const stale = JSON.stringify(manifest)
    fs.writeFileSync(manifestPath, stale)
    assert.throws(() => main([directory, '--check']), /stale manifest/)
    assert.equal(fs.readFileSync(manifestPath, 'utf8'), stale)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('offline inhabitants are spread around buildings and fields with clear entrances', () => {
  const input = source()
  input.settlements[0].settlementType = 'city'
  const prepared = prepareSettlements(input)
  const owner = prepared.players.find(p => p.type === 'AI')
  const { loadGenerationTs } = require('../tools/maps/load-generation-ts.cjs')
  const { getBuildingInteriorEntryPosition } = loadGenerationTs('app/lib/buildings/interiors.ts')
  const config = require('../public/assets/data/gameplay/buildings.json')
  const { getBuildingFootprintCells } = loadGenerationTs('app/lib/grid/cells.ts')
  const terrain = settlementTerrain(input)
  const distance = (a, b) => Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j))
  const center = owner.buildings.find(b => b.type === 'TownCenter')
  assert.ok(owner.units.filter(u => distance(u, center) > 5).length > owner.units.length / 2)
  for (const building of owner.buildings) {
    const solid = getBuildingFootprintCells(
      building.i,
      building.j,
      terrain,
      building.size ?? config[building.type].size
    )
    assert.ok(
      owner.units.every(unit => solid.every(cell => distance(unit, cell) > 1)),
      `${building.label}: spawn on solid footprint or against a wall`
    )
    const entry = getBuildingInteriorEntryPosition({ ...config[building.type], ...building })
    if (entry) assert.ok(owner.units.every(u => distance(u, entry) > 0))
  }
  for (const farmer of owner.units.filter(u => u.type === 'Villager').slice(0, 4)) {
    assert.ok(prepared.resources.some(r => r.type === 'Wheat' && distance(r, farmer) <= 3))
  }
  for (const [index, unit] of owner.units.entries()) {
    assert.ok(distance(unit, center) <= 30)
    assert.ok(owner.units.slice(index + 1).every(other => distance(unit, other) >= 2))
  }
  assert.ok(
    distance(
      owner.units.find(u => u.type === 'Chief'),
      center
    ) <= 5
  )
})
