const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const messages = []
  const player = { isPlayed: true, label: 'p1' }
  const { DailyWorldReport } = loadTsModule('app/services/dailyEvents/DailyWorldReport.ts', {
    mocks: {
      '../lib/lang': {
        t: (key, vars = {}) =>
          ({
            dailyReportVillagerArrived: '1 new villager',
            dailyReportVillagersArrived: `${vars.count} new villagers`,
            colonyRegionLocation: `region ${vars.x}, ${vars.y}`,
            colonyHousingFullNotification: `No housing available — ${vars.region}. Build more housing.`,
            colonyStorageFullNotification: `Storage is full — ${vars.region}.`,
          })[key] ?? key,
      },
    },
  })
  const context = {
    player,
    menu: { showMessage: (...args) => messages.push(args) },
    map: { worldManifest: { maps: [{ id: 'village', region: { x: 2, y: 4 } }] } },
  }
  return { report: new DailyWorldReport(context), messages, player }
}

test('routine days stay silent, including restocked markets, filled traps and idle workers', () => {
  const { report, messages, player } = fixture()
  for (const type of ['market-restocked', 'trap-filled']) report.add({ type, count: 10, player })
  report.add({ type: 'colony-alert', player, alert: { regionId: 'village', type: 'workersIdle' } })
  report.flush()
  assert.deepEqual(messages, [])
})

test('arrivals produce a standalone player notification once without a day summary', () => {
  const { report, messages, player } = fixture()
  report.add({ count: 2, player, type: 'villager-arrival' })
  report.add({ count: 1, player: { ...player }, type: 'villager-arrival' })
  report.add({ count: 5, player: { label: 'enemy' }, type: 'villager-arrival' })
  report.flush()
  report.flush()
  assert.deepEqual(messages, [['3 new villagers', 'info']])
})

test('housing and storage alerts stay silent, including duplicates and foreign alerts', () => {
  const { report, messages, player } = fixture()
  for (const type of ['populationCapped', 'populationCapped', 'storageFull']) {
    report.add({ type: 'colony-alert', player, alert: { regionId: 'village', type } })
  }
  report.add({ type: 'colony-alert', player: { label: 'enemy' }, alert: { regionId: 'enemy', type: 'storageFull' } })
  report.flush()
  assert.deepEqual(messages, [])
})

test('colony alerts stay silent when the region is missing from the manifest', () => {
  const { report, messages, player } = fixture()
  report.add({ type: 'colony-alert', player, alert: { regionId: 'distant-region', type: 'storageFull' } })
  report.flush()
  assert.deepEqual(messages, [])
})

test('simultaneous arrival and colony alert only notify the arrival', () => {
  const { report, messages, player } = fixture()
  report.add({ count: 1, player, type: 'villager-arrival' })
  report.add({ type: 'colony-alert', player, alert: { regionId: 'village', type: 'storageFull' } })
  report.flush()
  assert.deepEqual(messages, [['1 new villager', 'info']])
})
