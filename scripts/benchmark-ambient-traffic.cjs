// CPU-only benchmark; unit rendering, sound and local movement are stubbed.
const { performance } = require('node:perf_hooks')
const assert = require('node:assert/strict')
const { fixture } = require('../tests/helpers/ambientTrafficFixture.cjs')
const { roadMap, planner } = require('../tests/helpers/roadTravelFixture.cjs')
const { loadTsModule } = require('../tests/helpers/loadTsModule.cjs')
function stats(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    meanMs: values.reduce((a, b) => a + b, 0) / values.length,
    p95Ms: sorted[Math.floor(sorted.length * 0.95)],
    maxMs: sorted.at(-1),
  }
}
function run(near) {
  const f = fixture(28)
  // Exercise the maximum six materialized soldiers, plus abstract groups.
  for (const group of f.groups) {
    group.kind = 'military'
    group.members.push({ ...group.members[0], label: `${group.id}:2` })
  }
  f.context.controls.heroUnit.i = near ? 0 : 2000
  const timings = []
  for (let n = 0; n < 5000; n++) {
    const start = performance.now()
    f.tick(250)
    timings.push(performance.now() - start)
  }
  const actors = f.created.filter(actor => !actor.isDestroyed && !actor.isDead).length
  assert.ok(actors <= 6)
  if (!near) assert.equal(f.created.length, 0)
  f.service.destroy()
  return { groups: 28, near, actors, ...stats(timings) }
}
function planning() {
  const map = roadMap(1000)
  const owner = {
    label: 'ai',
    type: 'AI',
    civ: 'Hellas',
    isEnemy: () => false,
    buildings: [3, 200, 400, 600, 800, 997].map((i, n) => ({
      type: 'TownCenter',
      i,
      j: 20,
      label: `town-${n}`,
      isBuilt: true,
    })),
  }
  const context = { map, players: [owner] }
  const { buildTrafficRoutes } = loadTsModule('app/services/travel/ambient/AmbientTrafficRoutes.ts', {
    mocks: {
      '../RoadRoute': planner,
      '../../world/distantVillages/DeferredVillageStore': { deferredVillageBuildings: () => undefined },
      '../../../lib/camps/campRespawnState': { campRespawnStates: () => [] },
      '../../../lib/mapSpaces': { getEntitySpaceId: () => 'outside' },
    },
  })
  const groups = [],
    search = buildTrafficRoutes(context, groups)
  let yields = 0
  const start = performance.now()
  while (!search.next().done) assert.ok(++yields < 100000)
  assert.equal(groups.length, 12)
  return { groups: groups.length, yields, totalCpuMs: performance.now() - start }
}
if (require.main === module)
  console.log(
    JSON.stringify(
      {
        node: process.version,
        planning: planning(),
        updates: [run(false), run(true)],
        limitations:
          'Headless CPU measurements. Rendering, audio and detailed unit movement are stubbed; not an FPS measurement.',
      },
      null,
      2
    )
  )
module.exports = { run, planning }
