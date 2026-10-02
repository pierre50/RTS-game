const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup() {
  const { VisionGrid } = loadTsModule('app/services/visibility/VisionGrid.ts')
  const grid = Array.from({ length: 21 }, (_, i) => Array.from({ length: 21 }, (_, j) => ({ i, j, has: null })))
  const space = { id: 'outside', size: 20, grid }
  const human = { label: 'human', type: 'Human', views: new VisionGrid(20), units: [] }
  const gaia = { label: 'gaia', type: 'Gaia', views: new VisionGrid(20), cellViewed: 0 }
  const observations = []
  const { updateVisibility } = loadTsModule('app/services/visibility/UnitPerception.ts', {
    mocks: {
      '../lib/chief': { heroCanCommand: () => true },
      '../lib/mapSpaces': { OUTSIDE_SPACE_ID: 'outside', getMapSpace: () => space },
      '../lib/units/playerTargetKnowledge': { observeTarget: (owner, target) => observations.push([owner, target]) },
      './visibility/AIVisibilityKnowledge': { updateAIKnowledge() {} },
    },
  })
  const animal = {
    label: 'deer',
    family: 'animal',
    type: 'Deer',
    i: 5,
    j: 5,
    sight: 2,
    owner: gaia,
    context: { map: { grid }, player: human, players: [human], controls: {} },
  }
  return { updateVisibility, animal, gaia, human, grid, space, observations, VisionGrid }
}

test('wildlife preserves reverse detection and observer discovery without accumulating Gaia vision', () => {
  const f = setup()
  const detected = []
  f.grid[7][5].has = { i: 7, j: 5, sight: 3, detect: animal => detected.push(animal) }
  f.grid[8][5].has = { i: 8, j: 5, sight: 3, detect: animal => detected.push(animal) }
  f.updateVisibility(f.animal)
  assert.equal(detected.length, 1)
  f.updateVisibility(f.animal)
  assert.equal(detected.length, 1)
  f.animal.i++
  f.updateVisibility(f.animal)
  assert.equal(detected.length, 2)
  assert.equal(f.observations.length, 3)
  assert.ok(f.observations.every(([owner, target]) => owner === f.human && target === f.animal))
  assert.equal(f.gaia.views.visibleBy.size, 0)
  assert.equal(f.gaia.cellViewed, 0)
  assert.equal(f.animal.visibleCells, undefined)
  f.animal.isDead = true
  f.updateVisibility(f.animal)
  assert.equal(detected.length, 2)
})

test('domesticated animals and Gaia units keep the existing visibility behavior', () => {
  for (const override of [{ tamingStatus: 'tamed' }, { companionOwner: {} }, { family: 'unit' }]) {
    const f = setup()
    Object.assign(f.animal, override)
    f.updateVisibility(f.animal)
    assert.ok(f.gaia.views.visibleBy.size > 0)
    assert.ok(f.animal.visibleCells.size > 0)
  }
})

test('ten thousand wild animal updates do not grow shared viewer or exploration tables', () => {
  const f = setup()
  for (let i = 0; i < 10000; i++) {
    f.updateVisibility({ ...f.animal, label: `deer-${i}`, i: 2 + (i % 16), j: 2 + (Math.floor(i / 16) % 16) })
  }
  assert.equal(f.gaia.views.visibleBy.size, 0)
  let explored = 0
  f.gaia.views.forEachViewed(() => explored++)
  assert.equal(explored, 0)
  assert.equal(f.observations.length, 10000)
})

test('returning a domesticated Gaia animal to the wild removes its previous viewers', () => {
  const f = setup()
  f.animal.tamingStatus = 'tamed'
  f.updateVisibility(f.animal)
  assert.ok(f.gaia.views.visibleBy.size > 0)
  f.animal.tamingStatus = 'wild'
  f.updateVisibility(f.animal)
  assert.equal(f.gaia.views.visibleBy.size, 0)
  assert.equal(f.animal.visibleCells.size, 0)
})
