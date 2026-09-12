const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture(gender = 'male') {
  const api = loadTsModule('app/services/introduction/GameIntroduction.ts', { mocks: {
    '../../lib/lpc': { ensureAndRefreshBakedLpcUnitAssets: async () => {} },
    '../../lib/grid/visibility': { updateInstanceVisibility() {} },
    '../../lib/maths': { getInstanceDegree: () => 90 },
  } })
  const hero = { label: 'hero', i: 5, j: 5, x: 5, y: 5, gender, stop() {} }
  const grid = Array.from({ length: 12 }, (_, i) => Array.from({ length: 12 }, (_, j) => ({ i, j, z: 0, category: 'Land', solid: false, has: null })))
  grid[5][5].has = hero
  let saved
  let dialogue
  let opened = 0
  const player = {
    config: { buildings: { FireCamp: { size: 1 } } }, units: [hero], buildings: [],
    createBuilding(options) { const entity = { ...options, label: 'camp' }; this.buildings.push(entity); return entity },
    createUnit(options) { const entity = { ...options, label: 'companion', x: options.i, y: options.j, stop() {} }; this.units.push(entity); return entity },
  }
  const context = { player, map: { grid }, controls: { heroUnit: hero }, menu: {
    openNpcOrders(npcs, options) { opened++; dialogue = options; assert.equal(npcs[0], player.units[1]) }, closeNpcOrders() {},
  } }
  const host = { _campaignSave: { currentWorldId: 'start' }, _gameContext: () => context,
    togglePause(value) { context.paused = value },
    autosave() { saved = structuredClone({ campaign: host._campaignSave, unitLabels: player.units.map(unit => unit.label), buildingLabels: player.buildings.map(building => building.label) }) },
  }
  return { ...api, host, context, player, getSaved: () => saved, getDialogue: () => dialogue, getOpened: () => opened }
}

for (const gender of ['male', 'female']) test(`new game creates one allied companion opposite to ${gender}, and one camp`, async () => {
  const f = fixture(gender)
  await f.prepareGameIntroduction(f.host)
  assert.equal(f.player.units.length, 2)
  assert.equal(f.player.units[1].gender, gender === 'male' ? 'female' : 'male')
  assert.equal(f.player.units[1].isChief, false)
  assert.equal(f.player.buildings.length, 1)
  assert.equal(f.context.paused, true)
  assert.equal(f.getSaved().campaign.introduction.status, 'prepared')
  assert.deepEqual(f.getSaved().unitLabels, ['hero', 'companion'])
  await f.prepareGameIntroduction(f.host)
  assert.equal(f.player.units.length, 2)
})

test('legacy saves and travel never open an introduction; a prepared reload resumes without spawning', async () => {
  const f = fixture()
  f.showGameIntroduction(f.host)
  assert.equal(f.getOpened(), 0)
  await f.prepareGameIntroduction(f.host)
  f.host._campaignSave.currentWorldId = 'other'
  f.showGameIntroduction(f.host)
  assert.equal(f.getOpened(), 0)
  f.host._campaignSave = structuredClone(f.getSaved().campaign)
  f.showGameIntroduction(f.host)
  assert.equal(f.getOpened(), 1)
  assert.equal(f.getDialogue().ordersEnabled, false)
  assert.equal(f.player.units.length, 2)
  // Saving may replace the campaign while the response callback remains open.
  f.host._campaignSave = structuredClone(f.host._campaignSave)
  f.getDialogue().scriptedReply.onSelect()
  assert.equal(f.host._campaignSave.introduction.status, 'completed')
  assert.equal(f.getSaved().campaign.introduction.status, 'completed')
  assert.equal(f.context.paused, false)
  f.showGameIntroduction(f.host)
  assert.equal(f.getOpened(), 1)
})

test('camp placement respects occupied cells, water and access around the fire', () => {
  const { findIntroductionPlacement } = loadTsModule('app/services/introduction/IntroductionPlacement.ts')
  const f = fixture()
  const grid = f.context.map.grid
  grid[6][5].category = 'Water'
  grid[4][5].has = { type: 'Tree' }
  const placement = findIntroductionPlacement(f.context.map, f.context.controls.heroUnit, 1)
  assert.ok(placement)
  assert.notEqual(placement.camp, placement.companion)
  assert.equal(placement.camp.has, null)
  assert.equal(placement.companion.has, null)
  for (const [i, j] of [[6,5], [4,5], [5,4], [5,6]]) grid[i][j].solid = true
  assert.equal(findIntroductionPlacement(f.context.map, f.context.controls.heroUnit, 1), null)
})
