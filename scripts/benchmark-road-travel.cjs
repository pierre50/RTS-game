// Headless CPU benchmark: real routing/travel/economy, rendering and movement adapters stubbed.
const assert = require('node:assert/strict')
const { performance } = require('node:perf_hooks')
const { fixture } = require('../tests/helpers/roadTravelFixture.cjs')
const { fixture: villageFixture, advance, setUnitSuspension } = require('../tests/helpers/distantEconomyFixture.cjs')

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    meanMs: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(3),
    p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(3),
    maxMs: +sorted.at(-1).toFixed(3),
  }
}
function run(count, villageCount = 8, ticks = 600, distinctDepartures = false) {
  const f = fixture({ length: 1000, realPlanner: true })
  f.context.controls.heroUnit = { i: 5000, j: 5000 }
  const owners = Array.from({ length: 8 }, (_, n) => ({
    ...f.owner,
    label: `owner-${n}`,
    isPlayed: n === 0,
    units: [],
    buildings: [],
  }))
  for (const owner of owners) owner.buildings.push({ ...f.town, owner, label: `town-${owner.label}` })
  f.context.players = owners
  const actors = Array.from({ length: count }, (_, n) => {
    const owner = owners[n % owners.length]
    const actor = {
      ...f.unit,
      owner,
      label: `traveler-${n}`,
      i: distinctDepartures ? n % 200 : n % 30,
      j: 3 + (distinctDepartures ? Math.floor(n / 200) : n % 20),
      path: [],
    }
    owner.units.push(actor)
    assert.equal(f.system.start(actor, owner.buildings[0]), true)
    return actor
  })
  const departures = actors.map(actor => ({ i: actor.i, j: actor.j }))
  const villages = Array.from({ length: villageCount }, (_, v) => {
    const g = villageFixture()
    g.context.map.revealEverything = true
    g.store.inventory.resources = {}
    g.worker.inventory.resources = {}
    g.owner.buildings.push({
      label: `project-${v}`,
      type: 'House',
      family: 'building',
      i: 47,
      j: 45,
      isBuilt: false,
      hitPoints: 1,
      constructionMaterials: { cost: { wood: 100000 }, consumed: {}, delivered: {} },
    })
    for (let n = 1; n < 20; n++) {
      const worker = {
        ...g.worker,
        label: `v${v}-worker-${n}`,
        i: 35 + (n % 10),
        j: 35 + Math.floor(n / 10),
        inventory: { resources: {} },
        autonomousJob: n % 2 ? 'food' : 'wood',
        work: n % 2 ? 'forager' : 'woodcutter',
      }
      g.owner.units.push(worker)
      setUnitSuspension(worker, { reason: 'distant-work', wake() {} })
    }
    g.sources = [
      { type: 'Tree', family: 'resource', label: `tree-${v}`, i: 43, j: 40, quantity: 10000, hitPoints: 0 },
      {
        type: 'Berrybush',
        family: 'resource',
        label: `berries-${v}`,
        i: 44,
        j: 40,
        quantity: 10000,
        isDead: false,
        hitPoints: 1,
        inventory: { resources: { meat: 10000 } },
      },
    ]
    for (const source of g.sources) g.context.map.grid[source.i][source.j].has = source
    return g
  })
  const planning = []
  // Use real cooperative generators, exclude compilation and world setup.
  for (let n = 0; n < 30000 && [...f.system.journeys.values()].some(s => s.search); n++) {
    const before = performance.now()
    f.tick(0)
    planning.push(performance.now() - before)
  }
  assert.equal([...f.system.journeys.values()].filter(s => s.search).length, 0, 'all searches must finish')
  assert.equal(f.messages.length, 0)
  assert.equal(f.system.journeys.size, count)
  const combined = [],
    travel = [],
    economy = []
  for (let n = 0; n < ticks; n++) {
    let before = performance.now()
    f.tick(50)
    const travelMs = performance.now() - before
    travel.push(travelMs)
    let economyMs = 0
    // Stagger villages: one real economic checkpoint each second.
    if (villages.length && n % 20 === 0) {
      const g = villages[(n / 20) % villages.length]
      before = performance.now()
      advance(g, g.last ?? 0, (n + 1) * 50)
      g.last = (n + 1) * 50
      economyMs = performance.now() - before
      economy.push(economyMs)
    }
    combined.push(travelMs + economyMs)
  }
  assert.ok(
    actors.every((actor, index) => actor.i !== departures[index].i || actor.j !== departures[index].j),
    'every owner makes progress'
  )
  const harvest = villages.reduce(
    (sum, g) => ({
      wood: sum.wood + 10000 - g.sources[0].quantity,
      berry: sum.berry + 10000 - g.sources[1].quantity,
    }),
    { wood: 0, berry: 0 }
  )
  if (ticks >= 600 && villageCount)
    assert.ok(harvest.wood + harvest.berry > 0, 'economic workload must actually harvest resources')
  f.system.destroy()
  return {
    travelers: count,
    distinctDepartures,
    villages: villageCount,
    workers: villageCount * 20,
    harvest,
    planning: {
      ...stats(planning),
      updates: planning.length,
      estimatedQueueSecondsAt20Hz: +(planning.length / 20).toFixed(2),
      totalMs: +planning.reduce((a, b) => a + b, 0).toFixed(1),
    },
    travel: stats(travel),
    economy: economy.length ? stats(economy) : null,
    combined: stats(combined),
  }
}
if (require.main === module) {
  console.info = (...args) => console.error(...args)
  const results = [...[100, 500, 1000].map(count => run(count)), run(1000, 8, 600, true)]
  console.log(
    JSON.stringify({ node: process.version, platform: `${process.platform}/${process.arch}`, results }, null, 2)
  )
}
module.exports = { run }
