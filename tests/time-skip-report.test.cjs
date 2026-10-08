const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { captureTimeSkipReport, formatTimeSkipReport } = loadTsModule('app/services/timeSkip/TimeSkipReport.ts')

test('day report keeps independent inventory snapshots and shows spending, work and population deltas', () => {
  const worker = { label: 'worker', type: 'Villager', inventory: { resources: { wheat: 12 } }, hitPoints: 5, energy: 1 }
  const depot = {
    label: 'store',
    type: 'TownCenter',
    i: 0,
    j: 0,
    isBuilt: true,
    inventory: { resources: { wood: 10 } },
  }
  const project = { label: 'house', type: 'House', isBuilt: false }
  const owner = { label: 'player', units: [worker], buildings: [depot, project] }
  let elapsed = 0
  const context = { players: [owner], dayNight: { state: { day: 1 }, getElapsedMs: () => elapsed } }
  const before = captureTimeSkipReport(context)
  elapsed = 1440000
  context.dayNight.state.day = 2
  worker.inventory.resources.wheat = 8
  worker.hitPoints = 20
  worker.energy = 10
  worker.lastMealAt = 1500
  depot.inventory.resources.wood = 6
  project.isBuilt = true
  owner.units.push({ label: 'new', type: 'Villager', hitPoints: 20, energy: 10 })
  const report = formatTimeSkipReport(before, captureTimeSkipReport(context), true, 60000)
  assert.match(report, /stocks: wood -4; bags: wheat -4/)
  assert.match(report, /units: Villager \+1; built \+1; projects -1/)
  assert.match(report, /HP \+35; energy \+19; meal checkpoints advanced: 1/)
  assert.match(report, /24.00 \/ 24h; daily boundaries: 1/)
  assert.match(report, /totals also include arrivals/)
})
