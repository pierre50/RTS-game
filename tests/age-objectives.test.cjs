const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { completeAgeObjective, updatePopulationObjectives, AGE_PROGRESSION } = loadTsModule(
  'app/lib/objectives/ageObjectives.ts',
  { mocks: { '../lang': { t: key => key } } }
)

function player() {
  return {
    age: 0,
    completedObjectives: [],
    units: [],
    buildings: [],
    villagerPopulation: 0,
    food: 0,
    gold: 0,
    calls: [],
    onAgeChange() {
      this.calls.push(this.age)
    },
  }
}

test('three ages advance automatically when their objectives are complete', () => {
  const p = player()
  assert.deepEqual(
    AGE_PROGRESSION.map(s => [s.age, s.objectives.length]),
    [
      [1, 5],
      [2, 4],
    ]
  )
  p.buildings.push({ type: 'TownCenter', isBuilt: true })
  updatePopulationObjectives(p)
  completeAgeObjective(p, 'huntAnimal')
  completeAgeObjective(p, 'createWheatField')
  p.villagerPopulation = 20
  updatePopulationObjectives(p)
  p.units = Array.from({ length: 2 }, () => ({ type: 'Fantassin' }))
  updatePopulationObjectives(p)
  assert.equal(p.age, 0)
  p.units.push({ type: 'Fantassin' })
  updatePopulationObjectives(p)
  assert.equal(p.age, 1)
  p.units = Array.from({ length: 5 }, () => ({ type: 'Bowman' }))
  p.villagerPopulation = 50
  updatePopulationObjectives(p)
  completeAgeObjective(p, 'tameHorse')
  p.buildings.push({ type: 'WatchTower', isBuilt: false })
  updatePopulationObjectives(p)
  assert.equal(p.age, 1)
  p.buildings[1].isBuilt = true
  updatePopulationObjectives(p)
  assert.equal(p.age, 2)
  assert.deepEqual(p.calls, [1, 2])
  assert.equal(p.food, 0)
  assert.equal(p.gold, 0)
})

test('dead soldiers do not count and completed milestones survive losses', () => {
  const p = player()
  p.units = [{ type: 'Fantassin' }, { type: 'Fantassin' }, { type: 'Fantassin', isDead: true }]
  updatePopulationObjectives(p)
  assert.equal(p.completedObjectives.includes('trainInfantry'), false)
  p.units[2].isDead = false
  updatePopulationObjectives(p)
  p.units = []
  updatePopulationObjectives(p)
  assert.equal(p.completedObjectives.includes('trainInfantry'), true)
})

test('town center objective requires a living finished town center', () => {
  const p = player()
  p.buildings = [{ type: 'TownCenter', isBuilt: false }]
  updatePopulationObjectives(p)
  assert.equal(p.completedObjectives.includes('buildTownCenter'), false)
  p.buildings[0].isBuilt = true
  updatePopulationObjectives(p)
  assert.equal(p.completedObjectives.includes('buildTownCenter'), true)
  const destroyed = player()
  destroyed.buildings = [{ type: 'TownCenter', isBuilt: true, isDestroyed: true }]
  updatePopulationObjectives(destroyed)
  assert.equal(destroyed.completedObjectives.includes('buildTownCenter'), false)
  destroyed.buildings[0].isDestroyed = false
  destroyed.buildings[0].isDead = true
  updatePopulationObjectives(destroyed)
  assert.equal(destroyed.completedObjectives.includes('buildTownCenter'), false)
  destroyed.buildings[0].isDead = false
  updatePopulationObjectives(destroyed)
  assert.equal(destroyed.completedObjectives.includes('buildTownCenter'), true)
})

test('reaching 100 villagers creates no objective or age after Iron', () => {
  const p = player()
  p.age = 2
  p.villagerPopulation = 100
  updatePopulationObjectives(p)
  assert.equal(p.completedObjectives.includes('reachCity'), false)
  assert.equal(p.age, 2)
  assert.deepEqual(p.calls, [])
  assert.equal(completeAgeObjective(p, 'reachCity'), false)
})


for (const isChief of [false, true]) {
  test(`progression notifications require a chief hero (chief=${isChief})`, () => {
    const p = player()
    const messages = []
    p.isPlayed = true
    p.context = { controls: { heroUnit: { type: 'Hero', isChief } }, menu: { showMessage: text => messages.push(text) } }
    for (const objective of AGE_PROGRESSION[0].objectives) completeAgeObjective(p, objective.id)
    assert.equal(p.age, 1)
    assert.equal(p.completedObjectives.length, AGE_PROGRESSION[0].objectives.length)
    assert.equal(messages.length, isChief ? AGE_PROGRESSION[0].objectives.length + 1 : 0)
  })
}
