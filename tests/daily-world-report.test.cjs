const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadDailyWorldReport() {
  const filename = path.join(__dirname, '../app/services/DailyWorldReport.ts')
  return requireFromTsFile(filename, filename, {
    '../lib/lang': {
      t: (key, vars = {}) =>
        ({
          dailyReportFoodConsumed: `${vars.count} food consumed`,
          dailyReportSummary: `Day ${vars.day}: ${vars.summary}.`,
          dailyReportMarketRestocked: 'new items are available at the market',
          dailyReportMarketsRestocked: `new items are available at ${vars.count} markets`,
          dailyReportTrapFilled: '1 filled trap',
          dailyReportTrapsFilled: `${vars.count} filled traps`,
          dailyReportVillagerArrived: '1 new villager',
          dailyReportVillagersArrived: `${vars.count} new villagers`,
        })[key] ?? key,
    },
  }).DailyWorldReport
}

test('daily report stays quiet for upkeep-only days', () => {
  const DailyWorldReport = loadDailyWorldReport()
  const messages = []
  const player = { isPlayed: true, label: 'p1' }
  const report = new DailyWorldReport(
    {
      menu: { showMessage: (...args) => messages.push(args) },
      player,
    },
    4
  )

  report.add({ count: 24, player, type: 'food-consumed' })
  report.flush()

  assert.deepEqual(messages, [])
})

test('daily report groups notable events into one player summary', () => {
  const DailyWorldReport = loadDailyWorldReport()
  const messages = []
  const player = { isPlayed: true, label: 'p1' }
  const enemy = { isPlayed: false, label: 'enemy' }
  const report = new DailyWorldReport(
    {
      menu: { showMessage: (...args) => messages.push(args) },
      player,
    },
    5
  )

  report.add({ count: 36, player, type: 'food-consumed' })
  report.add({ count: 3, player, type: 'villager-arrival' })
  report.add({ count: 2, player, type: 'trap-filled' })
  report.add({ count: 1, player, type: 'market-restocked' })
  report.add({ count: 5, enemy, type: 'villager-arrival' })
  report.flush()

  assert.deepEqual(messages, [
    ['Day 5: 3 new villagers, 2 filled traps, new items are available at the market, 36 food consumed.', 'info'],
  ])
})

test('daily report announces market restock as a notable event', () => {
  const DailyWorldReport = loadDailyWorldReport()
  const messages = []
  const player = { isPlayed: true, label: 'p1' }
  const report = new DailyWorldReport(
    {
      menu: { showMessage: (...args) => messages.push(args) },
      player,
    },
    6
  )

  report.add({ count: 2, player, type: 'market-restocked' })
  report.flush()

  assert.deepEqual(messages, [['Day 6: new items are available at 2 markets.', 'info']])
})
