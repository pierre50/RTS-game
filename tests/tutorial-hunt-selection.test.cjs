const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { selectTutorialHunt } = loadTsModule('app/services/quests/TutorialHuntSelection.ts')
const { commitQuestInventory } = loadTsModule('app/services/quests/QuestInventory.ts')

test('hunting selection ignores unreachable and indoor wildlife and follows actual gathering loot', () => {
  const grid = Array.from({ length: 7 }, (_, i) =>
    Array.from({ length: 7 }, () => ({ category: i === 3 ? 'Water' : 'Land' }))
  )
  const context = {
    map: {
      grid,
      gaia: {
        animals: [
          { type: 'Deer', i: 1, j: 1, quantity: 60 },
          { type: 'BlackGrouse', i: 5, j: 1, quantity: 1000 },
          { type: 'BlackGrouse', i: 1, j: 2, quantity: 1000, spaceId: 'cave' },
          { type: 'BlackGrouse', i: 1, j: 2, quantity: 1000, isDestroyed: true },
        ],
      },
    },
  }
  const result = selectTutorialHunt(context, { i: 0, j: 0 })
  assert.equal(result.parameters.resource, 'leather')
  assert.equal(result.parameters.quantity, 2)
  assert.deepEqual(result.markers.hunt[0].position, { i: 1, j: 1 })
  context.map.gaia.animals = []
  assert.equal(selectTutorialHunt(context, { i: 0, j: 0 }), null)
})

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

test('missing wildlife is supplemented naturally on the accessible bank, then reserved', () => {
  const grid = Array.from({ length: 40 }, (_, i) => Array.from({ length: 40 }, (_, j) => ({
    i, j, type: 'Grass', category: i === 20 ? 'Water' : 'Land', solid: false, has: null,
  })))
  const animals = []
  const context = {
    player: { views: { isVisible: () => false } },
    players: [{ buildings: [{ i: 5, j: 5, size: 2 }] }],
    map: { grid, random: () => 0.1, randomRange: min => min,
      gaia: { animals, config: { animals: { Deer: {} } }, createAnimal(options) {
        const animal = { ...options, family: 'animal', label: `deer-${animals.length}`, quantity: 60 }
        animals.push(animal)
        grid[animal.i][animal.j].solid = true
        grid[animal.i][animal.j].has = animal
        return animal
      } },
    },
  }
  const result = selectTutorialHunt(context, { i: 5, j: 5 }, { ensurePopulation: true })
  assert.equal(result.parameters.resource, 'leather')
  assert.ok(animals.length > 0)
  assert.ok(result.reservation.entityLabels.length > 0)
  for (const animal of animals) {
    assert.ok(animal.i < 20, 'Must stay on the village bank')
    assert.ok(Math.max(Math.abs(animal.i - 5), Math.abs(animal.j - 5)) > 5, 'Keep animals outside buildings')
  }
  const count = animals.length
  selectTutorialHunt(context, { i: 5, j: 5 }, { ensurePopulation: true, resource: 'leather', quantity: 3 })
  assert.equal(animals.length, count, 'Do not add animals when the existing yield is sufficient')
  for (const animal of animals) { animal.isDestroyed = true; grid[animal.i][animal.j].solid = false; grid[animal.i][animal.j].has = null }
  const replacement = selectTutorialHunt(context, { i: 5, j: 5 }, { ensurePopulation: true, resource: 'leather', quantity: 1 })
  assert.equal(replacement.parameters.resource, 'leather', 'Keep the active quest resource')
  assert.ok(animals.length > count, 'Replenish when unlucky gathering exhausts the wildlife')
})
