const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { maintainWildlifeHome, habitatCells } = loadTsModule('app/services/wildlife/WildlifeHabitat.ts')

function fixture() {
  const grid = Array.from({ length: 100 }, (_, i) =>
    Array.from({ length: 100 }, (_, j) => ({ i, j, category: 'Land', solid: false, has: null }))
  )
  return { context: { map: { grid } }, grid, home: { homeI: 50, homeJ: 50, generation: 0 } }
}
function occupy(grid) {
  for (let i = 42; i <= 58; i++)
    for (let j = 42; j <= 58; j++) {
      grid[i][j].has = { family: 'building' }
      grid[i][j].solid = true
    }
}

test('one building leaves the home unchanged when usable habitat remains', () => {
  const f = fixture()
  f.grid[50][50].has = { family: 'building' }
  f.grid[50][50].solid = true
  maintainWildlifeHome(f.context, f.home, 1)
  maintainWildlifeHome(f.context, f.home, 2)
  assert.equal(f.home.homeI, 50)
  assert.equal(f.home.homeJ, 50)
  assert.ok(habitatCells(f.context, f.home).length)
})

test('persistent occupation relocates nearby, preserving the original anchor and replacement date', () => {
  const f = fixture()
  occupy(f.grid)
  f.home.renewDay = 4
  maintainWildlifeHome(f.context, f.home, 1)
  assert.equal(f.home.homeI, 50)
  maintainWildlifeHome(f.context, f.home, 2)
  assert.ok(Math.hypot(f.home.homeI - 50, f.home.homeJ - 50) > 8)
  assert.ok(Math.hypot(f.home.homeI - 50, f.home.homeJ - 50) <= 24)
  assert.equal(f.home.originI, 50)
  assert.equal(f.home.originJ, 50)
  assert.equal(f.home.renewDay, 4)
})

test('passing units do not make habitat permanently unusable', () => {
  const f = fixture()
  for (let i = 42; i <= 58; i++)
    for (let j = 42; j <= 58; j++) {
      f.grid[i][j].has = { family: 'unit' }
      f.grid[i][j].solid = true
    }
  maintainWildlifeHome(f.context, f.home, 1)
  maintainWildlifeHome(f.context, f.home, 2)
  assert.equal(f.home.homeI, 50)
  assert.equal(f.home.blockedSinceDay, undefined)
})

test('no suitable nearby land keeps relocation pending, without crossing the map', () => {
  const f = fixture()
  for (const row of f.grid) for (const cell of row) cell.category = 'Water'
  occupy(f.grid)
  maintainWildlifeHome(f.context, f.home, 1)
  maintainWildlifeHome(f.context, f.home, 2)
  assert.equal(f.home.homeI, 50)
  assert.equal(f.home.blockedSinceDay, 1)
})
