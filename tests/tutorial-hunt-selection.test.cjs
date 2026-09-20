const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { selectTutorialHunt } = loadTsModule('app/services/quests/TutorialHuntSelection.ts')
const { commitQuestInventory } = loadTsModule('app/services/quests/QuestInventory.ts')

test('quest inventory commits resources and equipment together and preserves previous equipment', () => {
  const hero = { inventory: { resources: { wood: 10 }, activeWeapons: { ranged: 'bow_great' } } }
  const npc = { inventory: { resources: { wood: 2 } } }
  const before = structuredClone({ hero, npc })
  assert.equal(
    commitQuestInventory(hero, npc, [
      { type: 'take-resource', resource: 'wood', quantity: 10 },
      { type: 'give-item', resource: 'not-an-item', quantity: 1, equip: true },
    ]),
    false
  )
  assert.deepEqual({ hero, npc }, before)
  assert.equal(
    commitQuestInventory(hero, npc, [
      { type: 'take-resource', resource: 'wood', quantity: 10 },
      { type: 'give-item', resource: 'bow', quantity: 1, equip: true },
      { type: 'give-item', resource: 'arrow_ceramic', quantity: 20, equip: true },
    ]),
    true
  )
  assert.equal(hero.inventory.resources.wood, 0)
  assert.equal(npc.inventory.resources.wood, 12)
  assert.equal(hero.inventory.activeWeapons.ranged, 'bow')
  assert.deepEqual(hero.inventory.equipment, ['bow_great'])
  assert.equal(hero.inventory.equippedCounts.arrow, 20)
})


function fixture({ visible = false, camera = false } = {}) {
  const grid = Array.from({ length: 60 }, (_, i) => Array.from({ length: 60 }, (_, j) => ({
    i, j, category: i === 30 ? 'Water' : 'Land', solid: false, has: null,
  })))
  const animals = []
  const context = {
    player: { views: { isVisible: () => visible } },
    controls: { instanceInCamera: () => camera },
    players: [],
    scheduler: { elapsedMs: 0 },
    map: { worldRegionId: 'region', grid, gaia: {
      animals, config: { animals: { Deer: {} } },
      createAnimal(options) {
        const animal = { ...options, label: 'deer-' + animals.length, quantity: 60 }
        animals.push(animal)
        grid[animal.i][animal.j].has = animal
        grid[animal.i][animal.j].solid = true
        return animal
      },
    } },
  }
  const quest = { status: 'active', stageId: 'wood', regionId: 'region', parameters: {}, markers: {} }
  const npc = { i: 5, j: 5 }
  const prepare = () => {
    let result
    for (let i = 0; i < 100 && !result; i++) {
      context.scheduler.elapsedMs += 500
      result = selectTutorialHunt(context, npc, quest)
    }
    return result
  }
  return { context, quest, npc, animals, prepare }
}

test('a tutorial creates its own reachable group once, outside both camera and vision', () => {
  const f = fixture()
  assert.equal(selectTutorialHunt(f.context, f.npc, f.quest), null, 'Search yields before traversing the map')
  assert.equal(f.animals.length, 0)
  const hunt = f.prepare()
  assert.equal(hunt.parameters.resource, 'leather')
  assert.equal(f.animals.length, 3)
  for (const animal of f.animals) {
    assert.ok(animal.i < 30, 'Never cross the water barrier')
    assert.ok(Math.hypot(animal.i - 5, animal.j - 5) >= 12)
  }
  assert.deepEqual(hunt.reservation.entityLabels, f.animals.map(animal => animal.label))
  const saved = JSON.parse(JSON.stringify(f.quest))
  f.context.map.grid = new Proxy([], { get() { throw new Error('A saved encounter must not search again') } })
  assert.deepEqual(selectTutorialHunt(f.context, f.npc, saved), hunt)
  assert.equal(f.animals.length, 3)
})

for (const blocked of [{ visible: true }, { camera: true }]) {
  test('visible or on-camera terrain never receives a quest spawn ' + JSON.stringify(blocked), () => {
    const f = fixture(blocked)
    assert.equal(f.prepare(), null)
    assert.equal(f.animals.length, 0)
    assert.equal(f.quest.encounters, undefined)
  })
}

test('changing visibility during a search is rechecked before spawning', () => {
  const f = fixture()
  selectTutorialHunt(f.context, f.npc, f.quest)
  f.context.player.views.isVisible = () => true
  assert.equal(f.prepare(), null)
  assert.equal(f.animals.length, 0)
})

test('legacy reserved wildlife is adopted without duplicating it', () => {
  const f = fixture()
  f.animals.push({ label: 'legacy', type: 'Deer', i: 10, j: 10, quantity: 20 })
  f.quest.reservation = { entityLabels: ['legacy'], stageIds: ['wood', 'hunt'] }
  const result = selectTutorialHunt(f.context, f.npc, f.quest)
  assert.deepEqual(result.reservation.entityLabels, ['legacy'])
  assert.equal(f.animals.length, 1)
})

test('the same placement service supports bandit factories and never respawns a saved defeated group', () => {
  const { ensureQuestEncounter } = loadTsModule('app/services/quests/QuestEncounterSpawn.ts')
  const f = fixture()
  const bandits = []
  const options = { count: 3, parameters: {}, create(cell) {
    const unit = { label: 'bandit-' + bandits.length, i: cell.i, j: cell.j }
    bandits.push(unit)
    return unit
  } }
  let encounter
  for (let i = 0; i < 100 && !encounter; i++) {
    encounter = ensureQuestEncounter(f.context, f.quest, 'bandits', f.npc, options)
  }
  assert.equal(bandits.length, 3)
  bandits.forEach(unit => { unit.isDead = true })
  const restored = JSON.parse(JSON.stringify(f.quest))
  assert.deepEqual(ensureQuestEncounter(f.context, restored, 'bandits', f.npc, options), encounter)
  assert.equal(bandits.length, 3)
})
